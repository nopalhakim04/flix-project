import pool from "./db.js";

export const initializeAdminMoviesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.admin_movies (
      id_admin_movie BIGSERIAL PRIMARY KEY,
      created_by_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL,
      title TEXT NOT NULL,
      release_year VARCHAR(12),
      duration VARCHAR(40),
      director TEXT,
      synopsis TEXT,
      cast_members TEXT[] NOT NULL DEFAULT '{}',
      poster_url TEXT,
      trailer_url TEXT,
      rating NUMERIC(3, 1),
      country TEXT,
      genres TEXT[] NOT NULL DEFAULT '{}',
      platforms TEXT[] NOT NULL DEFAULT '{}',
      moods TEXT[] NOT NULL DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_admin_movies_rating
        CHECK (rating IS NULL OR rating BETWEEN 0 AND 10)
    )
  `);

  await pool.query(`
    DO $$
    DECLARE
      constraint_record RECORD;
    BEGIN
      FOR constraint_record IN
        SELECT constraint_item.conname
        FROM pg_constraint constraint_item
        JOIN pg_class table_item ON table_item.oid = constraint_item.conrelid
        JOIN pg_namespace schema_item ON schema_item.oid = table_item.relnamespace
        WHERE schema_item.nspname = 'flix'
          AND table_item.relname = 'admin_movies'
          AND constraint_item.contype = 'c'
          AND pg_get_constraintdef(constraint_item.oid) ILIKE '%status%'
      LOOP
        EXECUTE format(
          'ALTER TABLE flix.admin_movies DROP CONSTRAINT IF EXISTS %I',
          constraint_record.conname
        );
      END LOOP;
    END $$;
  `);

  await pool.query(`
    UPDATE flix.admin_movies
    SET status = CASE
      WHEN LOWER(status) IN ('draf', 'draft') THEN 'Draft'
      ELSE 'Published'
    END
    WHERE status IS DISTINCT FROM CASE
      WHEN LOWER(status) IN ('draf', 'draft') THEN 'Draft'
      ELSE 'Published'
    END
  `);

  await pool.query(`
    ALTER TABLE flix.admin_movies
    ALTER COLUMN status SET DEFAULT 'Published'
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
          AND table_item.relname = 'admin_movies'
          AND constraint_item.conname = 'chk_admin_movies_status'
      ) THEN
        ALTER TABLE flix.admin_movies
        ADD CONSTRAINT chk_admin_movies_status
        CHECK (status IN ('Draft', 'Published'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_admin_movies_created_at
    ON flix.admin_movies (created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_admin_movies_status
    ON flix.admin_movies (status)
  `);
};
