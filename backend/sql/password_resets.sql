CREATE TABLE IF NOT EXISTS flix.password_reset_tokens (
  id_reset SERIAL PRIMARY KEY,
  id_user INTEGER NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
  ON flix.password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_id_user
  ON flix.password_reset_tokens (id_user);
