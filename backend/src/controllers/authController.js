import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  sendAccountVerificationEmail,
  sendLoginNotificationEmail,
  sendPasswordResetEmail
} from "../utils/sendEmail.js";

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getFrontendUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

const isMailConfigured = () =>
  Boolean(process.env.MAIL_HOST?.trim() && process.env.MAIL_FROM?.trim());

const shouldRequireEmailVerification = () => {
  if (process.env.REQUIRE_EMAIL_VERIFICATION === "true") {
    return true;
  }

  if (process.env.REQUIRE_EMAIL_VERIFICATION === "false") {
    return false;
  }

  return isMailConfigured();
};

const shouldSendAuthEmails = () =>
  process.env.REQUIRE_EMAIL_VERIFICATION !== "false" && isMailConfigured();

const isBootstrapTokenValid = (token) => {
  const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN?.trim();

  if (!expectedToken || !token || expectedToken.length !== token.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
};

const normalizeBootstrapCredential = (value) => String(value || "").trim();

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, dan password wajib diisi"
      });
    }

    const existingUser = await pool.query(
      "SELECT * FROM flix.users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: "Email atau username sudah digunakan"
      });
    }

    const roleResult = await pool.query(
      "SELECT id_role FROM flix.roles WHERE role_name = $1",
      ["registered_user"]
    );

    const hashedPassword = await bcrypt.hash(password, 10);
    const roleId = roleResult.rows[0].id_role;
    const requireEmailVerification = shouldRequireEmailVerification();
    const verificationToken = requireEmailVerification
      ? crypto.randomBytes(32).toString("hex")
      : null;
    const verificationTokenHash = verificationToken ? hashToken(verificationToken) : null;
    const frontendUrl = getFrontendUrl();
    const verificationLink = verificationToken
      ? `${frontendUrl}/verify-email?token=${verificationToken}`
      : null;
    let newUser;

    if (!requireEmailVerification) {
      const result = await pool.query(
        `INSERT INTO flix.users (id_role, username, email, password, email_verified, subscription_plan)
         VALUES ($1, $2, $3, $4, $5, 'free')
         RETURNING id_user, username, email, profile_image_url, banner_image_url, email_verified, is_premium, subscription_plan`,
        [roleId, username, email, hashedPassword, !requireEmailVerification]
      );

      newUser = result.rows[0];
    } else {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const result = await client.query(
          `INSERT INTO flix.users (id_role, username, email, password, email_verified, subscription_plan)
           VALUES ($1, $2, $3, $4, $5, 'free')
           RETURNING id_user, username, email, profile_image_url, banner_image_url, email_verified, is_premium, subscription_plan`,
          [roleId, username, email, hashedPassword, !requireEmailVerification]
        );

        newUser = result.rows[0];

        await client.query(
          `INSERT INTO flix.email_verification_tokens (id_user, token_hash, expires_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
          [newUser.id_user, verificationTokenHash]
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    if (requireEmailVerification) {
      try {
        await sendAccountVerificationEmail(email, username, verificationLink);
      } catch (mailError) {
        console.error("Gagal kirim email verifikasi:", mailError.message);
      }
    }

    return res.status(201).json({
      message: requireEmailVerification
        ? "Register berhasil. Cek email kamu untuk verifikasi akun."
        : "Register berhasil. Kamu bisa login sekarang.",
      user: newUser
    });
  } catch (error) {
    return res.status(500).json({
      message: "Terjadi kesalahan saat register",
      error: error.message
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `SELECT 
          u.id_user,
          u.username,
          u.email,
          u.password,
          u.email_verified,
          u.is_active,
          u.is_premium,
          u.subscription_plan,
          u.profile_image_url,
          u.banner_image_url,
          r.role_name,
          active_package.package_code AS current_package_code,
          active_package.package_name AS current_package_name,
          active_package.premium_started_at,
          active_package.premium_expired_at,
          pending_payment.status AS pending_payment_status,
          pending_payment.package_code AS pending_payment_package_code,
          pending_payment.package_name AS pending_payment_package_name,
          pending_payment.duration_months AS pending_payment_duration_months,
          pending_payment.total_amount AS pending_payment_total_amount,
          pending_payment.created_at AS pending_payment_created_at
       FROM flix.users u
       JOIN flix.roles r ON u.id_role = r.id_role
       LEFT JOIN LATERAL (
         SELECT
           pt.package_code,
           pt.package_name,
           pt.premium_started_at,
           pt.premium_expired_at
         FROM flix.payment_transactions pt
         WHERE pt.id_user = u.id_user
           AND pt.status = 'approved'
           AND (
             pt.premium_expired_at IS NULL
             OR pt.premium_expired_at > CURRENT_TIMESTAMP
           )
         ORDER BY pt.verified_at DESC NULLS LAST, pt.created_at DESC
         LIMIT 1
       ) active_package ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           pt.status,
           pt.package_code,
           pt.package_name,
           pt.duration_months,
           pt.total_amount,
           pt.created_at
         FROM flix.payment_transactions pt
         WHERE pt.id_user = u.id_user
           AND pt.status = 'pending'
         ORDER BY pt.created_at DESC
         LIMIT 1
       ) pending_payment ON TRUE
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan"
      });
    }

    const user = result.rows[0];
    const subscriptionPlan =
      user.subscription_plan || (user.is_premium ? "premium" : "free");

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Password salah"
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        message: "Akun dinonaktifkan oleh admin."
      });
    }

    const emailVerified = user.email_verified || !shouldRequireEmailVerification();

    if (!emailVerified) {
      return res.status(403).json({
        message: "Akun belum diverifikasi. Silakan cek email untuk verifikasi akun."
      });
    }

    const token = jwt.sign(
      {
        id_user: user.id_user,
        username: user.username,
        email: user.email,
        role: user.role_name,
        email_verified: emailVerified,
        is_premium: subscriptionPlan === "premium" || subscriptionPlan === "exclusive",
        subscription_plan: subscriptionPlan
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // kirim email notifikasi login
    if (shouldSendAuthEmails()) {
      try {
        await sendLoginNotificationEmail(user.email, user.username);
      } catch (mailError) {
        console.error("Gagal kirim email login:", mailError.message);
      }
    }

    return res.json({
      message: "Login berhasil",
      token,
      user: {
        id_user: user.id_user,
        username: user.username,
        email: user.email,
        role: user.role_name,
        email_verified: emailVerified,
        is_premium: subscriptionPlan === "premium" || subscriptionPlan === "exclusive",
        subscription_plan: subscriptionPlan,
        profile_image_url: user.profile_image_url,
        banner_image_url: user.banner_image_url,
        current_package_code: user.current_package_code,
        current_package_name: user.current_package_name,
        premium_started_at: user.premium_started_at,
        premium_expired_at: user.premium_expired_at,
        pending_payment_status: user.pending_payment_status,
        pending_payment_package_code: user.pending_payment_package_code,
        pending_payment_package_name: user.pending_payment_package_name,
        pending_payment_duration_months: user.pending_payment_duration_months,
        pending_payment_total_amount: user.pending_payment_total_amount,
        pending_payment_created_at: user.pending_payment_created_at
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Terjadi kesalahan saat login",
      error: error.message
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const token = req.body?.token || req.query?.token;

    if (!token) {
      return res.status(400).json({
        message: "Token verifikasi wajib diisi"
      });
    }

    const tokenHash = hashToken(token);
    const tokenResult = await pool.query(
      `SELECT evt.id_verification, evt.id_user, evt.used_at, evt.expires_at, u.email_verified
       FROM flix.email_verification_tokens evt
       JOIN flix.users u ON u.id_user = evt.id_user
       WHERE evt.token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        message: "Token verifikasi tidak valid"
      });
    }

    const verificationToken = tokenResult.rows[0];

    if (verificationToken.email_verified) {
      return res.json({
        message: "Akun sudah terverifikasi. Kamu bisa login."
      });
    }

    if (verificationToken.used_at || new Date(verificationToken.expires_at) <= new Date()) {
      return res.status(400).json({
        message: "Token verifikasi sudah digunakan atau kedaluwarsa"
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE flix.users
         SET email_verified = TRUE,
             email_verified_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_user = $1`,
        [verificationToken.id_user]
      );

      await client.query(
        `UPDATE flix.email_verification_tokens
         SET used_at = CURRENT_TIMESTAMP
         WHERE id_verification = $1`,
        [verificationToken.id_verification]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return res.json({
      message: "Akun berhasil diverifikasi. Kamu bisa login sekarang."
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal verifikasi akun",
      error: error.message
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email wajib diisi"
      });
    }

    const userResult = await pool.query(
      `SELECT id_user, username, email
       FROM flix.users
       WHERE email = $1`,
      [email]
    );

    const genericMessage =
      "Jika email terdaftar, link reset password akan dikirim";

    if (userResult.rows.length === 0) {
      return res.json({
        message: genericMessage
      });
    }

    const user = userResult.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const frontendUrl = getFrontendUrl();
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    await pool.query(
      `UPDATE flix.password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE id_user = $1 AND used_at IS NULL`,
      [user.id_user]
    );

    await pool.query(
      `INSERT INTO flix.password_reset_tokens (id_user, token_hash, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 minutes')`,
      [user.id_user, tokenHash]
    );

    await sendPasswordResetEmail(user.email, user.username, resetLink);

    return res.json({
      message: genericMessage
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal memproses lupa password",
      error: error.message
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Token dan password wajib diisi"
      });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({
        message: "Password minimal 6 karakter"
      });
    }

    const tokenHash = hashToken(token);

    const tokenResult = await pool.query(
      `SELECT prt.id_reset, prt.id_user
       FROM flix.password_reset_tokens prt
       WHERE prt.token_hash = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        message: "Token reset password tidak valid atau sudah kedaluwarsa"
      });
    }

    const resetToken = tokenResult.rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE flix.users
         SET password = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_user = $2`,
        [hashedPassword, resetToken.id_user]
      );

      await client.query(
        `UPDATE flix.password_reset_tokens
         SET used_at = CURRENT_TIMESTAMP
         WHERE id_reset = $1`,
        [resetToken.id_reset]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return res.json({
      message: "Password berhasil direset"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal reset password",
      error: error.message
    });
  }
};

export const bootstrapAdmin = async (req, res) => {
  if (process.env.ENABLE_ADMIN_BOOTSTRAP !== "true") {
    return res.status(404).json({
      message: "Route tidak ditemukan"
    });
  }

  const token = req.headers["x-bootstrap-token"];

  if (!isBootstrapTokenValid(Array.isArray(token) ? token[0] : token)) {
    return res.status(403).json({
      message: "Token bootstrap tidak valid"
    });
  }

  try {
    const username = normalizeBootstrapCredential(req.body?.username);
    const email = normalizeBootstrapCredential(req.body?.email).toLowerCase();
    const password = normalizeBootstrapCredential(req.body?.password);

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, dan password wajib diisi"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password admin minimal 8 karakter"
      });
    }

    const roleResult = await pool.query(
      "SELECT id_role FROM flix.roles WHERE role_name = $1",
      ["admin"]
    );

    if (!roleResult.rowCount) {
      return res.status(500).json({
        message: "Role admin tidak tersedia di database"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO flix.users (
         id_role,
         username,
         email,
         password,
         email_verified,
         email_verified_at,
         is_active,
         subscription_plan
       )
       VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP, TRUE, 'free')
       ON CONFLICT (email)
       DO UPDATE SET
         id_role = EXCLUDED.id_role,
         username = EXCLUDED.username,
         password = EXCLUDED.password,
         email_verified = TRUE,
         email_verified_at = COALESCE(flix.users.email_verified_at, CURRENT_TIMESTAMP),
         is_active = TRUE,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id_user, username, email, email_verified, is_active`,
      [roleResult.rows[0].id_role, username, email, hashedPassword]
    );

    return res.status(201).json({
      message: "Akun admin berhasil dibuat",
      user: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal membuat akun admin",
      error: error.message
    });
  }
};
