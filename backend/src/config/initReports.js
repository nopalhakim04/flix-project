import pool from "./db.js";

export const initializeReportsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.reports (
      id_report BIGSERIAL PRIMARY KEY,
      reporter_user_id BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
      report_type VARCHAR(32) NOT NULL CHECK (
        report_type IN (
          'movie_review',
          'tv_series_review',
          'community_post',
          'community_reply',
          'user_profile'
        )
      ),
      category VARCHAR(40) NOT NULL CHECK (
        category IN (
          'spam',
          'harassment',
          'hate_speech',
          'violence',
          'sexual_content',
          'misinformation',
          'spoiler',
          'copyright',
          'other'
        )
      ),
      reason TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'reviewed', 'approved', 'rejected')
      ),
      movie_review_id BIGINT REFERENCES flix.movie_reviews(id_review) ON DELETE CASCADE,
      tv_series_review_id BIGINT REFERENCES flix.tv_series_reviews(id_review) ON DELETE CASCADE,
      community_post_id BIGINT REFERENCES flix.posts(id_post) ON DELETE CASCADE,
      community_comment_id BIGINT REFERENCES flix.comments(id_comment) ON DELETE CASCADE,
      reported_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_reports_single_target CHECK (
        (
          (CASE WHEN movie_review_id IS NULL THEN 0 ELSE 1 END) +
          (CASE WHEN tv_series_review_id IS NULL THEN 0 ELSE 1 END) +
          (CASE WHEN community_post_id IS NULL THEN 0 ELSE 1 END) +
          (CASE WHEN community_comment_id IS NULL THEN 0 ELSE 1 END) +
          (CASE WHEN reported_user_id IS NULL THEN 0 ELSE 1 END)
        ) = 1
      )
    )
  `);

  await pool.query(`
    ALTER TABLE flix.reports
    ADD COLUMN IF NOT EXISTS reported_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE CASCADE
  `);

  await pool.query(`
    ALTER TABLE flix.posts
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'active'
  `);

  await pool.query(`
    ALTER TABLE flix.posts
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE flix.posts
    ADD COLUMN IF NOT EXISTS blocked_by_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE flix.comments
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'active'
  `);

  await pool.query(`
    ALTER TABLE flix.comments
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE flix.comments
    ADD COLUMN IF NOT EXISTS blocked_by_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL
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
          AND table_item.relname = 'reports'
          AND constraint_item.contype = 'c'
          AND pg_get_constraintdef(constraint_item.oid) ILIKE '%report_type%'
      LOOP
        EXECUTE format(
          'ALTER TABLE flix.reports DROP CONSTRAINT IF EXISTS %I',
          constraint_record.conname
        );
      END LOOP;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_item
        JOIN pg_class table_item ON table_item.oid = constraint_item.conrelid
        JOIN pg_namespace schema_item ON schema_item.oid = table_item.relnamespace
        WHERE schema_item.nspname = 'flix'
          AND table_item.relname = 'reports'
          AND constraint_item.conname = 'chk_reports_report_type'
      ) THEN
        ALTER TABLE flix.reports
        ADD CONSTRAINT chk_reports_report_type
        CHECK (
          report_type IN (
            'movie_review',
            'tv_series_review',
            'community_post',
            'community_reply',
            'user_profile'
          )
        );
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE flix.reports
    DROP CONSTRAINT IF EXISTS chk_reports_single_target
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
          AND table_item.relname = 'reports'
          AND constraint_item.conname = 'chk_reports_single_target'
      ) THEN
        ALTER TABLE flix.reports
        ADD CONSTRAINT chk_reports_single_target
        CHECK (
          (
            (CASE WHEN movie_review_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN tv_series_review_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN community_post_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN community_comment_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN reported_user_id IS NULL THEN 0 ELSE 1 END)
          ) = 1
        );
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_reporter_created
    ON flix.reports (reporter_user_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_type_status_created
    ON flix.reports (report_type, status, created_at DESC)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_movie_review_user
    ON flix.reports (reporter_user_id, movie_review_id)
    WHERE movie_review_id IS NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_tv_series_review_user
    ON flix.reports (reporter_user_id, tv_series_review_id)
    WHERE tv_series_review_id IS NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_community_post_user
    ON flix.reports (reporter_user_id, community_post_id)
    WHERE community_post_id IS NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_community_comment_user
    ON flix.reports (reporter_user_id, community_comment_id)
    WHERE community_comment_id IS NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_profile_user
    ON flix.reports (reporter_user_id, reported_user_id)
    WHERE reported_user_id IS NOT NULL
  `);
};
