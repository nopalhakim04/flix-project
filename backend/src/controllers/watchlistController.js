import pool from "../config/db.js";
import { initializeWatchlistTable } from "../config/initWatchlist.js";
import {
  getUserSubscriptionPlan,
  isPremiumOrExclusive,
} from "../middleware/subscriptionMiddleware.js";

const FREE_WATCHLIST_LIMIT = 10;

const mapWatchlistRow = (row) => ({
  id: Number(row.id_watchlist),
  mediaType: row.media_type,
  tmdbId: Number(row.tmdb_id),
  title: row.title,
  posterUrl: row.poster_url,
  releaseYear: row.release_year,
  rating: row.rating,
  metadata: row.metadata || {},
  createdAt: row.created_at,
});

export const getMyWatchlist = async (req, res) => {
  try {
    await initializeWatchlistTable();

    const result = await pool.query(
      `SELECT *
       FROM flix.user_watchlist
       WHERE id_user = $1
       ORDER BY created_at DESC, id_watchlist DESC`,
      [req.user.id_user],
    );

    return res.json(result.rows.map(mapWatchlistRow));
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil watchlist",
      error: error.message,
    });
  }
};

export const addToWatchlist = async (req, res) => {
  try {
    await initializeWatchlistTable();

    const userId = req.user.id_user;
    const mediaType = String(req.body.media_type || req.body.mediaType || "").toLowerCase();
    const tmdbId = Number(req.body.tmdb_id || req.body.tmdbId || req.body.id);
    const title = String(req.body.title || req.body.name || "").trim();

    if (!["movie", "tv"].includes(mediaType) || !tmdbId || !title) {
      return res.status(400).json({
        message: "Data watchlist tidak lengkap",
      });
    }

    const existingResult = await pool.query(
      `SELECT *
       FROM flix.user_watchlist
       WHERE id_user = $1 AND media_type = $2 AND tmdb_id = $3`,
      [userId, mediaType, tmdbId],
    );

    if (existingResult.rows.length) {
      return res.json({
        message: "Item sudah ada di watchlist",
        item: mapWatchlistRow(existingResult.rows[0]),
      });
    }

    const plan = await getUserSubscriptionPlan(userId);

    if (!isPremiumOrExclusive({ subscription_plan: plan })) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::INTEGER AS total
         FROM flix.user_watchlist
         WHERE id_user = $1`,
        [userId],
      );

      if (Number(countResult.rows[0]?.total || 0) >= FREE_WATCHLIST_LIMIT) {
        return res.status(403).json({
          message:
            "Watchlist Free maksimal 10 item. Upgrade ke Premium atau Eksklusif untuk watchlist unlimited.",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO flix.user_watchlist (
         id_user,
         media_type,
         tmdb_id,
         title,
         poster_url,
         release_year,
         rating,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        mediaType,
        tmdbId,
        title,
        String(req.body.poster_url || req.body.posterUrl || req.body.poster || "").trim() || null,
        String(req.body.release_year || req.body.releaseYear || req.body.year || "").trim() || null,
        String(req.body.rating || "").trim() || null,
        req.body.metadata || {},
      ],
    );

    return res.status(201).json({
      message: "Item berhasil disimpan ke watchlist",
      item: mapWatchlistRow(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menyimpan watchlist",
      error: error.message,
    });
  }
};

export const removeFromWatchlist = async (req, res) => {
  try {
    await initializeWatchlistTable();

    const mediaType = String(req.params.mediaType || "").toLowerCase();
    const tmdbId = Number(req.params.tmdbId);

    if (!["movie", "tv"].includes(mediaType) || !tmdbId) {
      return res.status(400).json({ message: "Data watchlist tidak valid" });
    }

    await pool.query(
      `DELETE FROM flix.user_watchlist
       WHERE id_user = $1 AND media_type = $2 AND tmdb_id = $3`,
      [req.user.id_user, mediaType, tmdbId],
    );

    return res.json({ message: "Item watchlist berhasil dihapus" });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menghapus watchlist",
      error: error.message,
    });
  }
};
