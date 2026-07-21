import pool from "../config/db.js";

export const recordPostView = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id_user;

    const postCheck = await pool.query(
      `SELECT id_post FROM flix.posts WHERE id_post = $1`,
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Post tidak ditemukan"
      });
    }

    const insertResult = await pool.query(
      `INSERT INTO flix.post_views (id_post, id_user)
       VALUES ($1, $2)
       ON CONFLICT (id_post, id_user) DO NOTHING`,
      [postId, userId]
    );

    const viewResult = await pool.query(
      `SELECT COUNT(*) AS view_count
       FROM flix.post_views
       WHERE id_post = $1`,
      [postId]
    );

    return res.json({
      message:
        insertResult.rowCount > 0
          ? "View tercatat"
          : "View sudah pernah tercatat",
      viewed: insertResult.rowCount > 0,
      view_count: Number(viewResult.rows[0].view_count)
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mencatat view post",
      error: error.message
    });
  }
};
