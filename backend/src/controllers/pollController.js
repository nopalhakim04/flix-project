import pool from "../config/db.js";
import { createNotification } from "../services/notificationService.js";

export const getPollByPostId = async (req, res) => {
  try {
    const { postId } = req.params;

    const pollResult = await pool.query(
      `SELECT id_poll, id_post
       FROM flix.post_polls
       WHERE id_post = $1`,
      [postId]
    );

    if (pollResult.rows.length === 0) {
      return res.status(404).json({
        message: "Polling tidak ditemukan"
      });
    }

    const poll = pollResult.rows[0];

    const optionsResult = await pool.query(
      `SELECT
          o.id_option,
          o.option_text,
          COUNT(v.id_vote) AS vote_count
       FROM flix.post_poll_options o
       LEFT JOIN flix.post_poll_votes v ON o.id_option = v.id_option
       WHERE o.id_poll = $1
       GROUP BY o.id_option
       ORDER BY o.id_option ASC`,
      [poll.id_poll]
    );

    return res.json({
      poll,
      options: optionsResult.rows
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil polling",
      error: error.message
    });
  }
};

export const votePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { option_id } = req.body;
    const userId = req.user.id_user;

    const optionCheck = await pool.query(
      `SELECT
          o.id_option,
          o.id_poll,
          pp.id_post,
          p.id_user AS post_owner_id
       FROM flix.post_poll_options o
       JOIN flix.post_polls pp ON o.id_poll = pp.id_poll
       JOIN flix.posts p ON pp.id_post = p.id_post
       WHERE o.id_option = $1 AND o.id_poll = $2`,
      [option_id, pollId]
    );

    if (optionCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Opsi polling tidak ditemukan"
      });
    }

    const existingVote = await pool.query(
      `SELECT id_vote
       FROM flix.post_poll_votes
       WHERE id_poll = $1 AND id_user = $2`,
      [pollId, userId]
    );

    if (existingVote.rows.length > 0) {
      await pool.query(
        `UPDATE flix.post_poll_votes
         SET id_option = $1
         WHERE id_poll = $2 AND id_user = $3`,
        [option_id, pollId, userId]
      );
    } else {
      await pool.query(
        `INSERT INTO flix.post_poll_votes (id_poll, id_option, id_user)
         VALUES ($1, $2, $3)`,
        [pollId, option_id, userId]
      );
    }

    await createNotification({
      recipientUserId: optionCheck.rows[0].post_owner_id,
      actorUserId: userId,
      type: "poll_vote",
      postId: optionCheck.rows[0].id_post,
      metadata: { poll_id: pollId, option_id },
      dedupeKey: `poll_vote:${pollId}:${userId}`,
    });

    return res.json({
      message: "Vote polling berhasil"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal vote polling",
      error: error.message
    });
  }
};
