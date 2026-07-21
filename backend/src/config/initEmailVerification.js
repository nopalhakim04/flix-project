import pool from "./db.js";

export const initializeEmailVerificationTable = async () => {
  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE NOT NULL
  `);

  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP
  `);

  await pool.query(`
    UPDATE flix.users
    SET email_verified = TRUE,
        email_verified_at = COALESCE(email_verified_at, created_at, CURRENT_TIMESTAMP)
    WHERE email_verified = TRUE AND email_verified_at IS NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.email_verification_tokens (
      id_verification SERIAL PRIMARY KEY,
      id_user INTEGER NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash
    ON flix.email_verification_tokens (token_hash)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_id_user
    ON flix.email_verification_tokens (id_user)
  `);
};
