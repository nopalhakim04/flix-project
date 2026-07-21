import pool from "../config/db.js";
import { createNotification } from "../services/notificationService.js";

export const getCommentsByPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id_user || null;

    const result = await pool.query(
      `SELECT
          c.id_comment,
          c.id_post,
          c.id_user,
          c.parent_comment_id,
          c.content,
          c.created_at,
          u.username,
          u.profile_image_url,
          u.is_premium,
          u.subscription_plan,
          CASE
            WHEN $2::BIGINT IS NULL OR c.id_user = $2 THEN FALSE
            ELSE EXISTS (
              SELECT 1
              FROM flix.user_friends uf
              WHERE uf.status = 'accepted'
                AND (
                  (uf.requester_user_id = $2 AND uf.addressee_user_id = c.id_user)
                  OR
                  (uf.requester_user_id = c.id_user AND uf.addressee_user_id = $2)
                )
            )
          END AS is_friend,
          CASE
            WHEN $2::BIGINT IS NULL THEN NULL
            WHEN c.id_user = $2 THEN 'self'
            ELSE (
              SELECT CASE
                WHEN uf.status = 'accepted' THEN 'accepted'
                WHEN uf.status = 'pending' AND uf.requester_user_id = $2 THEN 'pending_sent'
                WHEN uf.status = 'pending' AND uf.addressee_user_id = $2 THEN 'pending_received'
                ELSE uf.status
              END
              FROM flix.user_friends uf
              WHERE (
                  (uf.requester_user_id = $2 AND uf.addressee_user_id = c.id_user)
                  OR
                  (uf.requester_user_id = c.id_user AND uf.addressee_user_id = $2)
                )
              LIMIT 1
            )
          END AS friendship_status
       FROM flix.comments c
       JOIN flix.users u ON c.id_user = u.id_user
       WHERE c.id_post = $1
         AND COALESCE(c.moderation_status, 'active') <> 'blocked'
       ORDER BY c.id_comment ASC`,
      [postId, userId],
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil reply",
      error: error.message,
    });
  }
};

export const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parent_comment_id } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({
        message: "Isi reply tidak boleh kosong",
      });
    }

    const postCheck = await pool.query(
      `SELECT id_post, id_user
       FROM flix.posts
       WHERE id_post = $1
         AND COALESCE(moderation_status, 'active') <> 'blocked'`,
      [postId],
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Post tidak ditemukan",
      });
    }

    let parentComment = null;

    if (parent_comment_id) {
      const parentCheck = await pool.query(
        `SELECT id_comment, id_post, id_user
         FROM flix.comments
         WHERE id_comment = $1
           AND COALESCE(moderation_status, 'active') <> 'blocked'`,
        [parent_comment_id],
      );

      if (parentCheck.rows.length === 0) {
        return res.status(404).json({
          message: "Comment parent tidak ditemukan",
        });
      }

      if (Number(parentCheck.rows[0].id_post) !== Number(postId)) {
        return res.status(400).json({
          message: "Parent comment tidak sesuai dengan post ini",
        });
      }

      parentComment = parentCheck.rows[0];
    }

    const result = await pool.query(
      `INSERT INTO flix.comments (id_user, id_post, parent_comment_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id_user, postId, parent_comment_id || null, content],
    );

    const createdComment = result.rows[0];

    if (parentComment) {
      await createNotification({
        recipientUserId: parentComment.id_user,
        actorUserId: req.user.id_user,
        type: "comment_reply",
        postId,
        commentId: createdComment.id_comment,
        metadata: { parent_comment_id },
        dedupeKey: `comment_reply:${createdComment.id_comment}`,
      });
    }

    const postOwnerId = postCheck.rows[0].id_user;

    if (!parentComment || Number(parentComment.id_user) !== Number(postOwnerId)) {
      await createNotification({
        recipientUserId: postOwnerId,
        actorUserId: req.user.id_user,
        type: "post_comment",
        postId,
        commentId: createdComment.id_comment,
        metadata: { parent_comment_id: parent_comment_id || null },
        dedupeKey: `post_comment:${createdComment.id_comment}`,
      });
    }

    return res.status(201).json({
      message: "Reply berhasil dibuat",
      comment: createdComment,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal membuat reply",
      error: error.message,
    });
  }
};
