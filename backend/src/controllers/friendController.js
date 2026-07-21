import pool from "../config/db.js";
import { createNotification } from "../services/notificationService.js";

export const getMyFriends = async (req, res) => {
  try {
    const userId = req.user.id_user;

    const result = await pool.query(
      `SELECT
          uf.id_friend,
          uf.created_at AS friend_since,
          u.id_user,
          u.username,
          u.email,
          u.profile_image_url,
          u.is_premium,
          u.subscription_plan
       FROM flix.user_friends uf
       JOIN flix.users u
         ON u.id_user = CASE
           WHEN uf.requester_user_id = $1 THEN uf.addressee_user_id
           ELSE uf.requester_user_id
         END
       WHERE (uf.requester_user_id = $1 OR uf.addressee_user_id = $1)
         AND uf.status = 'accepted'
       ORDER BY uf.created_at DESC`,
      [userId],
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil friendlist",
      error: error.message,
    });
  }
};

export const getMyFriendIds = async (req, res) => {
  try {
    const userId = req.user.id_user;

    const result = await pool.query(
      `SELECT
          CASE
            WHEN requester_user_id = $1 THEN addressee_user_id
            ELSE requester_user_id
          END AS id_user
       FROM flix.user_friends
       WHERE (requester_user_id = $1 OR addressee_user_id = $1)
         AND status = 'accepted'`,
      [userId],
    );

    return res.json(result.rows.map((row) => Number(row.id_user)));
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil data teman",
      error: error.message,
    });
  }
};

export const getPendingFriendRequests = async (req, res) => {
  try {
    const userId = req.user.id_user;

    const result = await pool.query(
      `SELECT
          uf.id_friend,
          uf.created_at AS requested_at,
          u.id_user,
          u.username,
          u.email,
          u.profile_image_url,
          u.is_premium,
          u.subscription_plan
       FROM flix.user_friends uf
       JOIN flix.users u ON u.id_user = uf.requester_user_id
       WHERE uf.addressee_user_id = $1
         AND uf.status = 'pending'
       ORDER BY uf.created_at DESC`,
      [userId],
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil permintaan pertemanan",
      error: error.message,
    });
  }
};

