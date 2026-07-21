import transporter from "../config/mail.js";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const buildActionEmail = ({ title, greeting, body, buttonText, buttonUrl, note }) => `
  <div style="margin:0;padding:32px;background:#141414;color:#ffffff;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#232323;border-radius:20px;padding:32px">
      <h2 style="margin:0 0 16px;color:#ffffff">${title}</h2>
      <p style="margin:0 0 12px;color:#e5e5e5">${greeting}</p>
      <p style="margin:0 0 28px;color:#cfcfcf;line-height:1.55">${body}</p>
      <a href="${buttonUrl}" style="display:inline-block;background:#e50914;color:#ffffff;text-decoration:none;font-weight:700;border-radius:20px;padding:13px 28px">
        ${buttonText}
      </a>
      <p style="margin:28px 0 0;color:#a3a3a3;font-size:13px;line-height:1.5">${note}</p>
    </div>
  </div>
`;

export const sendWelcomeEmail = async (toEmail, username) => {
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    subject: "Selamat datang di Flix",
    html: `
      <h2>Halo, ${username}!</h2>
      <p>Akun kamu berhasil dibuat di <b>Flix</b>.</p>
      <p>Sekarang kamu bisa login dan mulai membuat community post.</p>
    `
  });
};

export const sendAccountVerificationEmail = async (toEmail, username, verificationLink) => {
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    subject: "Verifikasi Akun Flix",
    html: buildActionEmail({
      title: "Verifikasi Akun FLIX",
      greeting: `Halo, ${escapeHtml(username)}!`,
      body: "Akun kamu berhasil dibuat. Klik tombol di bawah ini untuk mengaktifkan akun FLIX kamu.",
      buttonText: "Verifikasi Akun",
      buttonUrl: verificationLink,
      note: "Link ini berlaku selama 24 jam. Kalau kamu tidak membuat akun FLIX, abaikan email ini."
    })
  });
};

export const sendLoginNotificationEmail = async (toEmail, username) => {
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    subject: "Notifikasi Login Akun Flix",
    html: `
      <h2>Halo, ${username}!</h2>
      <p>Akun Flix kamu baru saja login.</p>
      <p>Kalau ini bukan kamu, segera ganti password akunmu.</p>
    `
  });
};

export const sendPasswordResetEmail = async (toEmail, username, resetLink) => {
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    subject: "Reset Password Akun Flix",
    html: buildActionEmail({
      title: "Reset Password FLIX",
      greeting: `Halo, ${escapeHtml(username)}!`,
      body: "Kami menerima permintaan reset password untuk akun FLIX kamu. Klik tombol di bawah ini untuk membuat password baru.",
      buttonText: "Reset Password",
      buttonUrl: resetLink,
      note: "Link ini berlaku selama 30 menit. Kalau kamu tidak meminta reset password, abaikan email ini."
    })
  });
};
