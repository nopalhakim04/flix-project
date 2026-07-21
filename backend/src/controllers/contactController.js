import pool from "../config/db.js";
import { initializeContactMessagesTable } from "../config/initContactMessages.js";

const allowedCategories = new Set([
  "bug_report",
  "kritik_saran",
  "kendala_akun",
  "pertanyaan_umum",
  "lainnya",
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createContactMessage = async (req, res) => {
  try {
    await initializeContactMessagesTable();

    const { name, email, subject, category, message } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCategory = String(category || "").trim();

    if (
      !String(name || "").trim() ||
      !normalizedEmail ||
      !String(subject || "").trim() ||
      !normalizedCategory ||
      !String(message || "").trim()
    ) {
      return res.status(400).json({
        message: "Semua field contact us wajib diisi"
      });
    }

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Format email tidak valid"
      });
    }

    if (!allowedCategories.has(normalizedCategory)) {
      return res.status(400).json({
        message: "Kategori pesan tidak valid"
      });
    }

    const result = await pool.query(
      `INSERT INTO flix.contact_messages
        (id_user, name, email, subject, category, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_contact_message, status, created_at`,
      [
        req.user?.id_user || null,
        String(name).trim(),
        normalizedEmail,
        String(subject).trim(),
        normalizedCategory,
        String(message).trim(),
      ]
    );

    return res.status(201).json({
      message: "Report berhasil dikirim dan masuk ke dashboard admin.",
      contactMessage: {
        id: Number(result.rows[0].id_contact_message),
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at,
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengirim pesan contact us",
      error: error.message
    });
  }
};
