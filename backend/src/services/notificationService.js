import pool from "../config/db.js";

export const createNotification = async ({
  recipientUserId,
  actorUserId,
  type,
  postId = null,
  commentId = null,
  metadata = {},
  dedupeKey = null,
}) => {
  if (!recipientUserId || !actorUserId || !type) {
    return null;
  }

  if (Number(recipientUserId) === Number(actorUserId)) {
    return null;
  }

  const result = await pool.query(
    `INSERT INTO flix.notifications (
       recipient_user_id,
       actor_user_id,
       notification_type,
       id_post,
       id_comment,
       metadata,
       dedupe_key
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (dedupe_key)
     DO UPDATE SET
       is_read = FALSE,
       metadata = EXCLUDED.metadata,
       id_post = EXCLUDED.id_post,
       id_comment = EXCLUDED.id_comment,
       created_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      recipientUserId,
      actorUserId,
      type,
      postId,
      commentId,
      JSON.stringify(metadata),
      dedupeKey,
    ],
  );

  return result.rows[0] || null;
};