export const searchUsersForFriend = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const query = String(req.query.query || "").trim();

    if (query.length < 2) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT
          uf.id_friend,
          u.id_user,
          u.username,
          u.email,
          u.profile_image_url,
          u.is_premium,
          u.subscription_plan,
          CASE
            WHEN uf.status = 'accepted' THEN 'accepted'
            WHEN uf.status = 'pending' AND uf.requester_user_id = $1 THEN 'pending_sent'
            WHEN uf.status = 'pending' AND uf.addressee_user_id = $1 THEN 'pending_received'
            ELSE NULL
          END AS friendship_status
       FROM flix.users u
       LEFT JOIN flix.user_friends uf
         ON (
           (uf.requester_user_id = $1 AND uf.addressee_user_id = u.id_user)
           OR
           (uf.addressee_user_id = $1 AND uf.requester_user_id = u.id_user)
         )
       WHERE u.id_user <> $1
         AND (
           u.username ILIKE $2
           OR u.email ILIKE $2
         )
       ORDER BY
         CASE WHEN LOWER(u.username) LIKE LOWER($3) THEN 0 ELSE 1 END,
         u.username ASC
       LIMIT 8`,
      [userId, `%${query}%`, `${query}%`],
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mencari user",
      error: error.message,
    });
  }
};

export const addFriend = async (req, res) => {
  try {
    const requesterId = req.user.id_user;
    const addresseeId = Number(req.params.userId);

    if (!addresseeId || Number.isNaN(addresseeId)) {
      return res.status(400).json({
        message: "User tujuan tidak valid",
      });
    }

    if (Number(requesterId) === Number(addresseeId)) {
      return res.status(400).json({
        message: "Tidak bisa menambahkan diri sendiri sebagai teman",
      });
    }

    const userCheck = await pool.query(
      `SELECT id_user, username, email, profile_image_url, is_premium, subscription_plan
       FROM flix.users
       WHERE id_user = $1`,
      [addresseeId],
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const existingFriend = await pool.query(
      `SELECT id_friend, requester_user_id, addressee_user_id, status
       FROM flix.user_friends
       WHERE (requester_user_id = $1 AND addressee_user_id = $2)
          OR (requester_user_id = $2 AND addressee_user_id = $1)`,
      [requesterId, addresseeId],
    );

    if (existingFriend.rows.length > 0) {
      const existing = existingFriend.rows[0];
      const existingStatus =
        existing.status === "pending"
          ? Number(existing.requester_user_id) === Number(requesterId)
            ? "pending_sent"
            : "pending_received"
          : existing.status;

      return res.json({
        message:
          existing.status === "accepted"
            ? "User sudah ada di friendlist"
            : "Permintaan pertemanan sudah ada",
        status: existingStatus,
        friend: userCheck.rows[0],
      });
    }

    await pool.query(
      `INSERT INTO flix.user_friends (requester_user_id, addressee_user_id, status)
       VALUES ($1, $2, 'pending')`,
      [requesterId, addresseeId],
    );

    await createNotification({
      recipientUserId: addresseeId,
      actorUserId: requesterId,
      type: "friend_request",
      metadata: {
        target: "profile_friend_requests",
        status: "pending_profile_action",
      },
      dedupeKey: `friend_request:${requesterId}:${addresseeId}`,
    });

    return res.status(201).json({
      message: "Permintaan pertemanan berhasil dikirim",
      status: "pending_sent",
      friend: userCheck.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.json({
        message: "User sudah ada di friendlist",
      });
    }

    return res.status(500).json({
      message: "Gagal menambahkan teman",
      error: error.message,
    });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const friendRequestId = Number(req.params.friendId);

    if (!friendRequestId || Number.isNaN(friendRequestId)) {
      return res.status(400).json({
        message: "Permintaan pertemanan tidak valid",
      });
    }

    const result = await pool.query(
      `UPDATE flix.user_friends uf
       SET status = 'accepted',
           updated_at = CURRENT_TIMESTAMP
       FROM flix.users u
       WHERE uf.id_friend = $1
         AND uf.addressee_user_id = $2
         AND uf.status = 'pending'
         AND u.id_user = uf.requester_user_id
       RETURNING
         uf.id_friend,
         uf.created_at AS friend_since,
         u.id_user,
         u.username,
         u.email,
         u.profile_image_url,
         u.is_premium,
         u.subscription_plan`,
      [friendRequestId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Permintaan pertemanan tidak ditemukan",
      });
    }

    return res.json({
      message: "Permintaan pertemanan diterima",
      friend: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menerima permintaan pertemanan",
      error: error.message,
    });
  }
};

export const declineFriendRequest = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const friendRequestId = Number(req.params.friendId);

    if (!friendRequestId || Number.isNaN(friendRequestId)) {
      return res.status(400).json({
        message: "Permintaan pertemanan tidak valid",
      });
    }

    const result = await pool.query(
      `DELETE FROM flix.user_friends
       WHERE id_friend = $1
         AND addressee_user_id = $2
         AND status = 'pending'
       RETURNING id_friend`,
      [friendRequestId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Permintaan pertemanan tidak ditemukan",
      });
    }

    return res.json({
      message: "Permintaan pertemanan ditolak",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menolak permintaan pertemanan",
      error: error.message,
    });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const friendId = Number(req.params.userId);

    if (!friendId || Number.isNaN(friendId)) {
      return res.status(400).json({
        message: "User tujuan tidak valid",
      });
    }

    const result = await pool.query(
      `DELETE FROM flix.user_friends
       WHERE (requester_user_id = $1 AND addressee_user_id = $2)
          OR (requester_user_id = $2 AND addressee_user_id = $1)
       RETURNING id_friend`,
      [userId, friendId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Teman tidak ditemukan",
      });
    }

    return res.json({
      message: "Teman berhasil dihapus",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menghapus teman",
      error: error.message,
    });
  }
};
