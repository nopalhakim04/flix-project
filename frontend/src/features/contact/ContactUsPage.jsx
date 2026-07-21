import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FaComments,
  FaFacebookF,
  FaHeadset,
  FaPaperPlane,
  FaPlus,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";
import SiteNavbar from "@/components/layout/SiteNavbar";
import { resolveMediaUrl } from "@/utils/media";
import "./ContactUsPage.css";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

const contactCategories = [
  { value: "bug_report", label: "Bug Report" },
  { value: "kritik_saran", label: "Kritik & Saran" },
  { value: "kendala_akun", label: "Kendala Akun" },
  { value: "pertanyaan_umum", label: "Pertanyaan Umum" },
  { value: "lainnya", label: "Lainnya" },
];

const serviceCategories = [
  { value: "account", label: "Kendala Akun" },
  { value: "payment", label: "Pembayaran" },
  { value: "feature", label: "Fitur Website" },
  { value: "other", label: "Lainnya" },
];

const extraPrompts = {
  account: "Tuliskan username/email yang bermasalah. Jika ada, unggah screenshot bukti.",
  payment: "Tuliskan kode transaksi atau invoice. Jika ada, unggah bukti pembayaran.",
  feature: "Tuliskan nama fitur yang bermasalah. Jika ada, unggah screenshot bukti.",
  other: "Tambahkan informasi lain yang menurut kamu perlu diketahui tim FLIX.",
};

const maxAttachmentCount = 2;
const maxAttachmentBytes = 2 * 1024 * 1024;
const maxTotalAttachmentBytes = 3 * 1024 * 1024;
const allowedAttachmentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const allowedAttachmentExtensions = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx"]);

const formatFileSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

