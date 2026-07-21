import pool from "../config/db.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

export const getMyProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          u.id_user,
          u.username,
          u.email,
          u.profile_image_url,
          u.banner_image_url,
          u.is_premium,
          u.subscription_plan,
          r.role_name,
          u.created_at,
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
       WHERE u.id_user = $1`,
      [req.user.id_user]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan"
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil profile",
      error: error.message
    });
  }
};

export const getMyProfileActivity = async (req, res) => {
  try {
    const userId = req.user.id_user;

    const [movieReviews, tvSeriesReviews, posts] = await Promise.all([
      pool.query(
        `SELECT
            mr.id_review,
            mr.tmdb_movie_id AS tmdb_id,
            'movie' AS media_type,
            mr.content,
            mr.rating,
            mr.created_at,
            mr.updated_at,
            COALESCE(COUNT(mrl.id_like), 0)::INTEGER AS like_count
         FROM flix.movie_reviews mr
         LEFT JOIN flix.movie_review_likes mrl ON mr.id_review = mrl.id_review
         WHERE mr.id_user = $1
           AND mr.parent_review_id IS NULL
           AND COALESCE(mr.moderation_status, 'active') <> 'blocked'
           AND NOT EXISTS (
             SELECT 1
             FROM flix.reports report
             WHERE report.movie_review_id = mr.id_review
               AND report.status = 'approved'
           )
         GROUP BY mr.id_review
         ORDER BY mr.created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT
            tr.id_review,
            tr.tmdb_series_id AS tmdb_id,
            'tv' AS media_type,
            tr.content,
            tr.rating,
            tr.created_at,
            tr.updated_at,
            COALESCE(COUNT(trl.id_like), 0)::INTEGER AS like_count
         FROM flix.tv_series_reviews tr
         LEFT JOIN flix.tv_series_review_likes trl ON tr.id_review = trl.id_review
         WHERE tr.id_user = $1
           AND tr.parent_review_id IS NULL
           AND COALESCE(tr.moderation_status, 'active') <> 'blocked'
           AND NOT EXISTS (
             SELECT 1
             FROM flix.reports report
             WHERE report.tv_series_review_id = tr.id_review
               AND report.status = 'approved'
           )
         GROUP BY tr.id_review
         ORDER BY tr.created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT
            p.id_post,
            p.title,
            p.content,
            p.image_url,
            p.tags,
            p.post_type,
            p.created_at,
            COALESCE(c.reply_count, 0)::INTEGER AS reply_count,
            COALESCE(l.like_count, 0)::INTEGER AS like_count,
            COALESCE(r.reaction_count, 0)::INTEGER AS reaction_count
         FROM flix.posts p
         LEFT JOIN (
           SELECT id_post, COUNT(*) AS reply_count
           FROM flix.comments
           GROUP BY id_post
         ) c ON p.id_post = c.id_post
         LEFT JOIN (
           SELECT id_post, COUNT(*) AS like_count
           FROM flix.post_likes
           GROUP BY id_post
         ) l ON p.id_post = l.id_post
         LEFT JOIN (
           SELECT id_post, COUNT(*) AS reaction_count
           FROM flix.post_reactions
           GROUP BY id_post
         ) r ON p.id_post = r.id_post
         WHERE p.id_user = $1
         ORDER BY p.created_at DESC`,
        [userId]
      )
    ]);

    const reviews = [...movieReviews.rows, ...tvSeriesReviews.rows].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return res.json({
      stats: {
        review_count: reviews.length,
        movie_review_count: movieReviews.rows.length,
        tv_review_count: tvSeriesReviews.rows.length,
        post_count: posts.rows.length
      },
      reviews,
      posts: posts.rows
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil aktivitas profile",
      error: error.message
    });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        message: "Username dan email wajib diisi"
      });
    }

    const checkUser = await pool.query(
      `SELECT id_user
       FROM flix.users
       WHERE (username = $1 OR email = $2)
         AND id_user <> $3`,
      [username, email, req.user.id_user]
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({
        message: "Username atau email sudah digunakan user lain"
      });
    }

    let result;

    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);

      result = await pool.query(
        `UPDATE flix.users
         SET username = $1,
             email = $2,
             password = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_user = $4
         RETURNING id_user, username, email, profile_image_url, banner_image_url`,
        [username, email, hashedPassword, req.user.id_user]
      );
    } else {
      result = await pool.query(
        `UPDATE flix.users
         SET username = $1,
             email = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_user = $3
         RETURNING id_user, username, email, profile_image_url, banner_image_url`,
        [username, email, req.user.id_user]
      );
    }

    return res.json({
      message: "Profile berhasil diperbarui",
      user: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal update profile",
      error: error.message
    });
  }
};

export const updateMyProfileMedia = async (req, res) => {
  try {
    const { field, image_url } = req.body;
    const allowedFields = ["profile_image_url", "banner_image_url"];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        message: "Field media profile tidak valid"
      });
    }

    if (!image_url || typeof image_url !== "string") {
      return res.status(400).json({
        message: "URL gambar wajib diisi"
      });
    }

    if (
      !image_url.startsWith("/uploads/") &&
      !image_url.startsWith("http") &&
      !image_url.startsWith("data:image/")
    ) {
      return res.status(400).json({
        message: "URL gambar tidak valid"
      });
    }

    const result = await pool.query(
      `UPDATE flix.users
       SET ${field} = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_user = $2
       RETURNING id_user, username, email, profile_image_url, banner_image_url`,
      [image_url, req.user.id_user]
    );

    return res.json({
      message:
        field === "profile_image_url"
          ? "Foto profile berhasil diperbarui"
          : "Banner profile berhasil diperbarui",
      user: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal update media profile",
      error: error.message
    });
  }
};

export const updateMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Kata sandi lama dan kata sandi baru wajib diisi"
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        message: "Kata sandi baru minimal 6 karakter"
      });
    }

    const userResult = await pool.query(
      `SELECT password
       FROM flix.users
       WHERE id_user = $1`,
      [req.user.id_user]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan"
      });
    }

    const isPasswordMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        message: "Kata sandi lama tidak sesuai"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE flix.users
       SET password = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_user = $2`,
      [hashedPassword, req.user.id_user]
    );

    return res.json({
      message: "Kata sandi berhasil diperbarui"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal memperbarui kata sandi",
      error: error.message
    });
  }
};

export const deleteMyAccount = async (req, res) => {
  try {
    const roleResult = await pool.query(
      `SELECT r.role_name
       FROM flix.users u
       JOIN flix.roles r ON r.id_role = u.id_role
       WHERE u.id_user = $1`,
      [req.user.id_user]
    );

    if (roleResult.rows[0]?.role_name === "admin") {
      return res.status(403).json({
        message: "Akun admin tidak bisa dihapus dari halaman settings"
      });
    }

    const deletedEmail = `deleted-user-${req.user.id_user}-${Date.now()}@flix.local`;
    const deletedUsername = `deleted_user_${req.user.id_user}_${Date.now()}`;
    const deletedPassword = await bcrypt.hash(crypto.randomUUID?.() || `${Date.now()}-${req.user.id_user}`, 10);

    await pool.query(
      `UPDATE flix.users
       SET username = $1,
           email = $2,
           password = $3,
           profile_image_url = NULL,
           banner_image_url = NULL,
           is_active = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_user = $4`,
      [deletedUsername, deletedEmail, deletedPassword, req.user.id_user]
    );

    return res.json({
      message: "Akun berhasil dihapus"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menghapus akun",
      error: error.message
    });
  }
};
