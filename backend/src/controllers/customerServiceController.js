import pool from "../config/db.js";
import { initializeCustomerServiceTables } from "../config/initCustomerService.js";
import { fileToDataUrl } from "../utils/uploadDataUrl.js";

const categoryLabels = {
  account: "Kendala Akun",
  payment: "Pembayaran",
  feature: "Fitur Website",
  other: "Lainnya",
};

const statusLabels = {
  waiting_admin: "Menunggu Admin",
  in_progress: "Sedang Ditangani",
  done: "Selesai",
};

const allowedCategories = new Set(Object.keys(categoryLabels));
const allowedStatuses = new Set(Object.keys(statusLabels));

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const createTicketCode = () =>
  `CS-${new Date().getFullYear()}${String(Date.now()).slice(-7)}-${Math.floor(
    100 + Math.random() * 900,
  )}`;

const getUserRole = (req) => req.user?.role || "registered_user";
const isAdminRole = (req) => ["admin", "moderator"].includes(getUserRole(req));

const mapTicket = (row) => ({
  id: Number(row.id_ticket),
  ticketCode: row.ticket_code,
  userId: row.id_user ? Number(row.id_user) : null,
  userName: row.user_name || row.username || "User FLIX",
  userEmail: row.user_email || row.email || "-",
  category: row.category,
  categoryLabel: categoryLabels[row.category] || "Lainnya",
  subject: row.subject,
  description: row.description,
  detail: row.detail || {},
  status: row.status,
  statusLabel: statusLabels[row.status] || "Menunggu Admin",
  assignedAdminId: row.assigned_admin_id ? Number(row.assigned_admin_id) : null,
  assignedAdminName: row.assigned_admin_name || null,
  resolutionNote: row.resolution_note || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  closedAt: row.closed_at,
  formattedDate: formatDateTime(row.created_at),
  formattedUpdatedAt: formatDateTime(row.updated_at),
});

const mapMessage = (row) => ({
  id: Number(row.id_message),
  ticketId: Number(row.id_ticket),
  senderUserId: row.sender_user_id ? Number(row.sender_user_id) : null,
  senderType: row.sender_type,
  senderName: row.sender_name || (row.sender_type === "bot" ? "FLIX Bot" : "System"),
  message: row.message,
  createdAt: row.created_at,
  formattedDate: formatDateTime(row.created_at),
  attachments: [],
});

const mapAttachment = (row) => ({
  id: Number(row.id_attachment),
  ticketId: Number(row.id_ticket),
  messageId: row.id_message ? Number(row.id_message) : null,
  fileUrl: row.file_url,
  fileName: row.file_name,
  fileType: row.file_type,
  fileSize: Number(row.file_size || 0),
  createdAt: row.created_at,
});

const parseDetail = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const getTicketById = async (ticketId) => {
  const result = await pool.query(
    `SELECT
        ticket.*,
        users.username AS user_name,
        users.email AS user_email,
        admin_user.username AS assigned_admin_name
     FROM flix.customer_service_tickets ticket
     LEFT JOIN flix.users users ON users.id_user = ticket.id_user
     LEFT JOIN flix.users admin_user ON admin_user.id_user = ticket.assigned_admin_id
     WHERE ticket.id_ticket = $1`,
    [ticketId],
  );

  return result.rows[0] ? mapTicket(result.rows[0]) : null;
};

const getTicketMessages = async (ticketId) => {
  const [messageResult, attachmentResult] = await Promise.all([
    pool.query(
      `SELECT
          message.*,
          users.username AS sender_name
       FROM flix.customer_service_messages message
       LEFT JOIN flix.users users ON users.id_user = message.sender_user_id
       WHERE message.id_ticket = $1
       ORDER BY message.created_at ASC`,
      [ticketId],
    ),
    pool.query(
      `SELECT *
       FROM flix.customer_service_attachments
       WHERE id_ticket = $1
       ORDER BY created_at ASC`,
      [ticketId],
    ),
  ]);

  const attachments = attachmentResult.rows.map(mapAttachment);
  const attachmentsByMessage = attachments.reduce((result, attachment) => {
    const key = attachment.messageId || "ticket";
    result[key] = [...(result[key] || []), attachment];
    return result;
  }, {});

  return {
    messages: messageResult.rows.map((row) => ({
      ...mapMessage(row),
      attachments: attachmentsByMessage[Number(row.id_message)] || [],
    })),
    ticketAttachments: attachmentsByMessage.ticket || [],
  };
};

