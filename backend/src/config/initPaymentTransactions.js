import pool from "./db.js";

export const initializePaymentTransactionsTable = async () => {
  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE NOT NULL
  `);

  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS payment_proof TEXT
  `);

  await pool.query(`
    ALTER TABLE flix.users
    ALTER COLUMN payment_proof TYPE TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.payment_transactions (
      id_transaction BIGSERIAL PRIMARY KEY,
      id_user BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
      package_code VARCHAR(40) NOT NULL DEFAULT 'premium',
      package_name VARCHAR(120) NOT NULL DEFAULT 'Premium Bulanan',
      duration_months INTEGER NOT NULL DEFAULT 1,
      payment_method VARCHAR(50) NOT NULL DEFAULT 'qris',
      payment_method_detail VARCHAR(120),
      amount INTEGER NOT NULL DEFAULT 0,
      admin_fee INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      payer_name VARCHAR(160),
      payer_email VARCHAR(160),
      payer_phone VARCHAR(60),
      ewallet_phone VARCHAR(60),
      payment_proof TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      verified_by_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL,
      verified_at TIMESTAMP,
      premium_started_at TIMESTAMP,
      premium_expired_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT payment_transactions_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
    )
  `);

  await pool.query(`
    ALTER TABLE flix.payment_transactions
    ALTER COLUMN payment_proof DROP NOT NULL
  `);

  await pool.query(`
    ALTER TABLE flix.payment_transactions
    ALTER COLUMN payment_proof TYPE TEXT
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_payment_transactions_user
    ON flix.payment_transactions (id_user)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
    ON flix.payment_transactions (status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at
    ON flix.payment_transactions (created_at DESC)
  `);

  await pool.query(`
    INSERT INTO flix.payment_transactions (
      id_user,
      package_code,
      package_name,
      duration_months,
      payment_method,
      payment_method_detail,
      amount,
      admin_fee,
      total_amount,
      payer_name,
      payer_email,
      payment_proof,
      status,
      verified_at,
      premium_started_at,
      premium_expired_at,
      created_at,
      updated_at
    )
    SELECT
      u.id_user,
      'premium_yearly',
      'Premium Tahunan',
      12,
      'ewallet',
      'GoPay',
      249000,
      0,
      249000,
      u.username,
      u.email,
      NULLIF(u.payment_proof, ''),
      CASE WHEN u.is_premium = TRUE THEN 'approved' ELSE 'pending' END,
      CASE WHEN u.is_premium = TRUE THEN COALESCE(u.updated_at, CURRENT_TIMESTAMP) ELSE NULL END,
      CASE WHEN u.is_premium = TRUE THEN COALESCE(u.updated_at, CURRENT_TIMESTAMP) ELSE NULL END,
      CASE WHEN u.is_premium = TRUE THEN COALESCE(u.updated_at, CURRENT_TIMESTAMP) + INTERVAL '12 months' ELSE NULL END,
      COALESCE(u.updated_at, u.created_at, CURRENT_TIMESTAMP),
      COALESCE(u.updated_at, CURRENT_TIMESTAMP)
    FROM flix.users u
    WHERE (COALESCE(u.payment_proof, '') <> '' OR u.is_premium = TRUE)
      AND NOT EXISTS (
        SELECT 1
        FROM flix.payment_transactions pt
        WHERE pt.id_user = u.id_user
      )
  `);
};
