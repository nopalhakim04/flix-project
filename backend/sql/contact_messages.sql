CREATE TABLE IF NOT EXISTS flix.contact_messages (
  id_contact_message BIGSERIAL PRIMARY KEY,
  id_user BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  subject VARCHAR(180) NOT NULL,
  category VARCHAR(40) NOT NULL CHECK (
    category IN (
      'bug_report',
      'kritik_saran',
      'kendala_akun',
      'pertanyaan_umum',
      'lainnya'
    )
  ),
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewed', 'resolved', 'closed')
  ),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
ON flix.contact_messages (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_created
ON flix.contact_messages (id_user, created_at DESC);
