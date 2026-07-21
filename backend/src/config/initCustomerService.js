import pool from "./db.js";

export const initializeCustomerServiceTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.customer_service_tickets (
      id_ticket BIGSERIAL PRIMARY KEY,
      ticket_code VARCHAR(40) NOT NULL UNIQUE,
      id_user BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL,
      category VARCHAR(30) NOT NULL CHECK (
        category IN ('account', 'payment', 'feature', 'other')
      ),
      subject VARCHAR(180) NOT NULL,
      description TEXT NOT NULL,
      detail JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(30) NOT NULL DEFAULT 'waiting_admin' CHECK (
        status IN ('waiting_admin', 'in_progress', 'done')
      ),
      assigned_admin_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL,
      resolution_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.customer_service_messages (
      id_message BIGSERIAL PRIMARY KEY,
      id_ticket BIGINT NOT NULL REFERENCES flix.customer_service_tickets(id_ticket) ON DELETE CASCADE,
      sender_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL,
      sender_type VARCHAR(20) NOT NULL CHECK (
        sender_type IN ('user', 'bot', 'admin', 'moderator', 'system')
      ),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.customer_service_attachments (
      id_attachment BIGSERIAL PRIMARY KEY,
      id_ticket BIGINT NOT NULL REFERENCES flix.customer_service_tickets(id_ticket) ON DELETE CASCADE,
      id_message BIGINT REFERENCES flix.customer_service_messages(id_message) ON DELETE CASCADE,
      uploaded_by_user_id BIGINT REFERENCES flix.users(id_user) ON DELETE SET NULL,
      file_url TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(120),
      file_size BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_service_tickets_status_created
    ON flix.customer_service_tickets (status, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_service_tickets_user_created
    ON flix.customer_service_tickets (id_user, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_service_messages_ticket_created
    ON flix.customer_service_messages (id_ticket, created_at ASC)
  `);
};
