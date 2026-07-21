CREATE TABLE IF NOT EXISTS flix.notifications (
  id_notification BIGSERIAL PRIMARY KEY,
  recipient_user_id BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL,
  notification_type VARCHAR(50) NOT NULL,
  id_post BIGINT REFERENCES flix.posts(id_post) ON DELETE CASCADE,
  id_comment BIGINT REFERENCES flix.comments(id_comment) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb,
  dedupe_key VARCHAR(255) UNIQUE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
ON flix.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
ON flix.notifications (recipient_user_id, is_read);