const assertTicketAccess = (ticket, req) => {
  if (!ticket) {
    return { ok: false, status: 404, message: "Tiket tidak ditemukan" };
  }

  if (isAdminRole(req)) {
    return { ok: true };
  }

  if (Number(ticket.userId) === Number(req.user.id_user)) {
    return { ok: true };
  }

  return { ok: false, status: 403, message: "Kamu tidak punya akses ke tiket ini" };
};

const insertAttachments = async ({ db = pool, ticketId, messageId = null, userId, files = [] }) => {
  if (!files.length) {
    return [];
  }

  const rows = [];

  for (const file of files) {
    const result = await db.query(
      `INSERT INTO flix.customer_service_attachments
        (id_ticket, id_message, uploaded_by_user_id, file_url, file_name, file_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        ticketId,
        messageId,
        userId,
        fileToDataUrl(file),
        file.originalname,
        file.mimetype,
        file.size,
      ],
    );

    rows.push(mapAttachment(result.rows[0]));
  }

  return rows;
};

const notifyStaffNewTicket = async (client, ticket) => {
  const staffResult = await client.query(
    `SELECT users.id_user
     FROM flix.users users
     JOIN flix.roles roles ON roles.id_role = users.id_role
     WHERE roles.role_name IN ('admin', 'moderator')
       AND COALESCE(users.is_active, TRUE) = TRUE`,
  );

  for (const staff of staffResult.rows) {
    await client.query(
      `INSERT INTO flix.notifications
        (recipient_user_id, actor_user_id, notification_type, metadata, dedupe_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        staff.id_user,
        ticket.userId,
        "customer_service_ticket",
        JSON.stringify({
          ticketId: ticket.id,
          ticketCode: ticket.ticketCode,
          category: ticket.categoryLabel,
        }),
        `customer_service_ticket:${ticket.id}:${staff.id_user}`,
      ],
    );
  }
};

