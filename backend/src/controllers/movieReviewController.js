import pool from "../config/db.js";

const parseMovieId = (value) => {
  const movieId = Number(value);
  return Number.isInteger(movieId) && movieId > 0 ? movieId : null;
};

const parseRating = (value) => {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
};

const parseReviewId = (value) => {
  const reviewId = Number(value);
  return Number.isInteger(reviewId) && reviewId > 0 ? reviewId : null;
};

export const getMovieReviews = async (req, res) => {
  try {
    const movieId = parseMovieId(req.params.movieId);

    if (!movieId) {
      return res.status(400).json({
        message: "ID film tidak valid",
      });
    }

    const reviewsResult = await pool.query(
      `SELECT
          mr.id_review,
          mr.tmdb_movie_id,
          mr.id_user,
          mr.parent_review_id,
          mr.content,
          mr.rating,
          mr.created_at,
          mr.updated_at,
          u.username,
          u.profile_image_url,
          u.is_premium,
          u.subscription_plan,
          COALESCE(COUNT(mrl.id_like), 0)::INTEGER AS like_count
       FROM flix.movie_reviews mr
       JOIN flix.users u ON mr.id_user = u.id_user
       LEFT JOIN flix.movie_review_likes mrl ON mr.id_review = mrl.id_review
       WHERE mr.tmdb_movie_id = $1
         AND COALESCE(mr.moderation_status, 'active') <> 'blocked'
         AND NOT EXISTS (
           SELECT 1
           FROM flix.reports report
           WHERE report.movie_review_id = mr.id_review
             AND report.status = 'approved'
         )
       GROUP BY mr.id_review, u.username, u.profile_image_url, u.is_premium, u.subscription_plan
       ORDER BY mr.created_at ASC, mr.id_review ASC`,
      [movieId],
    );

    const summaryResult = await pool.query(
      `SELECT
          COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::FLOAT AS average_rating,
          COUNT(*)::INTEGER AS review_count
       FROM flix.movie_reviews
       WHERE tmdb_movie_id = $1
         AND parent_review_id IS NULL
         AND COALESCE(moderation_status, 'active') <> 'blocked'
         AND NOT EXISTS (
           SELECT 1
           FROM flix.reports report
           WHERE report.movie_review_id = flix.movie_reviews.id_review
             AND report.status = 'approved'
         )
         AND rating IS NOT NULL`,
      [movieId],
    );

    return res.json({
      summary: summaryResult.rows[0],
      reviews: reviewsResult.rows,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil review film",
      error: error.message,
    });
  }
};

export const createMovieReview = async (req, res) => {
  try {
    const movieId = parseMovieId(req.params.movieId);
    const { content, rating, parent_review_id } = req.body;

    if (!movieId) {
      return res.status(400).json({
        message: "ID film tidak valid",
      });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({
        message: "Isi review tidak boleh kosong",
      });
    }

    const parentId = parent_review_id ? Number(parent_review_id) : null;
    let reviewRating = null;

    if (parentId) {
      const parentCheck = await pool.query(
        `SELECT id_review, tmdb_movie_id
         FROM flix.movie_reviews
         WHERE id_review = $1`,
        [parentId],
      );

      if (parentCheck.rows.length === 0) {
        return res.status(404).json({
          message: "Review parent tidak ditemukan",
        });
      }

      if (Number(parentCheck.rows[0].tmdb_movie_id) !== movieId) {
        return res.status(400).json({
          message: "Reply tidak sesuai dengan film ini",
        });
      }
    } else {
      reviewRating = parseRating(rating);

      if (!reviewRating) {
        return res.status(400).json({
          message: "Rating review wajib 1 sampai 5",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO flix.movie_reviews
        (tmdb_movie_id, id_user, parent_review_id, content, rating)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [movieId, req.user.id_user, parentId, content.trim(), reviewRating],
    );

    return res.status(201).json({
      message: parentId ? "Reply review berhasil dibuat" : "Review berhasil dibuat",
      review: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal membuat review film",
      error: error.message,
    });
  }
};

export const updateMovieReview = async (req, res) => {
  try {
    const reviewId = parseReviewId(req.params.reviewId);
    const { content, rating } = req.body;

    if (!reviewId) {
      return res.status(400).json({
        message: "ID review tidak valid",
      });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({
        message: "Isi review tidak boleh kosong",
      });
    }

    const reviewCheck = await pool.query(
      `SELECT id_review, id_user, parent_review_id
       FROM flix.movie_reviews
       WHERE id_review = $1`,
      [reviewId],
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Review tidak ditemukan",
      });
    }

    const review = reviewCheck.rows[0];

    if (Number(review.id_user) !== Number(req.user.id_user)) {
      return res.status(403).json({
        message: "Kamu tidak punya akses untuk mengubah review ini",
      });
    }

    const reviewRating = review.parent_review_id ? null : parseRating(rating);

    if (!review.parent_review_id && !reviewRating) {
      return res.status(400).json({
        message: "Rating review wajib 1 sampai 5",
      });
    }

    const result = await pool.query(
      `UPDATE flix.movie_reviews
       SET content = $1,
           rating = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_review = $3
       RETURNING *`,
      [content.trim(), reviewRating, reviewId],
    );

    return res.json({
      message: "Review berhasil diperbarui",
      review: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengubah review film",
      error: error.message,
    });
  }
};

export const deleteMovieReview = async (req, res) => {
  try {
    const reviewId = parseReviewId(req.params.reviewId);

    if (!reviewId) {
      return res.status(400).json({
        message: "ID review tidak valid",
      });
    }

    const reviewCheck = await pool.query(
      `SELECT id_review, id_user
       FROM flix.movie_reviews
       WHERE id_review = $1`,
      [reviewId],
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Review tidak ditemukan",
      });
    }

    if (Number(reviewCheck.rows[0].id_user) !== Number(req.user.id_user)) {
      return res.status(403).json({
        message: "Kamu tidak punya akses untuk menghapus review ini",
      });
    }

    await pool.query(`DELETE FROM flix.movie_reviews WHERE id_review = $1`, [
      reviewId,
    ]);

    return res.json({
      message: "Review berhasil dihapus",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menghapus review film",
      error: error.message,
    });
  }
};

export const toggleLikeMovieReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.reviewId);

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        message: "ID review tidak valid",
      });
    }

    const reviewCheck = await pool.query(
      `SELECT id_review FROM flix.movie_reviews WHERE id_review = $1`,
      [reviewId],
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Review tidak ditemukan",
      });
    }

    const existingLike = await pool.query(
      `SELECT id_like
       FROM flix.movie_review_likes
       WHERE id_review = $1 AND id_user = $2`,
      [reviewId, req.user.id_user],
    );

    if (existingLike.rows.length > 0) {
      await pool.query(
        `DELETE FROM flix.movie_review_likes WHERE id_like = $1`,
        [existingLike.rows[0].id_like],
      );

      return res.json({
        message: "Like review dihapus",
      });
    }

    await pool.query(
      `INSERT INTO flix.movie_review_likes (id_review, id_user)
       VALUES ($1, $2)`,
      [reviewId, req.user.id_user],
    );

    return res.json({
      message: "Review berhasil di-like",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal memberi like review",
      error: error.message,
    });
  }
};
