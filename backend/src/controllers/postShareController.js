import pool from "../config/db.js";
import { createNotification } from "../services/notificationService.js";

export const logPostShare = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id_user || null;

    const postCheck = await pool.query(
      `SELECT id_post, id_user FROM flix.posts WHERE id_post = $1`,
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Post tidak ditemukan"
      });
    }

    await pool.query(
      `INSERT INTO flix.post_shares (id_post, id_user)
       VALUES ($1, $2)`,
      [postId, userId]
    );

    if (userId) {
      await createNotification({
        recipientUserId: postCheck.rows[0].id_user,
        actorUserId: userId,
        type: "post_share",
        postId,
        dedupeKey: `post_share:${postId}:${userId}`,
      });
    }

    return res.json({
      message: "Share tercatat"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mencatat share",
      error: error.message
    });
  }
};
