import pool from "./db.js";

export const initializeUserStatusColumns = async () => {
  // Tambah kolom is_active jika belum ada
  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL
  `);

  // Tambah kolom deactivated_at jika belum ada
  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP
  `);

  // Tambah kolom deactivated_by_user_id jika belum ada
  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS deactivated_by_user_id BIGINT
  `);

  // 1. TAMBAHKAN: Kolom is_premium jika belum ada
  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE NOT NULL
  `);

  // 2. TAMBAHKAN: Kolom payment_proof untuk menyimpan path bukti pembayaran
  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS payment_proof TEXT
  `);

  await pool.query(`
    ALTER TABLE flix.users
    ALTER COLUMN payment_proof TYPE TEXT
  `);

  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'free' NOT NULL
  `);

  await pool.query(`
    UPDATE flix.users
    SET subscription_plan = CASE
      WHEN subscription_plan IS NULL OR subscription_plan = '' THEN
        CASE WHEN is_premium = TRUE THEN 'premium' ELSE 'free' END
      WHEN subscription_plan NOT IN ('free', 'premium', 'exclusive') THEN
        CASE WHEN is_premium = TRUE THEN 'premium' ELSE 'free' END
      WHEN is_premium = TRUE AND subscription_plan = 'free' THEN 'premium'
      ELSE subscription_plan
    END
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('flix.payment_transactions') IS NOT NULL THEN
        UPDATE flix.users u
        SET subscription_plan = 'exclusive'
        WHERE EXISTS (
          SELECT 1
          FROM flix.payment_transactions pt
          WHERE pt.id_user = u.id_user
            AND pt.status = 'approved'
            AND (
              pt.premium_expired_at IS NULL
              OR pt.premium_expired_at > CURRENT_TIMESTAMP
            )
            AND (
              COALESCE(pt.duration_months, 1) >= 12
              OR LOWER(COALESCE(pt.package_code, '')) LIKE '%year%'
              OR LOWER(COALESCE(pt.package_name, '')) LIKE '%eksklusif%'
            )
        );
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_subscription_plan_check'
      ) THEN
        ALTER TABLE flix.users
        ADD CONSTRAINT users_subscription_plan_check
        CHECK (subscription_plan IN ('free', 'premium', 'exclusive'));
      END IF;
    END $$;
  `);

  // Tambah indeks untuk performa pencarian status aktif
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_is_active
    ON flix.users (is_active)
  `);
};
