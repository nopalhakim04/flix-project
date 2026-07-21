import pool from "./db.js";

export const initializeMovieReviewsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.movie_reviews (
      id_review SERIAL PRIMARY KEY,
      tmdb_movie_id INTEGER NOT NULL,
      id_user INTEGER NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
      parent_review_id INTEGER REFERENCES flix.movie_reviews(id_review) ON DELETE CASCADE,
      content TEXT NOT NULL,
      rating SMALLINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_movie_review_rating
        CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_movie_reviews_tmdb_movie_id
    ON flix.movie_reviews (tmdb_movie_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_movie_reviews_parent_review_id
    ON flix.movie_reviews (parent_review_id)
  `);

  await pool.query(`
    ALTER TABLE flix.movie_reviews
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'active'
  `);

  await pool.query(`
    ALTER TABLE flix.movie_reviews
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE flix.movie_reviews
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
          AND table_item.relname = 'movie_reviews'
          AND constraint_item.conname = 'chk_movie_reviews_moderation_status'
      ) THEN
        ALTER TABLE flix.movie_reviews
        ADD CONSTRAINT chk_movie_reviews_moderation_status
        CHECK (moderation_status IN ('active', 'blocked'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_movie_reviews_moderation_status
    ON flix.movie_reviews (moderation_status)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.movie_review_likes (
      id_like SERIAL PRIMARY KEY,
      id_review INTEGER NOT NULL REFERENCES flix.movie_reviews(id_review) ON DELETE CASCADE,
      id_user INTEGER NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_movie_review_likes UNIQUE (id_review, id_user)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_movie_review_likes_id_review
    ON flix.movie_review_likes (id_review)
  `);
};
