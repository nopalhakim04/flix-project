import pool from "../config/db.js";

const getOrderedPair = (firstUserId, secondUserId) => [
  Math.min(Number(firstUserId), Number(secondUserId)),
  Math.max(Number(firstUserId), Number(secondUserId)),
];

const mapConversationRow = (row) => ({
  id_conversation: row.id_conversation,
  friend: {
    id_user: row.friend_user_id,
    username: row.friend_username,
    email: row.friend_email,
    profile_image_url: row.friend_profile_image_url,
    is_premium: row.friend_is_premium,
    subscription_plan: row.friend_subscription_plan,
  },
  last_message: row.last_message || "",
  last_message_at: row.last_message_at || row.updated_at || row.created_at,
  unread_count: Number(row.unread_count || 0),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getConversationForUser = async (conversationId, userId) => {
  const result = await pool.query(
    `SELECT
        cc.id_conversation,
        cc.user_one_id,
        cc.user_two_id,
        cc.created_at,
        cc.updated_at,
        friend.id_user AS friend_user_id,
        friend.username AS friend_username,
        friend.email AS friend_email,
        friend.profile_image_url AS friend_profile_image_url,
        friend.is_premium AS friend_is_premium,
        friend.subscription_plan AS friend_subscription_plan,
        lm.content AS last_message,
        lm.created_at AS last_message_at,
        COALESCE(uc.unread_count, 0) AS unread_count
     FROM flix.chat_conversations cc
     JOIN flix.users friend
       ON friend.id_user = CASE
         WHEN cc.user_one_id = $2 THEN cc.user_two_id
         ELSE cc.user_one_id
       END
     LEFT JOIN LATERAL (
       SELECT content, created_at
       FROM flix.chat_messages cm
       WHERE cm.id_conversation = cc.id_conversation
       ORDER BY cm.created_at DESC, cm.id_message DESC
       LIMIT 1
     ) lm ON TRUE
     LEFT JOIN (
       SELECT id_conversation, COUNT(*)::INTEGER AS unread_count
       FROM flix.chat_messages
       WHERE sender_user_id <> $2
         AND is_read = FALSE
       GROUP BY id_conversation
     ) uc ON uc.id_conversation = cc.id_conversation
     WHERE cc.id_conversation = $1
       AND (cc.user_one_id = $2 OR cc.user_two_id = $2)`,
    [conversationId, userId],
  );

  return result.rows[0] || null;
};

const ensureFriendship = async (firstUserId, secondUserId) => {
  const result = await pool.query(
    `SELECT id_friend
     FROM flix.user_friends
     WHERE status = 'accepted'
       AND (
         (requester_user_id = $1 AND addressee_user_id = $2)
         OR
         (requester_user_id = $2 AND addressee_user_id = $1)
       )
     LIMIT 1`,
    [firstUserId, secondUserId],
  );

  return result.rows.length > 0;
};

export const getMyConversations = async (req, res) => {
  try {
    const userId = req.user.id_user;

    const result = await pool.query(
      `SELECT
          cc.id_conversation,
          cc.created_at,
          cc.updated_at,
          friend.id_user AS friend_user_id,
          friend.username AS friend_username,
          friend.email AS friend_email,
          friend.profile_image_url AS friend_profile_image_url,
          friend.is_premium AS friend_is_premium,
          friend.subscription_plan AS friend_subscription_plan,
          lm.content AS last_message,
          lm.created_at AS last_message_at,
          COALESCE(uc.unread_count, 0) AS unread_count
       FROM flix.chat_conversations cc
       JOIN flix.users friend
         ON friend.id_user = CASE
           WHEN cc.user_one_id = $1 THEN cc.user_two_id
           ELSE cc.user_one_id
         END
       LEFT JOIN LATERAL (
         SELECT content, created_at
         FROM flix.chat_messages cm
         WHERE cm.id_conversation = cc.id_conversation
         ORDER BY cm.created_at DESC, cm.id_message DESC
         LIMIT 1
       ) lm ON TRUE
       LEFT JOIN (
         SELECT id_conversation, COUNT(*)::INTEGER AS unread_count
         FROM flix.chat_messages
         WHERE sender_user_id <> $1
           AND is_read = FALSE
         GROUP BY id_conversation
       ) uc ON uc.id_conversation = cc.id_conversation
       WHERE cc.user_one_id = $1 OR cc.user_two_id = $1
       ORDER BY COALESCE(lm.created_at, cc.updated_at, cc.created_at) DESC`,
      [userId],
    );

    return res.json(result.rows.map(mapConversationRow));
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil daftar chat",
      error: error.message,
    });
  }
};

