import pool from "../config/db.js";
import { createNotification } from "../services/notificationService.js";

export const toggleLikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id_user;

    const postCheck = await pool.query(
      `SELECT id_post, id_user FROM flix.posts WHERE id_post = $1`,
      [postId],
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Post tidak ditemukan",
      });
    }

    const existingLike = await pool.query(
      `SELECT id_like
       FROM flix.post_likes
       WHERE id_user = $1 AND id_post = $2`,
      [userId, postId],
    );

    if (existingLike.rows.length > 0) {
      await pool.query(
        `DELETE FROM flix.post_likes
         WHERE id_like = $1`,
        [existingLike.rows[0].id_like],
      );

      return res.json({
        message: "Like dihapus",
      });
    }

    await pool.query(
      `INSERT INTO flix.post_likes (id_user, id_post)
       VALUES ($1, $2)`,
      [userId, postId],
    );

    await createNotification({
      recipientUserId: postCheck.rows[0].id_user,
      actorUserId: userId,
      type: "post_like",
      postId,
      dedupeKey: `post_like:${postId}:${userId}`,
    });

    return res.json({
      message: "Post berhasil di-like",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal memberi like",
      error: error.message,
    });
  }
};
