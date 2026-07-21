import pool from "../config/db.js";
import { createNotification } from "../services/notificationService.js";

const allowedReactions = ["love", "funny", "wow", "sad", "angry"];

export const reactToPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reaction_type } = req.body;
    const userId = req.user.id_user;

    if (!allowedReactions.includes(reaction_type)) {
      return res.status(400).json({
        message: "Reaction tidak valid"
      });
    }

    const postCheck = await pool.query(
      `SELECT id_post, id_user FROM flix.posts WHERE id_post = $1`,
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Post tidak ditemukan"
      });
    }

    const existingReaction = await pool.query(
      `SELECT id_reaction, reaction_type
       FROM flix.post_reactions
       WHERE id_user = $1 AND id_post = $2`,
      [userId, postId]
    );

    if (existingReaction.rows.length === 0) {
      await pool.query(
        `INSERT INTO flix.post_reactions (id_user, id_post, reaction_type)
         VALUES ($1, $2, $3)`,
        [userId, postId, reaction_type]
      );

      await createNotification({
        recipientUserId: postCheck.rows[0].id_user,
        actorUserId: userId,
        type: "post_reaction",
        postId,
        metadata: { reaction_type },
        dedupeKey: `post_reaction:${postId}:${userId}`,
      });

      return res.json({
        message: "Reaction berhasil ditambahkan"
      });
    }

    const currentReaction = existingReaction.rows[0];

    if (currentReaction.reaction_type === reaction_type) {
      await pool.query(
        `DELETE FROM flix.post_reactions
         WHERE id_reaction = $1`,
        [currentReaction.id_reaction]
      );

      return res.json({
        message: "Reaction dihapus"
      });
    }

    await pool.query(
      `UPDATE flix.post_reactions
       SET reaction_type = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_reaction = $2`,
      [reaction_type, currentReaction.id_reaction]
    );

    await createNotification({
      recipientUserId: postCheck.rows[0].id_user,
      actorUserId: userId,
      type: "post_reaction",
      postId,
      metadata: { reaction_type },
      dedupeKey: `post_reaction:${postId}:${userId}`,
    });

    return res.json({
      message: "Reaction berhasil diperbarui"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal memberi reaction",
      error: error.message
    });
  }
};