export const createCustomerServiceTicket = async (req, res) => {
  const client = await pool.connect();

  try {
    await initializeCustomerServiceTables();

    const userId = req.user.id_user;
    const category = String(req.body?.category || "").trim();
    const description = String(req.body?.description || "").trim();
    const subject = String(req.body?.subject || categoryLabels[category] || "Customer Service").trim();
    const detail = parseDetail(req.body?.detail);
    const extraInfo = String(detail?.extraInfo || "").trim();
    const userMessageText = extraInfo
      ? `${description}\n\nInformasi tambahan: ${extraInfo}`
      : description;

    if (!allowedCategories.has(category)) {
      return res.status(400).json({ message: "Kategori customer service tidak valid" });
    }

    if (!description) {
      return res.status(400).json({ message: "Deskripsi masalah wajib diisi" });
    }

    await client.query("BEGIN");

    const ticketResult = await client.query(
      `INSERT INTO flix.customer_service_tickets
        (ticket_code, id_user, category, subject, description, detail)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [createTicketCode(), userId, category, subject, description, JSON.stringify(detail)],
    );

    const ticket = mapTicket(ticketResult.rows[0]);

    const botMessage = await client.query(
      `INSERT INTO flix.customer_service_messages
        (id_ticket, sender_type, message)
       VALUES ($1, 'bot', $2)
       RETURNING *`,
      [
        ticket.id,
        `Halo, laporan kategori ${ticket.categoryLabel} sudah dibuat. Mohon tunggu admin atau moderator mengambil tiket ini.`,
      ],
    );

    const userMessage = await client.query(
      `INSERT INTO flix.customer_service_messages
        (id_ticket, sender_user_id, sender_type, message)
       VALUES ($1, $2, 'user', $3)
       RETURNING *`,
      [ticket.id, userId, userMessageText],
    );

    await insertAttachments({
      db: client,
      ticketId: ticket.id,
      messageId: Number(userMessage.rows[0].id_message),
      userId,
      files: req.files || [],
    });

    await client.query("COMMIT");

    notifyStaffNewTicket(pool, ticket).catch((error) => {
      console.error("Gagal mengirim notifikasi tiket customer service:", error.message);
    });

    const detailData = await getCustomerServiceTicketPayload(ticket.id);

    return res.status(201).json({
      message: "Tiket berhasil dibuat dan menunggu admin atau moderator.",
      ticket: detailData.ticket,
      messages: detailData.messages,
      attachments: detailData.attachments,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({
      message: "Gagal membuat tiket customer service",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const getCustomerServiceTicketPayload = async (ticketId) => {
  const ticket = await getTicketById(ticketId);
  const { messages, ticketAttachments } = await getTicketMessages(ticketId);

  return {
    ticket,
    messages,
    attachments: ticketAttachments,
  };
};

export const getMyCustomerServiceTickets = async (req, res) => {
  try {
    await initializeCustomerServiceTables();

    const result = await pool.query(
      `SELECT
          ticket.*,
          users.username AS user_name,
          users.email AS user_email,
          admin_user.username AS assigned_admin_name
       FROM flix.customer_service_tickets ticket
       LEFT JOIN flix.users users ON users.id_user = ticket.id_user
       LEFT JOIN flix.users admin_user ON admin_user.id_user = ticket.assigned_admin_id
       WHERE ticket.id_user = $1
       ORDER BY ticket.created_at DESC`,
      [req.user.id_user],
    );

    return res.json({
      tickets: result.rows.map(mapTicket),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil tiket customer service",
      error: error.message,
    });
  }
};

export const getCustomerServiceTicketDetail = async (req, res) => {
  try {
    await initializeCustomerServiceTables();

    const ticketId = Number(req.params.id);
    const payload = await getCustomerServiceTicketPayload(ticketId);
    const access = assertTicketAccess(payload.ticket, req);

    if (!access.ok) {
      return res.status(access.status).json({ message: access.message });
    }

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil detail tiket customer service",
      error: error.message,
    });
  }
};

export const addCustomerServiceMessage = async (req, res) => {
  const client = await pool.connect();

  try {
    await initializeCustomerServiceTables();

    const ticketId = Number(req.params.id);
    const ticket = await getTicketById(ticketId);
    const access = assertTicketAccess(ticket, req);
    const message = String(req.body?.message || "").trim();

    if (!access.ok) {
      return res.status(access.status).json({ message: access.message });
    }

    if (ticket.status === "done") {
      return res.status(400).json({ message: "Tiket sudah selesai dan tidak bisa dibalas" });
    }

    if (!message && !(req.files || []).length) {
      return res.status(400).json({ message: "Pesan atau lampiran wajib diisi" });
    }

    const role = getUserRole(req);

    if (["admin", "moderator"].includes(role)) {
      if (Number(ticket.assignedAdminId) !== Number(req.user.id_user)) {
        return res.status(403).json({
          message: "Ambil tiket terlebih dahulu sebelum membalas",
        });
      }
    }

    const senderType = ["admin", "moderator"].includes(role) ? role : "user";

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO flix.customer_service_messages
        (id_ticket, sender_user_id, sender_type, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticketId, req.user.id_user, senderType, message || "Mengirim lampiran"],
    );

    await insertAttachments({
      db: client,
      ticketId,
      messageId: Number(result.rows[0].id_message),
      userId: req.user.id_user,
      files: req.files || [],
    });

    await client.query(
      `UPDATE flix.customer_service_tickets
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id_ticket = $1`,
      [ticketId],
    );

    await client.query("COMMIT");

    const payload = await getCustomerServiceTicketPayload(ticketId);

    return res.status(201).json({
      message: "Pesan customer service berhasil dikirim",
      ...payload,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({
      message: "Gagal mengirim pesan customer service",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const getAdminCustomerServiceTickets = async (req, res) => {
  try {
    await initializeCustomerServiceTables();

    const result = await pool.query(
      `SELECT
          ticket.*,
          users.username AS user_name,
          users.email AS user_email,
          admin_user.username AS assigned_admin_name
       FROM flix.customer_service_tickets ticket
       LEFT JOIN flix.users users ON users.id_user = ticket.id_user
       LEFT JOIN flix.users admin_user ON admin_user.id_user = ticket.assigned_admin_id
       ORDER BY ticket.created_at DESC`,
    );

    const tickets = result.rows.map(mapTicket);
    const summary = tickets.reduce(
      (accumulator, ticket) => {
        accumulator.all += 1;
        accumulator[ticket.status] = (accumulator[ticket.status] || 0) + 1;
        return accumulator;
      },
      {
        all: 0,
        waiting_admin: 0,
        in_progress: 0,
        done: 0,
      },
    );

    return res.json({
      message: "Tiket customer service berhasil dimuat",
      summary,
      tickets,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil tiket customer service",
      error: error.message,
    });
  }
};

export const claimCustomerServiceTicket = async (req, res) => {
  try {
    await initializeCustomerServiceTables();

    const ticketId = Number(req.params.id);
    const ticket = await getTicketById(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: "Tiket tidak ditemukan" });
    }

    if (ticket.status === "done") {
      return res.status(400).json({ message: "Tiket sudah selesai" });
    }

    if (ticket.assignedAdminId && Number(ticket.assignedAdminId) !== Number(req.user.id_user)) {
      return res.status(403).json({ message: "Tiket sedang ditangani admin/moderator lain" });
    }

    await pool.query(
      `UPDATE flix.customer_service_tickets
       SET assigned_admin_id = $1,
           status = 'in_progress',
           updated_at = CURRENT_TIMESTAMP
       WHERE id_ticket = $2`,
      [req.user.id_user, ticketId],
    );

    await pool.query(
      `INSERT INTO flix.customer_service_messages
        (id_ticket, sender_user_id, sender_type, message)
       VALUES ($1, $2, 'system', $3)`,
      [ticketId, req.user.id_user, "Tiket sedang ditangani oleh admin/moderator."],
    );

    const payload = await getCustomerServiceTicketPayload(ticketId);

    return res.json({
      message: "Tiket berhasil diambil",
      ...payload,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil tiket",
      error: error.message,
    });
  }
};

export const closeCustomerServiceTicket = async (req, res) => {
  try {
    await initializeCustomerServiceTables();

    const ticketId = Number(req.params.id);
    const resolutionNote = String(req.body?.resolutionNote || "").trim();
    const ticket = await getTicketById(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: "Tiket tidak ditemukan" });
    }

    if (Number(ticket.assignedAdminId) !== Number(req.user.id_user)) {
      return res.status(403).json({
        message: "Hanya admin atau moderator penanggung jawab yang bisa menyelesaikan tiket",
      });
    }

    await pool.query(
      `UPDATE flix.customer_service_tickets
       SET status = 'done',
           resolution_note = $1,
           updated_at = CURRENT_TIMESTAMP,
           closed_at = CURRENT_TIMESTAMP
       WHERE id_ticket = $2`,
      [resolutionNote, ticketId],
    );

    await pool.query(
      `INSERT INTO flix.customer_service_messages
        (id_ticket, sender_user_id, sender_type, message)
       VALUES ($1, $2, 'system', $3)`,
      [ticketId, req.user.id_user, resolutionNote || "Tiket selesai ditangani."],
    );

    const payload = await getCustomerServiceTicketPayload(ticketId);

    return res.json({
      message: "Tiket customer service selesai",
      ...payload,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menyelesaikan tiket",
      error: error.message,
    });
  }
};
