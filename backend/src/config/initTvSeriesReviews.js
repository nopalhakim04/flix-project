import pool from "./db.js";

export const initializeTvSeriesReviewsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.tv_series_reviews (
      id_review SERIAL PRIMARY KEY,
      tmdb_series_id INTEGER NOT NULL,
      id_user INTEGER NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
      parent_review_id INTEGER REFERENCES flix.tv_series_reviews(id_review) ON DELETE CASCADE,
      content TEXT NOT NULL,
      rating SMALLINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_tv_series_review_rating
        CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tv_series_reviews_tmdb_series_id
    ON flix.tv_series_reviews (tmdb_series_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tv_series_reviews_parent_review_id
    ON flix.tv_series_reviews (parent_review_id)
  `);

  await pool.query(`
    ALTER TABLE flix.tv_series_reviews
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'active'
  `);

  await pool.query(`
    ALTER TABLE flix.tv_series_reviews
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE flix.tv_series_reviews
    ADD COLUMN IF NOT EXISTS blocked_by_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_item
        JOIN pg_class table_item ON table_item.oid = constraint_item.conrelid
        JOIN pg_namespace schema_item ON schema_item.oid = table_item.relnamespace
        WHERE schema_item.nspname = 'flix'
          AND table_item.relname = 'tv_series_reviews'
          AND constraint_item.conname = 'chk_tv_series_reviews_moderation_status'
      ) THEN
        ALTER TABLE flix.tv_series_reviews
        ADD CONSTRAINT chk_tv_series_reviews_moderation_status
        CHECK (moderation_status IN ('active', 'blocked'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tv_series_reviews_moderation_status
    ON flix.tv_series_reviews (moderation_status)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.tv_series_review_likes (
      id_like SERIAL PRIMARY KEY,
      id_review INTEGER NOT NULL REFERENCES flix.tv_series_reviews(id_review) ON DELETE CASCADE,
      id_user INTEGER NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_tv_series_review_likes UNIQUE (id_review, id_user)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tv_series_review_likes_id_review
    ON flix.tv_series_review_likes (id_review)
  `);
};
