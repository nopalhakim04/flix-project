import pool from "../config/db.js";

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const notificationsResult = await pool.query(
      `SELECT
          n.id_notification,
          n.recipient_user_id,
          n.actor_user_id,
          n.notification_type,
          n.id_post,
          n.id_comment,
          n.metadata,
          n.is_read,
          n.created_at,
          au.username AS actor_username,
          au.profile_image_url AS actor_profile_image_url,
          p.title AS post_title
       FROM flix.notifications n
       LEFT JOIN flix.users au ON n.actor_user_id = au.id_user
       LEFT JOIN flix.posts p ON n.id_post = p.id_post
       WHERE n.recipient_user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    const unreadResult = await pool.query(
      `SELECT COUNT(*)::INTEGER AS unread_count
       FROM flix.notifications
       WHERE recipient_user_id = $1 AND is_read = FALSE`,
      [userId],
    );

    return res.json({
      notifications: notificationsResult.rows,
      unread_count: unreadResult.rows[0]?.unread_count || 0,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil notifikasi",
      error: error.message,
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE flix.notifications
       SET is_read = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_notification = $1 AND recipient_user_id = $2
       RETURNING *`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Notifikasi tidak ditemukan",
      });
    }

    return res.json({
      message: "Notifikasi ditandai sudah dibaca",
      notification: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengubah status notifikasi",
      error: error.message,
    });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id_user;

    await pool.query(
      `UPDATE flix.notifications
       SET is_read = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE recipient_user_id = $1 AND is_read = FALSE`,
      [userId],
    );

    return res.json({
      message: "Semua notifikasi ditandai sudah dibaca",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengubah status notifikasi",
      error: error.message,
    });
  }
};