export const startConversation = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const friendId = Number(req.params.userId);

    if (!friendId || Number.isNaN(friendId)) {
      return res.status(400).json({
        message: "User tujuan tidak valid",
      });
    }

    if (Number(userId) === Number(friendId)) {
      return res.status(400).json({
        message: "Tidak bisa membuat chat dengan diri sendiri",
      });
    }

    const userCheck = await pool.query(
      `SELECT id_user FROM flix.users WHERE id_user = $1`,
      [friendId],
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const canChat = await ensureFriendship(userId, friendId);

    if (!canChat) {
      return res.status(403).json({
        message: "Chat hanya bisa dilakukan dengan teman yang sudah diterima",
      });
    }

    const [userOneId, userTwoId] = getOrderedPair(userId, friendId);
    const conversationResult = await pool.query(
      `INSERT INTO flix.chat_conversations (user_one_id, user_two_id)
       VALUES ($1, $2)
       ON CONFLICT (user_one_id, user_two_id) DO NOTHING
       RETURNING id_conversation`,
      [userOneId, userTwoId],
    );
    let conversationId = conversationResult.rows[0]?.id_conversation;

    if (!conversationId) {
      const existingConversation = await pool.query(
        `SELECT id_conversation
         FROM flix.chat_conversations
         WHERE user_one_id = $1 AND user_two_id = $2`,
        [userOneId, userTwoId],
      );
      conversationId = existingConversation.rows[0]?.id_conversation;
    }

    const conversation = await getConversationForUser(
      conversationId,
      userId,
    );

    return res.status(201).json(mapConversationRow(conversation));
  } catch (error) {
    return res.status(500).json({
      message: "Gagal membuka chat",
      error: error.message,
    });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const conversationId = Number(req.params.conversationId);

    const conversation = await getConversationForUser(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({
        message: "Percakapan tidak ditemukan",
      });
    }

    await pool.query(
      `UPDATE flix.chat_messages
       SET is_read = TRUE
       WHERE id_conversation = $1
         AND sender_user_id <> $2
         AND is_read = FALSE`,
      [conversationId, userId],
    );

    const messagesResult = await pool.query(
      `SELECT
          cm.id_message,
          cm.id_conversation,
          cm.sender_user_id,
          cm.content,
          cm.is_read,
          cm.created_at,
          u.username AS sender_username,
          u.profile_image_url AS sender_profile_image_url,
          u.is_premium AS sender_is_premium,
          u.subscription_plan AS sender_subscription_plan
       FROM flix.chat_messages cm
       JOIN flix.users u ON u.id_user = cm.sender_user_id
       WHERE cm.id_conversation = $1
       ORDER BY cm.created_at ASC, cm.id_message ASC`,
      [conversationId],
    );

    return res.json({
      conversation: mapConversationRow(conversation),
      messages: messagesResult.rows,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil pesan",
      error: error.message,
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const conversationId = Number(req.params.conversationId);
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";

    if (!content) {
      return res.status(400).json({
        message: "Pesan tidak boleh kosong",
      });
    }

    const conversation = await getConversationForUser(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({
        message: "Percakapan tidak ditemukan",
      });
    }

    const friendId = Number(conversation.friend_user_id);
    const canChat = await ensureFriendship(userId, friendId);

    if (!canChat) {
      return res.status(403).json({
        message: "Chat hanya bisa dilakukan dengan teman yang sudah diterima",
      });
    }

    const messageResult = await pool.query(
      `INSERT INTO flix.chat_messages (id_conversation, sender_user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id_message, id_conversation, sender_user_id, content, is_read, created_at`,
      [conversationId, userId, content],
    );

    await pool.query(
      `UPDATE flix.chat_conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id_conversation = $1`,
      [conversationId],
    );

    return res.status(201).json({
      message: messageResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengirim pesan",
      error: error.message,
    });
  }
};
