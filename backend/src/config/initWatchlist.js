import pool from "./db.js";

export const initializeWatchlistTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.user_watchlist (
      id_watchlist BIGSERIAL PRIMARY KEY,
      id_user BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
      media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'tv')),
      tmdb_id BIGINT NOT NULL,
      title VARCHAR(255) NOT NULL,
      poster_url TEXT,
      release_year VARCHAR(20),
      rating VARCHAR(20),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (id_user, media_type, tmdb_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_watchlist_user
    ON flix.user_watchlist (id_user, created_at DESC)
  `);
};
