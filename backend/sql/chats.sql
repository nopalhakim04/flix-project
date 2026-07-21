CREATE TABLE IF NOT EXISTS flix.chat_conversations (
  id_conversation BIGSERIAL PRIMARY KEY,
  user_one_id BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
  user_two_id BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_chat_conversation_not_self CHECK (user_one_id <> user_two_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_unique_pair
ON flix.chat_conversations (
  LEAST(user_one_id, user_two_id),
  GREATEST(user_one_id, user_two_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_ordered_pair
ON flix.chat_conversations (user_one_id, user_two_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_one
ON flix.chat_conversations (user_one_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_two
ON flix.chat_conversations (user_two_id);

CREATE TABLE IF NOT EXISTS flix.chat_messages (
  id_message BIGSERIAL PRIMARY KEY,
  id_conversation BIGINT NOT NULL REFERENCES flix.chat_conversations(id_conversation) ON DELETE CASCADE,
  sender_user_id BIGINT NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
ON flix.chat_messages (id_conversation, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
ON flix.chat_messages (id_conversation, sender_user_id, is_read);
