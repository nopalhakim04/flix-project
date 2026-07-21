CREATE TABLE IF NOT EXISTS flix.user_friends (
  id_friend BIGSERIAL PRIMARY KEY,
  requester_user_id BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
  addressee_user_id BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_friends_not_self CHECK (requester_user_id <> addressee_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_friends_unique_pair
ON flix.user_friends (
  LEAST(requester_user_id, addressee_user_id),
  GREATEST(requester_user_id, addressee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friends_requester
ON flix.user_friends (requester_user_id);

CREATE INDEX IF NOT EXISTS idx_user_friends_addressee
ON flix.user_friends (addressee_user_id);