const getAuthHeaders = (token) => {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const createInitialBotMessages = () => [
  {
    id: "bot-welcome",
    senderType: "bot",
    message: "Halo, selamat datang di Customer Service FLIX. Pilih kategori laporan terlebih dahulu.",
    formattedDate: "Sekarang",
  },
];

function ContactUsPage() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("token") || "");
  const user = useMemo(() => getStoredUser(), []);
  const [activeView, setActiveView] = useState("form");
  const [form, setForm] = useState({
    name: user?.username || "",
    email: user?.email || "",
    subject: "",
    category: "bug_report",
    message: "",
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatSaving, setChatSaving] = useState(false);
  const [chatStep, setChatStep] = useState("category");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatFiles, setChatFiles] = useState([]);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [ticketMessages, setTicketMessages] = useState(createInitialBotMessages);
  const [ticketAttachments, setTicketAttachments] = useState([]);

  const isTicketDone = currentTicket?.status === "done";
  const currentCategoryLabel =
    serviceCategories.find((category) => category.value === selectedCategory)?.label ||
    currentTicket?.categoryLabel ||
    "";

  const setTicketPayload = (payload) => {
    if (payload?.ticket) {
      setCurrentTicket(payload.ticket);
    }

    if (Array.isArray(payload?.messages)) {
      setTicketMessages(payload.messages);
    }

    if (Array.isArray(payload?.attachments)) {
      setTicketAttachments(payload.attachments);
    }
  };

  const resetChatFlow = () => {
    setCurrentTicket(null);
    setTicketMessages(createInitialBotMessages());
    setTicketAttachments([]);
    setChatStep("category");
    setSelectedCategory(null);
    setIssueDescription("");
    setExtraInfo("");
    setChatDraft("");
    setChatFiles([]);
    setChatError("");
  };

  const clearExpiredSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthToken("");
    setCurrentTicket(null);
    setTicketMessages(createInitialBotMessages());
    setTicketAttachments([]);
    setChatStep("category");
    setSelectedCategory(null);
    setIssueDescription("");
    setExtraInfo("");
    setChatDraft("");
    setChatFiles([]);
  };

  const isAuthError = (error) => {
    return error.response?.status === 401 || error.response?.status === 403;
  };

  useEffect(() => {
    if (activeView !== "chat" || !authToken) {
      return;
    }

    let isMounted = true;

    const loadLatestTicket = async () => {
      try {
        setChatError("");
        const response = await axios.get(`${apiUrl}/api/customer-service/tickets`, {
          headers: getAuthHeaders(authToken),
        });
        const latestOpenTicket = response.data.tickets?.find((ticket) => ticket.status !== "done");
        const latestTicket = latestOpenTicket || response.data.tickets?.[0];

        if (!isMounted || !latestTicket) {
          return;
        }

        const detailResponse = await axios.get(
          `${apiUrl}/api/customer-service/tickets/${latestTicket.id}`,
          {
            headers: getAuthHeaders(authToken),
          },
        );
        setTicketPayload(detailResponse.data);
        setChatStep("ticket");
      } catch (error) {
        if (isMounted) {
          if (isAuthError(error)) {
            clearExpiredSession();
            setChatError("Sesi login sudah kedaluwarsa. Login ulang untuk membuka Customer Service.");
            return;
          }

          setChatError("Tiket customer service belum bisa dimuat.");
        }
      }
    };

    loadLatestTicket();

    return () => {
      isMounted = false;
    };
  }, [activeView, authToken]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.message.trim()) {
      setErrorMessage("Isi pesan tidak boleh kosong");
      return;
    }

    try {
      setSaving(true);
      setSuccessMessage("");
      setErrorMessage("");
      const response = await axios.post(`${apiUrl}/api/contact-us`, form, {
        headers: getAuthHeaders(authToken),
      });

      setSuccessMessage(
        response.data.message || "Report berhasil dikirim dan masuk ke dashboard admin.",
      );
      setForm((currentForm) => ({
        ...currentForm,
        subject: "",
        category: "bug_report",
        message: "",
      }));
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal mengirim pesan");
    } finally {
      setSaving(false);
    }
  };

  const addLocalChatMessage = (message) => {
    setTicketMessages((messages) => [
      ...messages,
      {
        id: `${Date.now()}-${Math.random()}`,
        formattedDate: "Sekarang",
        ...message,
      },
    ]);
  };

  const handleSelectServiceCategory = (category) => {
    setSelectedCategory(category.value);
    setChatStep("description");
    addLocalChatMessage({
      senderType: "user",
      message: category.label,
    });
    addLocalChatMessage({
      senderType: "bot",
      message: "Ceritakan masalah kamu secara singkat.",
    });
  };

  const handleDescriptionSubmit = (event) => {
    event.preventDefault();
    const text = chatDraft.trim();

    if (!text) {
      return;
    }

    setIssueDescription(text);
    setChatDraft("");
    setChatStep("extra");
    addLocalChatMessage({
      senderType: "user",
      message: text,
    });
    addLocalChatMessage({
      senderType: "bot",
      message: extraPrompts[selectedCategory] || extraPrompts.other,
    });
  };

  const validateAttachmentFiles = (files) => {
    if (files.length > maxAttachmentCount) {
      return `Lampiran maksimal ${maxAttachmentCount} file.`;
    }

    const invalidTypeFile = files.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      return !allowedAttachmentTypes.has(file.type) && !allowedAttachmentExtensions.has(extension);
    });

    if (invalidTypeFile) {
      return "Lampiran harus berupa gambar, PDF, DOC, atau DOCX.";
    }

    const oversizedFile = files.find((file) => file.size > maxAttachmentBytes);

    if (oversizedFile) {
      return `Ukuran ${oversizedFile.name} melebihi ${formatFileSize(maxAttachmentBytes)}.`;
    }

    const totalSize = files.reduce((total, file) => total + file.size, 0);

    if (totalSize > maxTotalAttachmentBytes) {
      return `Total lampiran maksimal ${formatFileSize(maxTotalAttachmentBytes)}.`;
    }

    return "";
  };

  const handleChatFilesChange = (event) => {
    const files = Array.from(event.target.files || []);
    const validationMessage = validateAttachmentFiles(files);

    if (validationMessage) {
      setChatError(validationMessage);
      setChatFiles([]);
      event.target.value = "";
      return;
    }

    setChatError("");
    setChatFiles(files);
  };

  const handleCreateTicket = async (event) => {
    event.preventDefault();
    const text = chatDraft.trim();
    const finalExtraInfo = text || extraInfo;
    const validationMessage = validateAttachmentFiles(chatFiles);

    if (validationMessage) {
      setChatError(validationMessage);
      return;
    }

    try {
      setChatSaving(true);
      setChatError("");

      if (!authToken) {
        throw new Error("Login dulu untuk membuat tiket customer service.");
      }

      const formData = new FormData();
      formData.append("category", selectedCategory);
      formData.append("subject", currentCategoryLabel || "Customer Service FLIX");
      formData.append("description", issueDescription);
      formData.append(
        "detail",
        JSON.stringify({
          extraInfo: finalExtraInfo,
          requestedFields: extraPrompts[selectedCategory] || extraPrompts.other,
        }),
      );
      chatFiles.forEach((file) => formData.append("attachments", file));

      const response = await axios.post(`${apiUrl}/api/customer-service/tickets`, formData, {
        headers: {
          ...getAuthHeaders(authToken),
        },
      });

      setTicketPayload(response.data);
      setChatStep("ticket");
      setChatDraft("");
      setExtraInfo("");
      setChatFiles([]);
    } catch (error) {
      if (isAuthError(error)) {
        clearExpiredSession();
        setChatError("Sesi login sudah kedaluwarsa. Login ulang untuk membuat tiket Customer Service.");
        return;
      }

      setChatError(error.response?.data?.message || error.message || "Gagal membuat tiket.");
    } finally {
      setChatSaving(false);
    }
  };

  const handleTicketReply = async (event) => {
    event.preventDefault();

    if (!currentTicket || isTicketDone) {
      return;
    }

    const text = chatDraft.trim();

    if (!text && !chatFiles.length) {
      return;
    }

    const validationMessage = validateAttachmentFiles(chatFiles);

    if (validationMessage) {
      setChatError(validationMessage);
      return;
    }

    try {
      setChatSaving(true);
      setChatError("");

      const formData = new FormData();
      formData.append("message", text);
      chatFiles.forEach((file) => formData.append("attachments", file));

      const response = await axios.post(
        `${apiUrl}/api/customer-service/tickets/${currentTicket.id}/messages`,
        formData,
        {
          headers: {
            ...getAuthHeaders(authToken),
          },
        },
      );

      setTicketPayload(response.data);
      setChatDraft("");
      setChatFiles([]);
    } catch (error) {
      if (isAuthError(error)) {
        clearExpiredSession();
        setChatError("Sesi login sudah kedaluwarsa. Login ulang untuk mengirim pesan Customer Service.");
        return;
      }

      setChatError(error.response?.data?.message || "Gagal mengirim pesan.");
    } finally {
      setChatSaving(false);
    }
  };

  const renderAttachmentLinks = (attachments = []) => {
    if (!attachments.length) {
      return null;
    }

    return (
      <div className="contact-chatroom__attachments">
        {attachments.map((attachment) => (
          <a
            key={attachment.id}
            href={resolveMediaUrl(attachment.fileUrl)}
            target="_blank"
            rel="noreferrer"
          >
            {attachment.fileName}
          </a>
        ))}
      </div>
    );
  };

  const renderChatInput = () => {
    if (!authToken) {
      return (
        <div className="contact-chatroom__readonly">
          Login dulu untuk membuat tiket dan chat dengan Customer Service.
          <Link to="/login">Login</Link>
        </div>
      );
    }

    if (isTicketDone) {
      return (
        <div className="contact-chatroom__readonly">
          Tiket ini sudah selesai. Buat tiket baru jika masih ada kendala.
          <button type="button" onClick={resetChatFlow}>
            <FaPlus />
            Tiket Baru
          </button>
        </div>
      );
    }

    if (chatStep === "category" && !currentTicket) {
      return (
        <div className="contact-chatroom__categories">
          {serviceCategories.map((category) => (
            <button
              type="button"
              key={category.value}
              onClick={() => handleSelectServiceCategory(category)}
            >
              {category.label}
            </button>
          ))}
        </div>
      );
    }

    const submitHandler =
      chatStep === "description"
        ? handleDescriptionSubmit
        : currentTicket
          ? handleTicketReply
          : handleCreateTicket;

    const placeholder =
      chatStep === "description"
        ? "Jelaskan masalah kamu..."
        : currentTicket
          ? "Balas pesan customer service..."
          : "Tambahkan informasi pendukung...";

    return (
      <form className="contact-chatroom__input" onSubmit={submitHandler}>
        <div className="contact-chatroom__composer">
          <input
            type="text"
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder={placeholder}
          />
          {chatStep !== "description" && (
            <label className="contact-chatroom__file">
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx"
                onChange={handleChatFilesChange}
              />
              Bukti
            </label>
          )}
        </div>
        <button type="submit" aria-label="Kirim pesan customer service" disabled={chatSaving}>
          <FaPaperPlane />
        </button>
      </form>
    );
  };

  return (
    <main className="contact-page">
      <SiteNavbar mode="fixed" />

      <section className="contact-shell">
        <div className="contact-card">
          <div className="contact-card__intro">
            <span>Contact Us</span>
            <h1>Hubungi Tim FLIX</h1>
            <p>
              Punya pertanyaan, menemukan bug, atau ingin memberikan saran?
              Kirim laporan ke tim FLIX melalui form atau Customer Service Chat.
            </p>
          </div>

          <div className="contact-view-switch" aria-label="Pilih mode contact us">
            <button
              type="button"
              className={activeView === "form" ? "is-active" : ""}
              onClick={() => setActiveView("form")}
            >
              <FaComments />
              Form Laporan / Kritik dan Saran
            </button>
            <button
              type="button"
              className={activeView === "chat" ? "is-active" : ""}
              onClick={() => setActiveView("chat")}
            >
              <FaHeadset />
              Customer Service
            </button>
          </div>

          {activeView === "form" ? (
            <>
              {successMessage && (
                <p className="contact-alert contact-alert--success">{successMessage}</p>
              )}
              {errorMessage && <p className="contact-alert">{errorMessage}</p>}

              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="contact-form__grid">
                  <label>
                    Nama Pengguna
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </label>
                </div>

                <label>
                  Subjek Pesan
                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label>
                  Kategori Pesan
                  <select name="category" value={form.category} onChange={handleChange} required>
                    {contactCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Isi Pesan
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={7}
                    required
                  />
                </label>

                <button type="submit" disabled={saving}>
                  <FaPaperPlane />
                  {saving ? "Mengirim..." : "Kirim ke Report Admin"}
                </button>
              </form>
            </>
          ) : (
            <section className="contact-chatroom" aria-label="Customer service chatroom">
              <div className="contact-chatroom__header">
                <span className="contact-chatroom__avatar">
                  <FaHeadset />
                </span>
                <div>
                  <h2>Customer Service FLIX</h2>
                  <p>
                    {currentTicket
                      ? `${currentTicket.ticketCode} - ${currentTicket.statusLabel}`
                      : "Chatbot akan mengumpulkan informasi sebelum diteruskan ke admin/moderator."}
                  </p>
                </div>
                {currentTicket && (
                  <button type="button" className="contact-chatroom__new-ticket" onClick={resetChatFlow}>
                    Tiket Baru
                  </button>
                )}
              </div>

              {chatError && <p className="contact-alert">{chatError}</p>}

              <div className="contact-chatroom__body">
                {ticketMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`contact-chatroom__message ${
                      message.senderType === "user" ? "is-user" : "is-support"
                    }`}
                  >
                    <div>
                      <p>{message.message}</p>
                      {renderAttachmentLinks(message.attachments)}
                      <time>{message.formattedDate}</time>
                    </div>
                  </article>
                ))}
                {renderAttachmentLinks(ticketAttachments)}
              </div>

              {chatFiles.length > 0 && (
                <div className="contact-chatroom__pending-files">
                  {chatFiles.map((file) => (
                    <span key={`${file.name}-${file.size}`}>{file.name}</span>
                  ))}
                </div>
              )}

              {renderChatInput()}
            </section>
          )}
        </div>
      </section>

      <footer className="contact-footer">
        <nav aria-label="Footer navigation">
          <Link to="/">Home</Link>
          <Link to="/movies">Movie</Link>
          <Link to="/tv-series">TV Series</Link>
          <Link to="/genre">Genre</Link>
          <Link to="/community">Community</Link>
          <Link to="/contact-us">Contact Us</Link>
        </nav>
        <div>
          <FaFacebookF />
          <FaTwitter />
          <FaYoutube />
        </div>
        <p>Copyright 2026 - Kelompok 5</p>
      </footer>
    </main>
  );
}

export default ContactUsPage;
