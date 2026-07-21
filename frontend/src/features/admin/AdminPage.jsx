import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiAlertTriangle,
  FiBell,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCreditCard,
  FiEdit3,
  FiEye,
  FiFilm,
  FiFilter,
  FiGrid,
  FiHeart,
  FiKey,
  FiLogOut,
  FiMapPin,
  FiMessageSquare,
  FiPlus,
  FiSearch,
  FiSettings,
  FiShare2,
  FiShield,
  FiSlash,
  FiTrash2,
  FiUploadCloud,
  FiUserCheck,
  FiUserX,
  FiUserPlus,
  FiUsers,
  FiX
} from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import flixLogo from "@/assets/flix-logo.png";
import flixAdminLogo from "@/assets/flixadmin-logo.png";
import communityIcon from "@/assets/icon/community.png";
import emptyWalletIcon from "@/assets/icon/empty-wallet.png";
import reviewIcon from "@/assets/icon/review-icon.png";
import PremiumAvatar from "@/components/ui/PremiumAvatar";
import AdminSettingsPanel from "@/features/settings/AdminSettingsPanel";
import { confirmAction } from "@/utils/alerts";
import { resolveMediaUrl } from "@/utils/media";
import "./AdminPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const currentAdminYear = new Date().getFullYear();
const chartActivityOptions = [
  { id: "login", label: "Login" },
  { id: "review", label: "Review" },
  { id: "community", label: "Community" },
  { id: "report", label: "Report" }
];
const chartYearOptions = Array.from({ length: 6 }, (_, index) => currentAdminYear - index);
const tableLimitOptions = [5, 10, 20];

const transactionTabs = [
  { id: "all", label: "Semua", countKey: "all" },
  { id: "success", label: "Berhasil", countKey: "success" },
  { id: "pending", label: "Pending", countKey: "pending" },
  { id: "failed", label: "Ditolak", countKey: "failed" }
];

const contactTabs = [
  { id: "all", label: "Semua", countKey: "all" },
  { id: "waiting_admin", label: "Menunggu Admin", countKey: "waiting_admin" },
  { id: "in_progress", label: "Sedang Ditangani", countKey: "in_progress" },
  { id: "done", label: "Selesai", countKey: "done" }
];

const fallbackContactMessages = {
  summary: {
    all: 0,
    waiting_admin: 0,
    in_progress: 0,
    done: 0
  },
  messages: []
};

const contactFormStatusToTicketStatus = {
  pending: "waiting_admin",
  reviewed: "in_progress",
  resolved: "done",
  closed: "done"
};

const contactTicketStatusLabels = {
  waiting_admin: "Menunggu Admin",
  in_progress: "Sedang Ditangani",
  done: "Selesai"
};

const summarizeContactMessages = (messages = []) =>
  messages.reduce(
    (summary, message) => {
      const status = message.status || "waiting_admin";
      summary.all += 1;
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    },
    {
      all: 0,
      waiting_admin: 0,
      in_progress: 0,
      done: 0
    }
  );

const normalizeContactFormMessage = (message) => {
  const rawStatus = String(message.status || "").toLowerCase();
  const mappedStatus =
    contactFormStatusToTicketStatus[rawStatus] ||
    (["waiting_admin", "in_progress", "done"].includes(rawStatus) ? rawStatus : "waiting_admin");
  const sourceId = Number(message.sourceId || message.id_contact_message || message.id || 0);
  const safeName = message.name || message.userName || "Pengguna FLIX";
  const safeEmail = message.email || message.userEmail || "-";
  const safeSubject = message.subject || "Laporan / Kritik dan Saran";
  const safeMessage = message.message || message.description || "-";

  return {
    id: `contact-${sourceId || safeSubject}`,
    source: "contact_form",
    sourceId,
    ticketCode: sourceId ? `REPORT-${String(sourceId).padStart(4, "0")}` : "REPORT",
    userName: safeName,
    userEmail: safeEmail,
    subject: safeSubject,
    category: message.category || "lainnya",
    categoryLabel: message.categoryLabel || "Lainnya",
    description: safeMessage,
    status: mappedStatus,
    originalStatus: message.status || "pending",
    statusLabel: contactTicketStatusLabels[mappedStatus] || message.statusLabel || "Menunggu Admin",
    assignedAdminName: mappedStatus === "waiting_admin" ? null : "Admin / Moderator",
    formattedDate: message.formattedDate || message.createdAt || "-",
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    detail: {},
    attachments: [],
    messages: [
      {
        id: `contact-message-${sourceId || Date.now()}`,
        senderType: "user",
        senderName: safeName,
        message: safeMessage,
        formattedDate: message.formattedDate || message.createdAt || "-"
      }
    ]
  };
};

const normalizeContactTicketMessage = (ticket) => ({
  ...ticket,
  source: ticket.source || "customer_service",
  id: ticket.id,
  status: ticket.status || "waiting_admin",
  statusLabel: ticket.statusLabel || contactTicketStatusLabels[ticket.status] || "Menunggu Admin"
});

const transactionStatusMap = {
  success: "Berhasil",
  pending: "Pending",
  failed: "Ditolak"
};

const summarizeTransactions = (items) =>
  items.reduce(
    (summary, transaction) => {
      summary.all += 1;

      if (transaction.status === "Berhasil") {
        summary.success += 1;
      } else if (transaction.status === "Pending") {
        summary.pending += 1;
      } else {
        summary.failed += 1;
      }

      return summary;
    },
    {
      all: 0,
      success: 0,
      pending: 0,
      failed: 0
    }
  );

const formatSubscriptionDuration = (durationMonths) => {
  const months = Number(durationMonths || 1);

  if (!Number.isFinite(months) || months <= 0) {
    return "1 bulan";
  }

  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return `${years} tahun`;
  }

  return `${months} bulan`;
};

const fallbackDashboard = {
  stats: [
    { value: "0", label: "Film dan Series Direview" },
    { value: "0", label: "Total User Aktif" },
    { value: "0", label: "Community Post" },
    { value: "0", label: "Laporan Masuk" }
  ],
  chart: [
    { month: "Jan", value: 0 },
    { month: "Feb", value: 0 },
    { month: "Mar", value: 0 },
    { month: "Apr", value: 0 },
    { month: "Mei", value: 0 },
    { month: "Jun", value: 0 },
    { month: "Jul", value: 0 },
    { month: "Agu", value: 0 },
    { month: "Sep", value: 0 },
    { month: "Okt", value: 0 },
    { month: "Nov", value: 0 },
    { month: "Des", value: 0 }
  ],
  activities: [],
  watchlistMovies: []
};

const fallbackUsersSummary = {
  total: 0,
  admin: 0,
  moderator: 0,
  registeredUser: 0
};

const dummyTransactions = Array.from({ length: 5 }, (_, index) => ({
  id: `dummy-transaction-${index + 1}`,
  transactionId: "#TRX-20260429-001",
  user: {
    name: "Marsyanda F.",
    email: "marsyanda@gmail.com",
    profileImageUrl: null
  },
  package: "Premium Tahunan",
  method: "GoPay",
  amount: 249000,
  amountLabel: "Rp 249.000",
  durationMonths: 12,
  status: "Pending",
  paymentProof: null,
  date: "29 Apr 2026, 14.32"
}));

const fallbackTransactions = {
  summary: {
    all: dummyTransactions.length,
    success: 0,
    pending: dummyTransactions.length,
    failed: 0
  },
  items: dummyTransactions
};

const paymentPackageOptions = [
  {
    id: "premium",
    name: "Premium",
    description: "Akses fitur premium untuk semua konten",
    icon: <FiShield aria-hidden="true" />
  },
  {
    id: "premium_yearly",
    name: "Eksklusif",
    description: "Paket eksklusif tahunan dengan harga hemat",
    icon: <FiKey aria-hidden="true" />
  }
];

const paymentMethodTypes = [
  { id: "bank", label: "Bank", icon: <FiGrid aria-hidden="true" /> },
  { id: "qris", label: "QRIS", icon: <FiGrid aria-hidden="true" /> },
  { id: "ewallet", label: "E-Wallet", icon: <FiCreditCard aria-hidden="true" /> }
];

const defaultPaymentMethods = [
  {
    id: "bca",
    type: "bank",
    name: "Bank BCA",
    category: "Bank",
    accountNumber: "1234567890",
    accountName: "FLIX Entertainment",
    imageName: "bank-bca.png"
  },
  {
    id: "qris",
    type: "qris",
    name: "QRIS All Payment",
    category: "QRIS",
    accountNumber: "123456789012345",
    accountName: "FLIX Entertainment",
    imageName: "qris-flix.png"
  },
  {
    id: "dana",
    type: "ewallet",
    name: "Dana",
    category: "E-Wallet",
    accountNumber: "08123456789",
    accountName: "FLIX Entertainment",
    imageName: "dana-flix.png"
  }
];

const defaultPaymentPrices = {
  premium: "25.000",
  premium_yearly: "249.000"
};

const formatAdminPriceInput = (value) =>
  new Intl.NumberFormat("id-ID").format(Number(value || 0));

const parseAdminPriceInput = (value) =>
  String(value || "").replace(/[^\d]/g, "");

const paymentImageCropConfig = {
  title: "Crop Gambar Pembayaran",
  outputWidth: 512,
  outputHeight: 512
};

const loadCropImage = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

const cropImageToBlob = async ({
  source,
  zoom,
  pan = { x: 0, y: 0 },
  stageSize = { width: 1, height: 1 },
  outputWidth,
  outputHeight,
  type
}) => {
  const image = await loadCropImage(source);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const stageWidth = stageSize.width || outputWidth || 1;
  const stageHeight = stageSize.height || outputHeight || 1;
  const baseScale = Math.min(
    stageWidth / image.naturalWidth,
    stageHeight / image.naturalHeight
  );
  const scale = baseScale * zoom;
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const outputScaleX = outputWidth / stageWidth;
  const outputScaleY = outputHeight / stageHeight;
  const outputImageWidth = renderedWidth * outputScaleX;
  const outputImageHeight = renderedHeight * outputScaleY;
  const outputX = (outputWidth - outputImageWidth) / 2 + pan.x * outputScaleX;
  const outputY = (outputHeight - outputImageHeight) / 2 + pan.y * outputScaleY;

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(
    image,
    outputX,
    outputY,
    outputImageWidth,
    outputImageHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Gagal crop gambar"));
        }
      },
      type === "image/png" ? "image/png" : "image/jpeg",
      0.92
    );
  });
};

function AdminPaymentImageCropModal({
  cropData,
  saving,
  onClose,
  onZoomChange,
  onPanChange,
  onStageSizeChange,
  onImageLoad,
  onUseImage
}) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  if (!cropData) {
    return null;
  }

  const zoomPercent = Math.round(cropData.zoom * 100);
  const pan = cropData.pan || { x: 0, y: 0 };
  const naturalSize = cropData.naturalSize;
  const stageSize = cropData.stageSize;
  const canCalculatePreview =
    naturalSize?.width > 0 &&
    naturalSize?.height > 0 &&
    stageSize?.width > 1 &&
    stageSize?.height > 1;
  const baseScale = canCalculatePreview
    ? Math.min(stageSize.width / naturalSize.width, stageSize.height / naturalSize.height)
    : 1;
  const imageStyle = canCalculatePreview
    ? {
        width: `${naturalSize.width * baseScale}px`,
        height: `${naturalSize.height * baseScale}px`,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${cropData.zoom})`
      }
    : {
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${cropData.zoom})`
      };

  const getPanLimit = () => {
    const stage = stageRef.current;
    const rect = stage?.getBoundingClientRect();
    const width = rect?.width || 1;
    const height = rect?.height || 1;
    const size = cropData.naturalSize;

    if (!size?.width || !size?.height) {
      const fallbackLimit = Math.max(width, height) * Math.max(0.2, (cropData.zoom - 1) / 2);

      return {
        x: fallbackLimit,
        y: fallbackLimit
      };
    }

    const scale = Math.min(width / size.width, height / size.height) * cropData.zoom;
    const renderedWidth = size.width * scale;
    const renderedHeight = size.height * scale;

    return {
      x: Math.max(0, (renderedWidth - width) / 2),
      y: Math.max(0, (renderedHeight - height) / 2)
    };
  };

  const clampPan = (nextPan) => {
    const limit = getPanLimit();

    return {
      x: Math.min(Math.max(nextPan.x, -limit.x), limit.x),
      y: Math.min(Math.max(nextPan.y, -limit.y), limit.y)
    };
  };

  const handlePointerDown = (event) => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    onStageSizeChange({ width: rect.width, height: rect.height });
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pan
    };
    event.preventDefault();
    stage.setPointerCapture?.(event.pointerId);
  };

  const handleImageLoad = (event) => {
    const stage = stageRef.current;
    const rect = stage?.getBoundingClientRect();

    onImageLoad({
      naturalSize: {
        width: event.currentTarget.naturalWidth,
        height: event.currentTarget.naturalHeight
      },
      stageSize: {
        width: rect?.width || 1,
        height: rect?.height || 1
      }
    });
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    event.preventDefault();
    onPanChange(
      clampPan({
        x: drag.pan.x + event.clientX - drag.startX,
        y: drag.pan.y + event.clientY - drag.startY
      })
    );
  };

  const handlePointerUp = (event) => {
    const stage = stageRef.current;

    if (dragRef.current?.pointerId === event.pointerId) {
      stage?.releasePointerCapture?.(event.pointerId);
      dragRef.current = null;
    }
  };

  return (
    <div className="admin-payment-crop-modal" role="presentation" onClick={onClose}>
      <section
        className="admin-payment-crop-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-payment-crop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-payment-crop-modal__header">
          <h2 id="admin-payment-crop-title">{paymentImageCropConfig.title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup crop gambar">
            <FiX />
          </button>
        </header>

        <div
          ref={stageRef}
          className="admin-payment-crop-modal__stage"
          role="presentation"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            src={cropData.previewUrl}
            alt="Preview crop"
            draggable="false"
            onLoad={handleImageLoad}
            onDragStart={(event) => event.preventDefault()}
            style={imageStyle}
          />
          <span className="admin-payment-crop-modal__circle-mask" aria-hidden="true" />
        </div>

        <div className="admin-payment-crop-modal__zoom" aria-label="Zoom gambar">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(1, Number((cropData.zoom - 0.1).toFixed(2))))}
            disabled={cropData.zoom <= 1}
            aria-label="Perkecil gambar"
          >
            <span aria-hidden="true">-</span>
          </button>
          <span>{zoomPercent} %</span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(3, Number((cropData.zoom + 0.1).toFixed(2))))}
            disabled={cropData.zoom >= 3}
            aria-label="Perbesar gambar"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>

        <footer className="admin-payment-crop-modal__actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="button" onClick={onUseImage} disabled={saving}>
            {saving ? "Mengupload..." : "Gunakan Gambar"}
          </button>
        </footer>
      </section>
    </div>
  );
}

const dummyCommunityReportedPosts = [
  {
    id: "community-report-1",
    author: "Dina Fardina",
    time: "12 minutes ago",
    content:
      "Buat yang belum nonton, ini bukan film aksi biasa. Ini film tentang dilema moral seorang ilmuwan yang menciptakan sesuatu yang menghancurkan dunia. Cillian Murphy benar-benar luar biasa.",
    status: "Dilaporkan",
    reportReason: "Alasan laporan: konten mengandung spoiler besar",
    reportedAt: "Dilaporkan oleh 2 user - 12:30 WIB",
    metrics: { views: 320, replies: 120, shares: 148 }
  },
  {
    id: "community-report-2",
    author: "Dina Fardina",
    time: "12 minutes ago",
    content:
      "Buat yang belum nonton, ini bukan film aksi biasa. Ini film tentang dilema moral seorang ilmuwan yang menciptakan sesuatu yang menghancurkan dunia. Cillian Murphy benar-benar luar biasa.",
    status: "Dilaporkan",
    reportReason: "Alasan laporan: spam/konten promosi",
    reportedAt: "Dilaporkan oleh 4 user - 13:05 WIB",
    metrics: { views: 320, replies: 120, shares: 148 }
  },
  {
    id: "community-report-3",
    author: "Dina Fardina",
    time: "12 minutes ago",
    content:
      "Buat yang belum nonton, ini bukan film aksi biasa. Ini film tentang dilema moral seorang ilmuwan yang menciptakan sesuatu yang menghancurkan dunia. Cillian Murphy benar-benar luar biasa.",
    status: "Dilaporkan",
    reportReason: "Alasan laporan: bahasa kasar",
    reportedAt: "Dilaporkan oleh 1 user - 14:12 WIB",
    metrics: { views: 320, replies: 120, shares: 148 }
  }
];

const dummyCommunityBlockedPosts = [
  {
    id: "community-blocked-1",
    author: "Dina Fardina",
    time: "12 minutes ago",
    content: "Postingan ini disembunyikan karena melanggar aturan komunitas.",
    status: "Terblokir",
    reportReason: "Alasan diblokir: spam/konten promosi",
    reportedAt: "Diblokir oleh admin - 20:09 WIB",
    metrics: { views: 0, replies: 0, shares: 0 }
  }
];

const fallbackCommunity = {
  summary: {
    totalPost: 0,
    totalReply: 0,
    reported: dummyCommunityReportedPosts.length,
    blocked: dummyCommunityBlockedPosts.length
  },
  all: [],
  reported: dummyCommunityReportedPosts,
  blocked: dummyCommunityBlockedPosts
};

const communityTabs = [
  { id: "all", label: "Semua Post", countKey: "totalPost" },
  { id: "reported", label: "Dilaporkan", countKey: "reported" },
  { id: "blocked", label: "Terblokir", countKey: "blocked" }
];

const dummyReportedReviews = [
  {
    id: "dummy-report-1",
    user: { name: "Alfha Risqi W." },
    title: "Oppenheimer",
    content: "Film ini sampah...",
    reason: "Bahasa Kasar",
    status: "Disetujui",
    date: "12 Apr 2026"
  },
  {
    id: "dummy-report-2",
    user: { name: "Alfha Risqi W." },
    title: "Oppenheimer",
    content: "Film ini sampah...",
    reason: "Bahasa Kasar",
    status: "Pending",
    date: "12 Apr 2026"
  },
  {
    id: "dummy-report-3",
    user: { name: "Alfha Risqi W." },
    title: "Oppenheimer",
    content: "Film ini sampah...",
    reason: "Bahasa Kasar",
    status: "Disetujui",
    date: "12 Apr 2026"
  },
  {
    id: "dummy-report-4",
    user: { name: "Alfha Risqi W." },
    title: "Oppenheimer",
    content: "Film ini sampah...",
    reason: "Bahasa Kasar",
    status: "Ditolak",
    date: "12 Apr 2026"
  },
  {
    id: "dummy-report-5",
    user: { name: "Alfha Risqi W." },
    title: "Oppenheimer",
    content: "Film ini sampah...",
    reason: "Bahasa Kasar",
    status: "Ditolak",
    date: "12 Apr 2026"
  }
];

const fallbackReviews = {
  summary: {
    incoming: 0,
    reported: dummyReportedReviews.length,
    blocked: 0
  },
  incoming: [],
  reported: dummyReportedReviews,
  blocked: []
};

const reviewTabs = [
  { id: "incoming", label: "Review Masuk", countKey: "incoming" },
  { id: "reported", label: "Report Review", countKey: "reported" },
  { id: "blocked", label: "Review Terblokir", countKey: "blocked" }
];

const isBlockedReviewStatus = (status) =>
  ["diblokir", "terblokir", "blocked", "approved"].includes(String(status || "").trim().toLowerCase());

const isBlockedCommunityStatus = (status) =>
  ["terblokir", "diblokir", "blocked", "approved"].includes(String(status || "").trim().toLowerCase());

const isRejectedCommunityStatus = (status) =>
  ["ditolak", "rejected"].includes(String(status || "").trim().toLowerCase());

const reviewReportCategoryLabels = {
  spam: "Spam / promosi",
  harassment: "Pelecehan",
  hate_speech: "Ujaran kebencian",
  violence: "Kekerasan",
  sexual_content: "Konten seksual",
  misinformation: "Informasi salah",
  spoiler: "Spoiler",
  copyright: "Hak cipta",
  other: "Lainnya"
};

const getReviewReportReasonSummary = (review) => {
  const categoryLabel = reviewReportCategoryLabels[String(review?.category || "").toLowerCase()];

  if (categoryLabel) {
    return categoryLabel;
  }

  const reasonText = String(review?.reason || "").trim();

  if (!reasonText) {
    return "Konten bermasalah";
  }

  if (reasonText.includes(":")) {
    return reasonText.split(":")[0].trim() || "Konten bermasalah";
  }

  return reasonText.length > 28 ? "Laporan user" : reasonText;
};

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: FiGrid },
  { id: "movies", label: "Kelola Film", icon: FiFilm },
  { id: "users", label: "Kelola User", icon: FiUsers },
  { id: "reviews", label: "Review", image: reviewIcon },
  { id: "community", label: "Community", image: communityIcon },
  { id: "transactions", label: "Transaksi", image: emptyWalletIcon },
  { id: "contact", label: "Report", icon: FiMessageSquare },
  { id: "settings", label: "Pengaturan", icon: FiSettings }
];

const moderatorAdminPageIds = new Set(["movies", "reviews", "community", "transactions", "contact"]);

const canAccessAdminPage = (role, pageId) =>
  role === "admin" || moderatorAdminPageIds.has(pageId);

const adminRoleOptions = [
  { value: "registered_user", label: "User Biasa" },
  { value: "moderator", label: "Moderator" }
];

const createLocalJsonResponse = (data) => ({
  ok: true,
  json: async () => data
});

const activityIcons = {
  user: FiUserPlus,
  review: FiMessageSquare,
  film: FiFilm,
  check: FiCheck,
  community: FiUsers,
  report: FiBell
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
}

function AdminAvatar({ imageUrl, name, isPremium }) {
  return (
    <PremiumAvatar
      imageUrl={imageUrl}
      name={name || "User FLIX"}
      isPremium={Boolean(isPremium)}
      alt={name || "User FLIX"}
    />
  );
}

function AdminFilterButton({ id, openFilter, setOpenFilter, groups }) {
  const isOpen = openFilter === id;

  return (
    <div className="admin-filter-popover">
      <button
        type="button"
        className="admin-manage-film__filter"
        aria-expanded={isOpen}
        onClick={() => setOpenFilter((currentFilter) => (currentFilter === id ? null : id))}
      >
        <FiFilter aria-hidden="true" />
        Filter
      </button>

      {isOpen && (
        <div className="admin-filter-popover__menu" role="menu">
          {groups.map((group) => (
            <section key={group.id} className="admin-filter-popover__group">
              <span>{group.label}</span>
              <div>
                {group.options.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={group.value === option ? "is-active" : ""}
                    onClick={() => {
                      group.onChange(option);
                      setOpenFilter(null);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const decodeHtmlEntities = (value = "") =>
  String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

const stripHtml = (value = "") =>
  decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatPostPreview = (value = "", maxLength = 170) => {
  const text = stripHtml(value);

  if (!text) {
    return "Post belum memiliki isi.";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
};

const readStorageArray = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const getUserStorageId = (user) => user?.id_user || user?.id || "guest";
const getMovieWatchlistKey = (user) => `flix_movie_watchlist_${getUserStorageId(user)}`;
const getSeriesWatchlistKey = (user) => `flix_tv_watchlist_${getUserStorageId(user)}`;

const normalizeAdminWatchlistItem = (item, mediaType) => ({
  ...item,
  mediaType: item.mediaType || item.media_type || mediaType,
  title: item.title || item.name || item.original_name || "Untitled",
  year: item.year || item.releaseLabel?.slice?.(0, 4) || item.release_date?.slice?.(0, 4) || "-",
  poster: item.poster || item.poster_url || null,
  savedAt: item.savedAt || (mediaType === "tv" ? "TV Series" : "Film"),
});

const getStoredUserWatchlist = (user) => {
  if (!user?.id && !user?.id_user) {
    return [];
  }

  return [
    ...readStorageArray(getMovieWatchlistKey(user)).map((item) => normalizeAdminWatchlistItem(item, "movie")),
    ...readStorageArray(getSeriesWatchlistKey(user)).map((item) => normalizeAdminWatchlistItem(item, "tv")),
  ];
};

const mergeWatchlistItems = (backendItems = [], localItems = []) => {
  const seenItems = new Set();

  return [...backendItems, ...localItems].filter((item) => {
    const mediaType = item.mediaType || item.media_type || "movie";
    const key = `${mediaType}:${item.id}`;

    if (seenItems.has(key)) {
      return false;
    }

    seenItems.add(key);
    return true;
  });
};

function normalizeDashboard(data) {
  if (!data || typeof data !== "object") {
    return fallbackDashboard;
  }

  return {
    stats: Array.isArray(data.stats) ? data.stats : fallbackDashboard.stats,
    chart: Array.isArray(data.chart) ? data.chart : fallbackDashboard.chart,
    activities: Array.isArray(data.activities) ? data.activities : fallbackDashboard.activities,
    watchlistMovies: Array.isArray(data.watchlistMovies)
      ? data.watchlistMovies
      : fallbackDashboard.watchlistMovies
  };
}

const formatChartNumber = (value) =>
  new Intl.NumberFormat("id-ID").format(Number(value || 0));

const defaultAddMovieForm = {
  title: "",
  year: "",
  duration: "",
  director: "",
  synopsis: "",
  cast: "",
  posterUrl: "",
  posterDataUrl: "",
  trailerUrl: "",
  rating: "",
  country: "",
  genres: ["Drama"],
  platforms: ["Netflix"],
  moods: ["Santai"]
};

const genreOptions = [
  "Drama",
  "Thriller",
  "Animasi",
  "Komedi",
  "Adventure",
  "Fantasy",
  "Horror"
];

const platformOptions = [
  "Netflix",
  "Disney+",
  "Prime Video",
  "HBO Max",
  "Apple TV",
  "Vidio",
  "Viu"
];

const moodOptions = [
  "Santai",
  "Seru",
  "Sedih",
  "Romantis",
  "Pikiran Tertantang",
  "Menegangkan"
];

const normalizeMovieOptionArray = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value.length ? value : fallback;
  }

  if (typeof value === "string") {
    const values = value.split(",").map((item) => item.trim()).filter(Boolean);
    return values.length ? values : fallback;
  }

  return fallback;
};

const mapMovieToAdminForm = (movie) => ({
  title: movie?.title || "",
  year: movie?.year && movie.year !== "-" ? String(movie.year) : "",
  duration: movie?.duration || "",
  director: movie?.director || "",
  synopsis: movie?.synopsis || "",
  cast: movie?.cast || "",
  posterUrl: movie?.poster || "",
  posterDataUrl: "",
  trailerUrl: movie?.trailerUrl || "",
  rating: movie?.rating && movie.rating !== "-" ? String(movie.rating) : "",
  country: movie?.country || "",
  genres: normalizeMovieOptionArray(movie?.genres || movie?.genre, ["Drama"]),
  platforms: normalizeMovieOptionArray(movie?.platforms, ["Netflix"]),
  moods: normalizeMovieOptionArray(movie?.moods, ["Santai"])
});

const getPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages];
};

function AdminPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(fallbackDashboard);
  const [managedMovies, setManagedMovies] = useState([]);
  const [managedMoviesTotal, setManagedMoviesTotal] = useState(0);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersSummary, setAdminUsersSummary] = useState(fallbackUsersSummary);
  const [adminReviews, setAdminReviews] = useState(fallbackReviews);
  const [adminCommunity, setAdminCommunity] = useState(fallbackCommunity);
  const [adminContactMessages, setAdminContactMessages] = useState(fallbackContactMessages);
  const [adminTransactions, setAdminTransactions] = useState(fallbackTransactions);
  const [activeAdminPage, setActiveAdminPage] = useState("dashboard");
  const [activeMoviePanel, setActiveMoviePanel] = useState("list");
  const [activeUserPanel, setActiveUserPanel] = useState("list");
  const [activeReviewTab, setActiveReviewTab] = useState("incoming");
  const [activeCommunityTab, setActiveCommunityTab] = useState("all");
  const [activeContactTab, setActiveContactTab] = useState("all");
  const [activeTransactionTab, setActiveTransactionTab] = useState("all");
  const [activeTransactionPanel, setActiveTransactionPanel] = useState("list");
  const [paymentMethods, setPaymentMethods] = useState(defaultPaymentMethods);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(defaultPaymentMethods[0].id);
  const [paymentPrices, setPaymentPrices] = useState(defaultPaymentPrices);
  const [paymentSettingsFeedback, setPaymentSettingsFeedback] = useState("");
  const [paymentImageCropData, setPaymentImageCropData] = useState(null);
  const [isCroppingPaymentImage, setIsCroppingPaymentImage] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [isUserDetailLoading, setIsUserDetailLoading] = useState(false);
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);
  const [userEditForm, setUserEditForm] = useState({
    username: "",
    email: "",
    role: "registered_user"
  });
  const [isSavingUserEdit, setIsSavingUserEdit] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordForm, setResetPasswordForm] = useState({
    password: "",
    confirmPassword: ""
  });
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [addMovieForm, setAddMovieForm] = useState(defaultAddMovieForm);
  const [addMovieFeedback, setAddMovieFeedback] = useState("");
  const [isSavingMovie, setIsSavingMovie] = useState(false);
  const [selectedEditingMovie, setSelectedEditingMovie] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tableLimit, setTableLimit] = useState(10);
  const [filmPage, setFilmPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [communityPage, setCommunityPage] = useState(1);
  const [contactPage, setContactPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserStatusLoading, setIsUserStatusLoading] = useState(false);
  const [reviewReportActionLoading, setReviewReportActionLoading] = useState({});
  const [selectedReviewReport, setSelectedReviewReport] = useState(null);
  const [communityReportActionLoading, setCommunityReportActionLoading] = useState({});
  const [selectedCommunityReport, setSelectedCommunityReport] = useState(null);
  const [contactActionLoading, setContactActionLoading] = useState({});
  const [selectedContactMessage, setSelectedContactMessage] = useState(null);
  const [contactReplyText, setContactReplyText] = useState("");
  const [contactResolutionNote, setContactResolutionNote] = useState("");
  const [contactReplyFiles, setContactReplyFiles] = useState([]);
  const [transactionActionLoading, setTransactionActionLoading] = useState({});
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [moviesError, setMoviesError] = useState("");
  const [usersError, setUsersError] = useState("");
  const [reviewsError, setReviewsError] = useState("");
  const [communityError, setCommunityError] = useState("");
  const [contactError, setContactError] = useState("");
  const [transactionsError, setTransactionsError] = useState("");
  const [userDetailError, setUserDetailError] = useState("");
  const [userStatusFeedback, setUserStatusFeedback] = useState("");
  const [selectedChartActivity, setSelectedChartActivity] = useState("login");
  const [selectedChartYear, setSelectedChartYear] = useState(currentAdminYear);
  const [openChartFilter, setOpenChartFilter] = useState(null);
  const [openTransactionFilter, setOpenTransactionFilter] = useState(null);
  const [openAdminFilter, setOpenAdminFilter] = useState(null);
  const [movieTypeFilter, setMovieTypeFilter] = useState("Semua Tipe");
  const [movieStatusFilter, setMovieStatusFilter] = useState("Semua Status");
  const [movieGenreFilter, setMovieGenreFilter] = useState("Semua Genre");
  const [userRoleFilter, setUserRoleFilter] = useState("Semua Role");
  const [userStatusFilter, setUserStatusFilter] = useState("Semua Status");
  const [reviewMediaFilter, setReviewMediaFilter] = useState("Semua Media");
  const [reviewRatingFilter, setReviewRatingFilter] = useState("Semua Rating");
  const [transactionPackageFilter, setTransactionPackageFilter] = useState("Semua Paket");
  const [transactionPaymentFilter, setTransactionPaymentFilter] = useState("Semua Pembayaran");
  const [transactionDateFilter, setTransactionDateFilter] = useState("Bulan ini");
  const [isTableLimitOpen, setIsTableLimitOpen] = useState(false);
  const [isAdminNotificationOpen, setIsAdminNotificationOpen] = useState(false);
  const didSkipInitialChartFetch = useRef(false);

  const user = useMemo(getStoredUser, []);
  const currentRole = user?.role || "admin";
  const isModerator = currentRole === "moderator";
  const isAdmin = currentRole === "admin";
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => canAccessAdminPage(currentRole, item.id)),
    [currentRole]
  );
  const adminName = user?.username || user?.name || "Marsyanda F";
  const adminProfileImageUrl = user?.profile_image_url || user?.profileImageUrl || user?.avatarUrl || "";
  const selectedChartActivityLabel =
    chartActivityOptions.find((option) => option.id === selectedChartActivity)?.label || "Login";
  const dashboardUrl = useMemo(() => {
    const params = new URLSearchParams({
      activity: selectedChartActivity,
      year: String(selectedChartYear)
    });

    return `${API_URL}/api/admin/dashboard?${params.toString()}`;
  }, [selectedChartActivity, selectedChartYear]);

  useEffect(() => {
    if (!canAccessAdminPage(currentRole, activeAdminPage)) {
      setActiveAdminPage(visibleNavItems[0]?.id || "movies");
    }
  }, [activeAdminPage, currentRole, visibleNavItems]);

  useEffect(
    () => () => {
      if (paymentImageCropData?.previewUrl) {
        URL.revokeObjectURL(paymentImageCropData.previewUrl);
      }
    },
    [paymentImageCropData?.previewUrl]
  );

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadAdminData = async () => {
      try {
        const authHeaders = {
          Authorization: `Bearer ${token}`
        };
        const [
          dashboardResponse,
          moviesResponse,
          usersResponse,
          reviewsResponse,
          communityResponse,
          contactFormResponse,
          contactResponse,
          transactionsResponse,
          paymentSettingsResponse
        ] = await Promise.all([
          isAdmin
            ? fetch(dashboardUrl, {
                headers: authHeaders
              })
            : createLocalJsonResponse(fallbackDashboard),
          fetch(`${API_URL}/api/admin/movies`, {
            headers: authHeaders
          }),
          isAdmin
            ? fetch(`${API_URL}/api/admin/users`, {
                headers: authHeaders
              })
            : createLocalJsonResponse({
                users: [],
                summary: fallbackUsersSummary
              }),
          fetch(`${API_URL}/api/admin/reviews`, {
            headers: authHeaders
          }),
          fetch(`${API_URL}/api/admin/community`, {
            headers: authHeaders
          }),
          fetch(`${API_URL}/api/admin/contact-us`, {
            headers: authHeaders
          }),
          fetch(`${API_URL}/api/admin/customer-service/tickets`, {
            headers: authHeaders
          }),
          fetch(`${API_URL}/api/admin/transactions`, {
            headers: authHeaders
          }),
          fetch(`${API_URL}/api/admin/payment-settings`, {
            headers: authHeaders
          })
        ]);

        if (!isMounted) {
          return;
        }

        const dashboardData = dashboardResponse.ok ? await dashboardResponse.json() : null;
        const moviesData = moviesResponse.ok ? await moviesResponse.json() : null;
        const usersData = usersResponse.ok ? await usersResponse.json() : null;
        const reviewsData = reviewsResponse.ok ? await reviewsResponse.json() : null;
        const communityData = communityResponse.ok ? await communityResponse.json() : null;
        const contactFormData = contactFormResponse.ok ? await contactFormResponse.json() : null;
        const contactData = contactResponse.ok ? await contactResponse.json() : null;
        const transactionsData = transactionsResponse.ok ? await transactionsResponse.json() : null;
        const paymentSettingsData = paymentSettingsResponse.ok
          ? await paymentSettingsResponse.json()
          : null;

        setDashboard(normalizeDashboard(dashboardData?.dashboard || dashboardData));
        setDashboardError(dashboardResponse.ok ? "" : "Dashboard belum bisa mengambil data backend.");

        setManagedMovies(Array.isArray(moviesData?.movies) ? moviesData.movies : []);
        setManagedMoviesTotal(Number(moviesData?.total || 0));
        setMoviesError(moviesResponse.ok ? "" : "Daftar film admin belum bisa mengambil data backend.");

        setAdminUsers(Array.isArray(usersData?.users) ? usersData.users : []);
        setAdminUsersSummary(usersData?.summary || fallbackUsersSummary);
        setUsersError(usersResponse.ok ? "" : "Daftar user admin belum bisa mengambil data backend.");

        const incomingReviews = Array.isArray(reviewsData?.reviews?.incoming)
          ? reviewsData.reviews.incoming
          : [];
        const reportedReviews = Array.isArray(reviewsData?.reviews?.reported)
          ? reviewsData.reviews.reported
          : dummyReportedReviews;
        const blockedReviews = Array.isArray(reviewsData?.reviews?.blocked)
          ? reviewsData.reviews.blocked
          : [];
        const reportedBlockedReviews = reportedReviews.filter((review) =>
          isBlockedReviewStatus(review.status)
        );
        const normalizedBlockedReviews = [
          ...blockedReviews,
          ...reportedBlockedReviews.filter(
            (review) =>
              !blockedReviews.some((item) =>
                String(item.reportId || item.id) === String(review.reportId || review.id)
              )
          )
        ];

        setAdminReviews({
          summary: {
            incoming: Number(reviewsData?.summary?.incoming || incomingReviews.length),
            reported: reportedReviews.length,
            blocked: normalizedBlockedReviews.length
          },
          incoming: incomingReviews,
          reported: reportedReviews,
          blocked: normalizedBlockedReviews
        });
        setReviewsError(reviewsResponse.ok ? "" : "Moderasi review belum bisa mengambil data backend.");

        const communityAllPosts = Array.isArray(communityData?.posts?.all)
          ? communityData.posts.all
          : [];
        const communityReportedPosts = Array.isArray(communityData?.posts?.reported)
          ? communityData.posts.reported
          : dummyCommunityReportedPosts;
        const communityBlockedPosts = Array.isArray(communityData?.posts?.blocked)
          ? communityData.posts.blocked
          : dummyCommunityBlockedPosts;
        const communityReportedBlockedPosts = communityReportedPosts.filter((post) =>
          isBlockedCommunityStatus(post.status)
        );
        const normalizedCommunityBlockedPosts = [
          ...communityBlockedPosts,
          ...communityReportedBlockedPosts.filter(
            (post) =>
              !communityBlockedPosts.some((item) =>
                String(item.reportId || item.id) === String(post.reportId || post.id)
              )
          )
        ];

        setAdminCommunity({
          summary: {
            totalPost: Number(communityData?.summary?.totalPost || communityAllPosts.length),
            totalReply: Number(communityData?.summary?.totalReply || 0),
            reported: communityReportedPosts.length,
            blocked: normalizedCommunityBlockedPosts.length
          },
          all: communityAllPosts,
          reported: communityReportedPosts,
          blocked: normalizedCommunityBlockedPosts
        });
        setCommunityError(communityResponse.ok ? "" : "Kelola community belum bisa mengambil data backend.");

        const ticketItems = Array.isArray(contactData?.tickets)
          ? contactData.tickets.map(normalizeContactTicketMessage)
          : [];
        const formItems = Array.isArray(contactFormData?.messages)
          ? contactFormData.messages.map(normalizeContactFormMessage)
          : [];
        const contactItems = [...ticketItems, ...formItems].sort((first, second) => {
          const firstTime = new Date(first.createdAt || first.formattedDate || 0).getTime();
          const secondTime = new Date(second.createdAt || second.formattedDate || 0).getTime();
          return secondTime - firstTime;
        });
        setAdminContactMessages({
          summary: summarizeContactMessages(contactItems),
          messages: contactItems
        });
        setContactError(
          contactResponse.ok || contactFormResponse.ok
            ? ""
            : "Report admin belum bisa mengambil data backend."
        );

        const transactionItems = Array.isArray(transactionsData?.transactions)
          ? transactionsData.transactions
          : fallbackTransactions.items;

        setAdminTransactions({
          summary: transactionsData?.summary || summarizeTransactions(transactionItems),
          items: transactionItems
        });
        setTransactionsError(transactionsResponse.ok ? "" : "Riwayat transaksi belum bisa mengambil data backend.");

        const paymentMethodItems = Array.isArray(paymentSettingsData?.methods)
          ? paymentSettingsData.methods
          : defaultPaymentMethods;
        setPaymentMethods(paymentMethodItems);
        setSelectedPaymentMethodId(paymentMethodItems[0]?.id || "");
        if (Array.isArray(paymentSettingsData?.packages) && paymentSettingsData.packages.length) {
          setPaymentPrices((prices) => ({
            ...prices,
            ...paymentSettingsData.packages.reduce((result, paymentPackage) => {
              result[paymentPackage.code] = formatAdminPriceInput(paymentPackage.price);
              return result;
            }, {})
          }));
        }
        setPaymentSettingsFeedback(
          paymentSettingsResponse.ok ? "" : "Pengaturan pembayaran belum bisa mengambil data backend."
        );
      } catch {
        if (isMounted) {
          setDashboard(fallbackDashboard);
          setDashboardError("Dashboard belum bisa mengambil data backend.");
          setManagedMovies([]);
          setManagedMoviesTotal(0);
          setMoviesError("Daftar film admin belum bisa mengambil data backend.");
          setAdminUsers([]);
          setAdminUsersSummary(fallbackUsersSummary);
          setUsersError("Daftar user admin belum bisa mengambil data backend.");
          setAdminReviews(fallbackReviews);
          setReviewsError("Moderasi review belum bisa mengambil data backend.");
          setAdminCommunity(fallbackCommunity);
          setCommunityError("Kelola community belum bisa mengambil data backend.");
          setAdminContactMessages(fallbackContactMessages);
          setContactError("Report admin belum bisa mengambil data backend.");
          setAdminTransactions(fallbackTransactions);
          setTransactionsError("Riwayat transaksi belum bisa mengambil data backend.");
          setPaymentMethods(defaultPaymentMethods);
          setSelectedPaymentMethodId(defaultPaymentMethods[0]?.id || "");
          setPaymentSettingsFeedback("Pengaturan pembayaran belum bisa mengambil data backend.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    if (!didSkipInitialChartFetch.current) {
      didSkipInitialChartFetch.current = true;
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    let isMounted = true;

    const loadDashboardChart = async () => {
      try {
        const response = await fetch(dashboardUrl, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const dashboardData = response.ok ? await response.json() : null;

        if (!isMounted) {
          return;
        }

        setDashboard(normalizeDashboard(dashboardData?.dashboard || dashboardData));
        setDashboardError(response.ok ? "" : "Dashboard belum bisa mengambil data backend.");
      } catch {
        if (isMounted) {
          setDashboardError("Dashboard belum bisa mengambil data backend.");
        }
      }
    };

    loadDashboardChart();

    return () => {
      isMounted = false;
    };
  }, [dashboardUrl, isAdmin]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleAdminNotificationClick = (notification) => {
    setIsAdminNotificationOpen(false);
    setSearchQuery("");

    if (!notification?.targetPage) {
      return;
    }

    setActiveAdminPage(notification.targetPage);

    if (notification.targetPage === "reviews") {
      setActiveReviewTab(notification.targetTab || "reported");
      setReviewPage(1);
    }

    if (notification.targetPage === "community") {
      setActiveCommunityTab(notification.targetTab || "reported");
      setCommunityPage(1);
    }

    if (notification.targetPage === "contact") {
      setActiveContactTab(notification.targetTab || "waiting_admin");
      setContactPage(1);
    }

    if (notification.targetPage === "transactions") {
      setActiveTransactionTab("pending");
      setActiveTransactionPanel("list");
      setTransactionPage(1);
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const activeNavItem = visibleNavItems.find((item) => item.id === activeAdminPage) || visibleNavItems[0] || navItems[0];
  const adminPageTitle =
    activeAdminPage === "movies" && activeMoviePanel === "add"
      ? "Tambah Film"
      : activeAdminPage === "movies" && activeMoviePanel === "edit"
        ? "Edit Film"
        : activeAdminPage === "users" && activeUserPanel === "detail"
          ? "Detail User"
          : activeAdminPage === "reviews"
            ? "Moderasi Review"
            : activeAdminPage === "community"
              ? "Kelola Community"
              : activeAdminPage === "contact"
                ? "Report"
                : activeAdminPage === "transactions"
                  ? activeTransactionPanel === "payment-settings"
                    ? "Kelola Pembayaran Premium"
                    : "Transaksi"
                  : activeNavItem.label;

  useEffect(() => {
    setFilmPage(1);
    setUserPage(1);
    setReviewPage(1);
    setCommunityPage(1);
    setContactPage(1);
    setTransactionPage(1);
  }, [normalizedSearch, activeAdminPage]);

  useEffect(() => {
    setReviewPage(1);
  }, [activeReviewTab]);

  useEffect(() => {
    setCommunityPage(1);
  }, [activeCommunityTab]);

  useEffect(() => {
    setContactPage(1);
  }, [activeContactTab]);

  useEffect(() => {
    setTransactionPage(1);
  }, [activeTransactionTab, transactionPackageFilter, transactionPaymentFilter, transactionDateFilter]);

  useEffect(() => {
    setFilmPage(1);
  }, [movieTypeFilter, movieStatusFilter, movieGenreFilter]);

  useEffect(() => {
    setUserPage(1);
  }, [userRoleFilter, userStatusFilter]);

  useEffect(() => {
    setReviewPage(1);
  }, [reviewMediaFilter, reviewRatingFilter]);

  const filteredActivities = useMemo(() => {
    if (!normalizedSearch) {
      return dashboard.activities;
    }

    return dashboard.activities.filter((activity) =>
      `${activity.title} ${activity.time}`.toLowerCase().includes(normalizedSearch)
    );
  }, [dashboard.activities, normalizedSearch]);

  const filteredWatchlistMovies = useMemo(() => {
    if (!normalizedSearch) {
      return dashboard.watchlistMovies;
    }

    return dashboard.watchlistMovies.filter((movie) =>
      `${movie.title} ${movie.year} ${movie.genre} ${movie.status}`
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [dashboard.watchlistMovies, normalizedSearch]);

  const visibleWatchlistMovies = filteredWatchlistMovies.slice(0, tableLimit);

  const movieGenreOptions = useMemo(() => {
    const genres = new Set();

    managedMovies.forEach((movie) => {
      String(movie.genre || "")
        .split(",")
        .map((genre) => genre.trim())
        .filter((genre) => genre && genre !== "-")
        .forEach((genre) => genres.add(genre));
    });

    return ["Semua Genre", ...Array.from(genres).sort((a, b) => a.localeCompare(b))];
  }, [managedMovies]);

  const movieStatusOptions = useMemo(() => {
    const statuses = new Set(
      managedMovies
        .map((movie) => String(movie.status || "").trim())
        .filter(Boolean)
    );

    return ["Semua Status", ...Array.from(statuses)];
  }, [managedMovies]);

  const filteredManagedMovies = useMemo(() => {
    return managedMovies.filter((movie) => {
      const mediaTypeLabel = movie.mediaType === "tv" ? "TV Series" : "Film";
      const matchesSearch =
        !normalizedSearch ||
        `${movie.title} ${movie.year} ${movie.genre} ${movie.status} ${movie.mediaType}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesType = movieTypeFilter === "Semua Tipe" || mediaTypeLabel === movieTypeFilter;
      const matchesStatus = movieStatusFilter === "Semua Status" || movie.status === movieStatusFilter;
      const matchesGenre =
        movieGenreFilter === "Semua Genre" ||
        String(movie.genre || "")
          .split(",")
          .map((genre) => genre.trim())
          .includes(movieGenreFilter);

      return matchesSearch && matchesType && matchesStatus && matchesGenre;
    });
  }, [
    managedMovies,
    movieGenreFilter,
    movieStatusFilter,
    movieTypeFilter,
    normalizedSearch
  ]);

  const filmRowsPerPage = 8;
  const totalFilmPages = Math.max(1, Math.ceil(filteredManagedMovies.length / filmRowsPerPage));
  const currentFilmPage = Math.min(filmPage, totalFilmPages);
  const visibleManagedMovies = filteredManagedMovies.slice(
    (currentFilmPage - 1) * filmRowsPerPage,
    currentFilmPage * filmRowsPerPage
  );
  const filmTotalLabel = managedMoviesTotal || managedMovies.length;
  const paginationItems = getPaginationItems(currentFilmPage, totalFilmPages);
  const addMoviePosterPreview = addMovieForm.posterDataUrl || addMovieForm.posterUrl;
  const isEditingMovie = activeMoviePanel === "edit" && Boolean(selectedEditingMovie);
  const isMovieFormPanel = activeMoviePanel === "add" || isEditingMovie;

  const filteredAdminUsers = useMemo(() => {
    return adminUsers.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        `${item.username} ${item.email} ${item.roleLabel} ${item.status}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesRole = userRoleFilter === "Semua Role" || item.roleLabel === userRoleFilter;
      const matchesStatus = userStatusFilter === "Semua Status" || item.status === userStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [adminUsers, normalizedSearch, userRoleFilter, userStatusFilter]);

  const userRowsPerPage = 9;
  const totalUserPages = Math.max(1, Math.ceil(filteredAdminUsers.length / userRowsPerPage));
  const currentUserPage = Math.min(userPage, totalUserPages);
  const visibleAdminUsers = filteredAdminUsers.slice(
    (currentUserPage - 1) * userRowsPerPage,
    currentUserPage * userRowsPerPage
  );
  const userPaginationItems = getPaginationItems(currentUserPage, totalUserPages);
  const detailUser = selectedUserDetail?.user;
  const detailStats = selectedUserDetail?.stats || {};
  const detailActivities = selectedUserDetail?.activities || [];
  const detailReviews = selectedUserDetail?.reviews || [];
  const detailPosts = selectedUserDetail?.posts || [];
  const localDetailWatchlist = useMemo(
    () => getStoredUserWatchlist(detailUser),
    [detailUser?.id],
  );
  const detailWatchlist = useMemo(
    () => mergeWatchlistItems(selectedUserDetail?.watchlist || [], localDetailWatchlist),
    [selectedUserDetail?.watchlist, localDetailWatchlist],
  );
  const detailTotalWatchlist = Math.max(
    Number(detailStats.totalWatchlist || 0),
    detailWatchlist.length,
  );
  const activeReviewRows = useMemo(() => {
    const reportedRows = Array.isArray(adminReviews.reported) ? adminReviews.reported : [];
    const blockedRows = Array.isArray(adminReviews.blocked) ? adminReviews.blocked : [];

    if (activeReviewTab === "reported") {
      return reportedRows;
    }

    if (activeReviewTab === "blocked") {
      const reportedBlockedRows = reportedRows.filter((review) =>
        isBlockedReviewStatus(review.status)
      );

      return [
        ...blockedRows,
        ...reportedBlockedRows.filter(
          (review) =>
            !blockedRows.some((item) =>
              String(item.reportId || item.id) === String(review.reportId || review.id)
            )
        )
      ];
    }

    return Array.isArray(adminReviews[activeReviewTab])
      ? adminReviews[activeReviewTab]
      : [];
  }, [activeReviewTab, adminReviews]);
  const filteredAdminReviews = useMemo(() => {
    return activeReviewRows.filter((item) => {
      const mediaLabel = item.mediaType === "tv" ? "TV Series" : "Film";
      const matchesSearch =
        !normalizedSearch ||
        `${item.user?.name} ${item.title} ${item.content} ${item.reason} ${item.date} ${item.status}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesMedia = reviewMediaFilter === "Semua Media" || mediaLabel === reviewMediaFilter;
      const matchesRating =
        reviewRatingFilter === "Semua Rating" ||
        Number(item.rating || 0) === Number(reviewRatingFilter);

      return matchesSearch && matchesMedia && matchesRating;
    });
  }, [activeReviewRows, normalizedSearch, reviewMediaFilter, reviewRatingFilter]);
  const reviewRowsPerPage = 8;
  const totalReviewPages = Math.max(1, Math.ceil(filteredAdminReviews.length / reviewRowsPerPage));
  const currentReviewPage = Math.min(reviewPage, totalReviewPages);
  const visibleAdminReviews = filteredAdminReviews.slice(
    (currentReviewPage - 1) * reviewRowsPerPage,
    currentReviewPage * reviewRowsPerPage
  );
  const reviewPaginationItems = getPaginationItems(currentReviewPage, totalReviewPages);
  const activeCommunityRows = useMemo(() => {
    const reportedRows = Array.isArray(adminCommunity.reported) ? adminCommunity.reported : [];
    const blockedRows = Array.isArray(adminCommunity.blocked) ? adminCommunity.blocked : [];

    if (activeCommunityTab === "blocked") {
      const reportedBlockedRows = reportedRows.filter((post) =>
        isBlockedCommunityStatus(post.status)
      );

      return [
        ...blockedRows,
        ...reportedBlockedRows.filter(
          (post) =>
            !blockedRows.some((item) =>
              String(item.reportId || item.id) === String(post.reportId || post.id)
            )
        )
      ];
    }

    return Array.isArray(adminCommunity[activeCommunityTab])
      ? adminCommunity[activeCommunityTab]
      : [];
  }, [activeCommunityTab, adminCommunity]);
  const filteredCommunityPosts = useMemo(() => {
    if (!normalizedSearch) {
      return activeCommunityRows;
    }

    return activeCommunityRows.filter((item) =>
      `${item.author} ${item.title} ${item.content} ${item.reportReason} ${item.status}`
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [activeCommunityRows, normalizedSearch]);
  const communityRowsPerPage = 6;
  const totalCommunityPages = Math.max(1, Math.ceil(filteredCommunityPosts.length / communityRowsPerPage));
  const currentCommunityPage = Math.min(communityPage, totalCommunityPages);
  const visibleCommunityPosts = filteredCommunityPosts.slice(
    (currentCommunityPage - 1) * communityRowsPerPage,
    currentCommunityPage * communityRowsPerPage
  );
  const communityPaginationItems = getPaginationItems(currentCommunityPage, totalCommunityPages);
  const communitySummaryCards = [
    { value: adminCommunity.summary?.totalPost || 0, label: "Total Post" },
    { value: adminCommunity.summary?.totalReply || 0, label: "Total Reply" },
    { value: adminCommunity.summary?.reported || 0, label: "Post dilaporkan" },
    { value: adminCommunity.summary?.blocked || 0, label: "Post Terblokir" }
  ];

  const getTransactionPackageCategory = (transaction) => {
    const packageText = String(transaction.package || "").toLowerCase();
    const packageCode = String(transaction.packageCode || "").toLowerCase();
    const duration = Number(transaction.durationMonths || 0);

    if (
      duration >= 12 ||
      packageText.includes("eksklusif") ||
      packageText.includes("tahunan") ||
      packageCode.includes("year")
    ) {
      return "Eksklusif";
    }

    return "Premium";
  };

  const getTransactionPaymentCategory = (transaction) => {
    const methodCode = String(transaction.methodCode || "").toLowerCase();
    const methodText = String(transaction.method || "").toLowerCase();

    if (methodCode === "qris" || methodText.includes("qris") || methodText.includes("qr")) {
      return "QR Code";
    }

    if (
      methodCode === "ewallet" ||
      methodText.includes("wallet") ||
      methodText.includes("gopay") ||
      methodText.includes("dana") ||
      methodText.includes("ovo") ||
      methodText.includes("shopeepay")
    ) {
      return "E Wallet";
    }

    if (
      methodCode === "bank" ||
      methodText.includes("bank") ||
      methodText.includes("bca") ||
      methodText.includes("mandiri") ||
      methodText.includes("bni") ||
      methodText.includes("bri")
    ) {
      return "Bank";
    }

    return transaction.method || "-";
  };

  const filteredTransactions = useMemo(() => {
    const activeStatus = transactionStatusMap[activeTransactionTab];
    const items = Array.isArray(adminTransactions.items) ? adminTransactions.items : [];

    return items.filter((transaction) => {
      const matchesTab = !activeStatus || transaction.status === activeStatus;
      const matchesPackage =
        transactionPackageFilter === "Semua Paket" ||
        getTransactionPackageCategory(transaction) === transactionPackageFilter;
      const matchesPayment =
        transactionPaymentFilter === "Semua Pembayaran" ||
        getTransactionPaymentCategory(transaction) === transactionPaymentFilter;
      const matchesSearch =
        !normalizedSearch ||
        `${transaction.transactionId} ${transaction.user?.name} ${transaction.user?.email} ${transaction.package} ${transaction.method} ${transaction.status}`
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesTab && matchesPackage && matchesPayment && matchesSearch;
    });
  }, [
    activeTransactionTab,
    adminTransactions.items,
    normalizedSearch,
    transactionPackageFilter,
    transactionPaymentFilter
  ]);

  const transactionRowsPerPage = 5;
  const totalTransactionPages = Math.max(1, Math.ceil(filteredTransactions.length / transactionRowsPerPage));
  const currentTransactionPage = Math.min(transactionPage, totalTransactionPages);
  const visibleTransactions = filteredTransactions.slice(
    (currentTransactionPage - 1) * transactionRowsPerPage,
    currentTransactionPage * transactionRowsPerPage
  );
  const transactionPaginationItems = getPaginationItems(currentTransactionPage, totalTransactionPages);
  const selectedPaymentMethod =
    paymentMethods.find((method) => method.id === selectedPaymentMethodId) || paymentMethods[0];

  const filteredContactMessages = useMemo(() => {
    return adminContactMessages.messages.filter((message) => {
      const matchesTab = activeContactTab === "all" || message.status === activeContactTab;
      const matchesSearch =
        !normalizedSearch ||
        `${message.ticketCode} ${message.userName} ${message.userEmail} ${message.subject} ${message.categoryLabel} ${message.description} ${message.statusLabel} ${message.assignedAdminName || ""}`
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesTab && matchesSearch;
    });
  }, [activeContactTab, adminContactMessages.messages, normalizedSearch]);

  const contactRowsPerPage = 6;
  const totalContactPages = Math.max(1, Math.ceil(filteredContactMessages.length / contactRowsPerPage));
  const currentContactPage = Math.min(contactPage, totalContactPages);
  const visibleContactMessages = filteredContactMessages.slice(
    (currentContactPage - 1) * contactRowsPerPage,
    currentContactPage * contactRowsPerPage
  );
  const contactPaginationItems = getPaginationItems(currentContactPage, totalContactPages);

  const adminNotifications = useMemo(() => {
    const items = [];
    const pendingTransactions = (adminTransactions.items || []).filter((transaction) =>
      String(transaction.status || transaction.statusCode || "").toLowerCase().includes("pending")
    );
    const pendingReviewReports = (adminReviews.reported || []).filter(
      (review) =>
        !isBlockedReviewStatus(review.status) &&
        String(review.status || "").toLowerCase() !== "ditolak"
    );
    const pendingCommunityReports = (adminCommunity.reported || []).filter(
      (post) =>
        !isBlockedCommunityStatus(post.status) &&
        !isRejectedCommunityStatus(post.status)
    );
    const waitingTickets = (adminContactMessages.messages || []).filter((message) =>
      ["waiting_admin", "pending"].includes(String(message.status || "").toLowerCase())
    );

    pendingTransactions.slice(0, 3).forEach((transaction) => {
      items.push({
        id: `transaction-${transaction.id}`,
        type: "transaction",
        title: "Transaksi menunggu verifikasi",
        description: `${transaction.user?.name || "User FLIX"} - ${transaction.package || "Premium"}`,
        time: transaction.date || "Baru saja",
        icon: FiCreditCard,
        tone: "warning",
        targetPage: "transactions",
      });
    });

    pendingReviewReports.slice(0, 3).forEach((review) => {
      items.push({
        id: `review-${review.reportId || review.id}`,
        type: "review",
        title: "Report review masuk",
        description: review.title || "Review film/series",
        time: review.date || review.reportedAt || "Baru saja",
        icon: FiMessageSquare,
        tone: "danger",
        targetPage: "reviews",
        targetTab: "reported",
      });
    });

    pendingCommunityReports.slice(0, 3).forEach((post) => {
      items.push({
        id: `community-${post.reportId || post.id}`,
        type: "community",
        title: "Report community masuk",
        description: post.title || post.content || "Community post",
        time: post.reportedAt || post.date || "Baru saja",
        icon: FiUsers,
        tone: "danger",
        targetPage: "community",
        targetTab: "reported",
      });
    });

    waitingTickets.slice(0, 3).forEach((ticket) => {
      items.push({
        id: `ticket-${ticket.id}`,
        type: "contact",
        title: ticket.source === "contact_form" ? "Report Contact Us baru" : "Tiket customer service baru",
        description: `${ticket.userName || ticket.name || "User FLIX"} - ${ticket.categoryLabel || ticket.subject || "Report"}`,
        time: ticket.formattedDate || ticket.createdAt || "Baru saja",
        icon: FiBell,
        tone: "info",
        targetPage: "contact",
        targetTab: "waiting_admin",
      });
    });

    if (!items.length) {
      (dashboard.activities || []).slice(0, 4).forEach((activity, index) => {
        const Icon = activityIcons[activity.icon] || FiBell;

        items.push({
          id: `activity-${index}`,
          type: "activity",
          title: activity.title,
          description: "Aktivitas terbaru dashboard",
          time: activity.time,
          icon: Icon,
          tone: "neutral",
          targetPage: "dashboard",
        });
      });
    }

    return items.slice(0, 8);
  }, [
    adminCommunity.reported,
    adminContactMessages.messages,
    adminReviews.reported,
    adminTransactions.items,
    dashboard.activities,
  ]);

  const actionableNotificationCount = useMemo(() => {
    const actionableTypes = new Set(["transaction", "review", "community", "contact"]);
    return adminNotifications.filter((notification) => actionableTypes.has(notification.type)).length;
  }, [adminNotifications]);

  const chartItems = useMemo(() => {
    const values = dashboard.chart.map((item) => Number(item.value || 0));
    const maxValue = Math.max(...values, 1);

    return dashboard.chart.map((item) => {
      const value = Number(item.value || 0);
      const barHeight = value > 0 ? Math.max(12, Math.round((value / maxValue) * 100)) : 4;

      return {
        ...item,
        value,
        valueLabel: formatChartNumber(value),
        barHeight,
      };
    });
  }, [dashboard.chart]);

  const handleAdminNavClick = (itemId) => {
    if (!canAccessAdminPage(currentRole, itemId)) {
      return;
    }

    setActiveAdminPage(itemId);

    if (itemId === "movies") {
      setActiveMoviePanel("list");
      setSelectedEditingMovie(null);
      setAddMovieForm(defaultAddMovieForm);
      setAddMovieFeedback("");
    }

    if (itemId === "users") {
      setActiveUserPanel("list");
      setSelectedUserDetail(null);
      setUserDetailError("");
      setUserStatusFeedback("");
    }

    if (itemId === "community") {
      setActiveCommunityTab("all");
    }

    if (itemId === "transactions") {
      setActiveTransactionTab("all");
      setActiveTransactionPanel("list");
      setOpenTransactionFilter(null);
      setPaymentSettingsFeedback("");
    }

    if (itemId !== "reviews") {
      setSelectedReviewReport(null);
    }
  };

  const updateSelectedPaymentMethod = (field, value) => {
    setPaymentSettingsFeedback("");
    setPaymentMethods((methods) =>
      methods.map((method) =>
        method.id === selectedPaymentMethodId
          ? {
              ...method,
              [field]: value,
              ...(field === "type"
                ? {
                    category:
                      paymentMethodTypes.find((type) => type.id === value)?.label ||
                      method.category
                  }
                : {})
            }
          : method
      )
    );
  };

  const addPaymentMethod = () => {
    const nextId = `method-${Date.now()}`;
    const nextMethod = {
      id: nextId,
      type: "bank",
      name: "Metode Baru",
      category: "Bank",
      accountNumber: "",
      accountName: "FLIX Entertainment",
      imageUrl: "",
      imageName: ""
    };

    setPaymentMethods((methods) => [...methods, nextMethod]);
    setSelectedPaymentMethodId(nextId);
    setPaymentSettingsFeedback("Metode baru ditambahkan. Lengkapi datanya sebelum disimpan.");
  };

  const removePaymentMethod = (methodId) => {
    setPaymentMethods((methods) => {
      if (methods.length <= 1) {
        setPaymentSettingsFeedback("Minimal harus ada satu metode pembayaran.");
        return methods;
      }

      const nextMethods = methods.filter((method) => method.id !== methodId);

      if (selectedPaymentMethodId === methodId) {
        setSelectedPaymentMethodId(nextMethods[0]?.id || "");
      }

      return nextMethods;
    });
  };

  const uploadPaymentMethodImage = async (file) => {
    const token = localStorage.getItem("token");

    if (!token || !file) {
      return null;
    }

    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_URL}/api/uploads/editor-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    const data = response.ok ? await response.json() : null;

    if (!response.ok || !data?.imageUrl) {
      throw new Error(data?.message || "Gagal upload logo pembayaran.");
    }

    return data.imageUrl;
  };

  const handlePaymentMethodImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPaymentImageCropData((currentCropData) => {
      if (currentCropData?.previewUrl) {
        URL.revokeObjectURL(currentCropData.previewUrl);
      }

      return {
        methodId: selectedPaymentMethodId,
        file,
        previewUrl,
        naturalSize: null,
        pan: { x: 0, y: 0 },
        stageSize: { width: 1, height: 1 },
        zoom: 1
      };
    });
    setPaymentSettingsFeedback("Atur crop gambar pembayaran sebelum diupload.");
  };

  const closePaymentImageCropModal = () => {
    setPaymentImageCropData((currentCropData) => {
      if (currentCropData?.previewUrl) {
        URL.revokeObjectURL(currentCropData.previewUrl);
      }

      return null;
    });
    setIsCroppingPaymentImage(false);
  };

  const handleUseCroppedPaymentImage = async () => {
    if (!paymentImageCropData) {
      return;
    }

    try {
      setPaymentSettingsFeedback("Mengupload logo pembayaran...");
      setIsCroppingPaymentImage(true);
      const croppedBlob = await cropImageToBlob({
        source: paymentImageCropData.previewUrl,
        zoom: paymentImageCropData.zoom,
        pan: paymentImageCropData.pan,
        stageSize: paymentImageCropData.stageSize,
        outputWidth: paymentImageCropConfig.outputWidth,
        outputHeight: paymentImageCropConfig.outputHeight,
        type: paymentImageCropData.file.type
      });
      const croppedFile = new File(
        [croppedBlob],
        paymentImageCropData.file.name || "payment-method-image.jpg",
        {
          type: croppedBlob.type || "image/jpeg"
        }
      );
      const imageUrl = await uploadPaymentMethodImage(croppedFile);

      setPaymentMethods((methods) =>
        methods.map((method) =>
          method.id === paymentImageCropData.methodId
            ? {
                ...method,
                imageUrl,
                imageName: paymentImageCropData.file.name
              }
            : method
        )
      );
      setPaymentSettingsFeedback("Logo pembayaran berhasil diupload. Klik Simpan Perubahan untuk menyimpan.");
      closePaymentImageCropModal();
    } catch (error) {
      setPaymentSettingsFeedback(error.message || "Gagal upload logo pembayaran.");
      setIsCroppingPaymentImage(false);
    }
  };

  const savePaymentSettings = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setPaymentSettingsFeedback("Sesi admin tidak tersedia.");
      return;
    }

    try {
      setPaymentSettingsFeedback("Menyimpan pengaturan pembayaran...");
      const response = await fetch(`${API_URL}/api/admin/payment-settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          methods: paymentMethods.map((method, index) => ({
            ...method,
            sortOrder: index + 1
          })),
          packages: paymentPackageOptions.map((paymentPackage, index) => ({
            code: paymentPackage.id,
            name: paymentPackage.name,
            durationMonths: paymentPackage.id === "premium_yearly" ? 12 : 1,
            price: Number(parseAdminPriceInput(paymentPrices[paymentPackage.id])),
            sortOrder: index + 1
          }))
        })
      });
      const data = response.ok ? await response.json() : null;

      if (!response.ok || !Array.isArray(data?.methods)) {
        setPaymentSettingsFeedback(data?.message || "Gagal menyimpan pengaturan pembayaran.");
        return;
      }

      setPaymentMethods(data.methods);
      setSelectedPaymentMethodId(data.methods[0]?.id || "");
      if (Array.isArray(data.packages)) {
        setPaymentPrices((prices) => ({
          ...prices,
          ...data.packages.reduce((result, paymentPackage) => {
            result[paymentPackage.code] = formatAdminPriceInput(paymentPackage.price);
            return result;
          }, {})
        }));
      }
      setPaymentSettingsFeedback(data.message || "Pengaturan pembayaran berhasil disimpan.");
    } catch {
      setPaymentSettingsFeedback("Gagal menyimpan pengaturan pembayaran.");
    }
  };

  const updateTransactionStatus = async (transactionId, nextStatus) => {
    const token = localStorage.getItem("token");

    if (!token) {
      setTransactionsError("Sesi admin tidak tersedia.");
      return;
    }

    setTransactionActionLoading((current) => ({
      ...current,
      [transactionId]: nextStatus
    }));

    try {
      const response = await fetch(`${API_URL}/api/admin/transactions/${transactionId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: nextStatus })
      });

      const data = response.ok ? await response.json() : null;

      if (!response.ok || !data?.transaction) {
        setTransactionsError(data?.message || "Status transaksi gagal diperbarui.");
        return;
      }

      setAdminTransactions((current) => {
        const nextItems = current.items.map((item) =>
          item.id === transactionId ? data.transaction : item
        );

        return {
          summary: summarizeTransactions(nextItems),
          items: nextItems
        };
      });
      setSelectedTransactionDetail((currentTransaction) =>
        currentTransaction?.id === transactionId ? data.transaction : currentTransaction
      );
      setTransactionsError("");
    } catch {
      setTransactionsError("Status transaksi gagal diperbarui.");
    } finally {
      setTransactionActionLoading((current) => {
        const nextState = { ...current };
        delete nextState[transactionId];
        return nextState;
      });
    }
  };

  const openTransactionProof = (paymentProof) => {
    if (!paymentProof) {
      setTransactionsError("Bukti pembayaran belum tersedia.");
      return;
    }

    window.open(resolveMediaUrl(paymentProof), "_blank", "noopener,noreferrer");
  };

  const loadAdminUserDetail = async (userId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      setUserDetailError("Sesi admin tidak tersedia.");
      return;
    }

    setActiveUserPanel("detail");
    setSelectedUserDetail(null);
    setUserDetailError("");
    setUserStatusFeedback("");
    setIsUserDetailLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = response.ok ? await response.json() : null;

      if (!response.ok || !data) {
        setUserDetailError(data?.message || "Detail user belum bisa dimuat.");
        return;
      }

      setSelectedUserDetail(data);
    } catch {
      setUserDetailError("Detail user belum bisa dimuat.");
    } finally {
      setIsUserDetailLoading(false);
    }
  };

  const closeUserDetail = () => {
    setActiveUserPanel("list");
    setSelectedUserDetail(null);
    setUserDetailError("");
    setUserStatusFeedback("");
    setIsUserEditOpen(false);
    setIsResetPasswordOpen(false);
  };

  const syncAdminUserState = (updatedUser) => {
    if (!updatedUser?.id) {
      return;
    }

    setSelectedUserDetail((currentDetail) => {
      if (!currentDetail?.user) {
        return currentDetail;
      }

      return {
        ...currentDetail,
        user: {
          ...currentDetail.user,
          ...updatedUser,
        },
      };
    });

    setAdminUsers((currentUsers) =>
      currentUsers.map((item) =>
        item.id === updatedUser.id
          ? {
              ...item,
              ...updatedUser,
              activities: item.activities,
            }
          : item
      )
    );

    try {
      const storedUser = getStoredUser();
      if (Number(storedUser.id_user || storedUser.id) === Number(updatedUser.id)) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...storedUser,
            id_user: updatedUser.id,
            id: updatedUser.id,
            username: updatedUser.username,
            name: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            role_name: updatedUser.role,
            profile_image_url: updatedUser.profileImageUrl || storedUser.profile_image_url,
            profileImageUrl: updatedUser.profileImageUrl || storedUser.profileImageUrl,
          })
        );
      }
    } catch {
      // Ignore localStorage sync failure; backend state is already updated.
    }
  };

  const openEditUserModal = () => {
    if (!detailUser) {
      return;
    }

    setUserEditForm({
      username: detailUser.username || "",
      email: detailUser.email || "",
      role: detailUser.role || "registered_user",
    });
    setUserStatusFeedback("");
    setIsUserEditOpen(true);
  };

  const closeEditUserModal = () => {
    if (isSavingUserEdit) {
      return;
    }

    setIsUserEditOpen(false);
  };

  const handleSaveUserEdit = async (event) => {
    event.preventDefault();

    if (!detailUser?.id) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setUserStatusFeedback("Sesi admin tidak tersedia.");
      return;
    }

    setIsSavingUserEdit(true);
    setUserStatusFeedback("");

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${detailUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userEditForm),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.user) {
        setUserStatusFeedback(data?.message || "Data user belum bisa diperbarui.");
        return;
      }

      syncAdminUserState(data.user);
      setAdminUsersSummary((currentSummary) => {
        const oldRole = detailUser.role;
        const nextRole = data.user.role;

        if (oldRole === nextRole) {
          return currentSummary;
        }

        const roleToSummaryKey = {
          admin: "admin",
          moderator: "moderator",
          registered_user: "registeredUser"
        };
        const oldKey = roleToSummaryKey[oldRole] || "registeredUser";
        const nextKey = roleToSummaryKey[nextRole] || "registeredUser";

        return {
          ...currentSummary,
          [oldKey]: Math.max(0, Number(currentSummary[oldKey] || 0) - 1),
          [nextKey]: Number(currentSummary[nextKey] || 0) + 1,
        };
      });
      setIsUserEditOpen(false);
      setUserStatusFeedback(data.message || "Data user berhasil diperbarui.");
    } catch {
      setUserStatusFeedback("Data user belum bisa diperbarui.");
    } finally {
      setIsSavingUserEdit(false);
    }
  };

  const openResetPasswordModal = () => {
    setResetPasswordForm({
      password: "",
      confirmPassword: ""
    });
    setUserStatusFeedback("");
    setIsResetPasswordOpen(true);
  };

  const closeResetPasswordModal = () => {
    if (isResettingPassword) {
      return;
    }

    setIsResetPasswordOpen(false);
  };

  const handleGeneratePassword = () => {
    const randomPassword = `Flix${Math.random().toString(36).slice(2, 8)}${Math.floor(10 + Math.random() * 90)}`;
    setResetPasswordForm({
      password: randomPassword,
      confirmPassword: randomPassword,
    });
  };

  const handleResetUserPassword = async (event) => {
    event.preventDefault();

    if (!detailUser?.id) {
      return;
    }

    if (resetPasswordForm.password.length < 6) {
      setUserStatusFeedback("Password baru minimal 6 karakter.");
      return;
    }

    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setUserStatusFeedback("Konfirmasi password tidak sama.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setUserStatusFeedback("Sesi admin tidak tersedia.");
      return;
    }

    const shouldReset = await confirmAction({
      title: "Reset Password?",
      text: `Reset password untuk ${detailUser.username}?`,
      icon: "warning",
      confirmButtonText: "Reset Password",
    });

    if (!shouldReset) {
      return;
    }

    setIsResettingPassword(true);
    setUserStatusFeedback("");

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${detailUser.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: resetPasswordForm.password,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.user) {
        setUserStatusFeedback(data?.message || "Password user belum bisa direset.");
        return;
      }

      syncAdminUserState(data.user);
      setIsResetPasswordOpen(false);
      setUserStatusFeedback("Password user berhasil direset. Berikan password baru ke user secara aman.");
    } catch {
      setUserStatusFeedback("Password user belum bisa direset.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleToggleUserStatus = async () => {
    if (!detailUser?.id) {
      return;
    }

    const nextIsActive = detailUser.isActive === false;
    const confirmationMessage = nextIsActive
      ? `Aktifkan kembali user ${detailUser.username}?`
      : `Nonaktifkan user ${detailUser.username}? User tidak bisa login sampai diaktifkan kembali.`;

    const shouldUpdateStatus = await confirmAction({
      title: nextIsActive ? "Aktifkan User?" : "Nonaktifkan User?",
      text: confirmationMessage,
      icon: "warning",
      confirmButtonText: nextIsActive ? "Aktifkan" : "Nonaktifkan",
    });

    if (!shouldUpdateStatus) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setUserStatusFeedback("Sesi admin tidak tersedia.");
      return;
    }

    setIsUserStatusLoading(true);
    setUserStatusFeedback("");

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${detailUser.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_active: nextIsActive,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.user) {
        setUserStatusFeedback(
          data?.error
            ? `${data?.message || "Status user belum bisa diubah."}: ${data.error}`
            : data?.message || "Status user belum bisa diubah."
        );
        return;
      }

      syncAdminUserState(data.user);
      setUserStatusFeedback(data.message || "Status user berhasil diubah.");
    } catch {
      setUserStatusFeedback("Status user belum bisa diubah.");
    } finally {
      setIsUserStatusLoading(false);
    }
  };

  const openReviewDetail = (review) => {
    const hasReport = Boolean(review.reportId || review.reason);

    setSelectedReviewReport({
      ...review,
      hasReport,
      reason: hasReport ? review.reason || "Konten bermasalah" : "Tidak ada report masuk",
    });
  };

  const handleUpdateReviewReportStatus = async (review, status) => {
    const actionKey = String(review.reportId || review.id);
    const nextStatusLabel = status === "blocked" ? "Diblokir" : "Ditolak";
    const token = localStorage.getItem("token");

    setReviewsError("");
    setReviewReportActionLoading((current) => ({
      ...current,
      [actionKey]: status,
    }));

    try {
      let responseData = null;

      if (review.reportId) {
        if (!token) {
          throw new Error("Sesi admin tidak tersedia.");
        }

        const response = await fetch(`${API_URL}/api/admin/reviews/reports/${review.reportId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        });

        responseData = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(responseData?.message || "Status report review belum bisa diubah.");
        }
      }

      const updatedReview = {
        ...review,
        status: responseData?.report?.statusLabel || nextStatusLabel,
      };

      setAdminReviews((currentReviews) => {
        const isSameReviewReport = (item) =>
          String(item.reportId || item.id) === String(review.reportId || review.id);
        const reportedWithoutCurrent = (currentReviews.reported || []).filter(
          (item) => !isSameReviewReport(item)
        );
        const blockedWithoutCurrent = (currentReviews.blocked || []).filter(
          (item) => !isSameReviewReport(item)
        );
        const shouldMoveToBlocked =
          status === "blocked" ||
          isBlockedReviewStatus(updatedReview.status) ||
          isBlockedReviewStatus(responseData?.report?.status);
        const nextReported = [updatedReview, ...reportedWithoutCurrent];
        const nextBlocked = shouldMoveToBlocked
          ? [updatedReview, ...blockedWithoutCurrent]
          : blockedWithoutCurrent.filter((item) => !isSameReviewReport(item));

        return {
          ...currentReviews,
          reported: nextReported,
          blocked: nextBlocked,
          summary: {
            ...currentReviews.summary,
            reported: nextReported.length,
            blocked: nextBlocked.length,
          },
        };
      });
      setSelectedReviewReport(null);
    } catch (error) {
      setReviewsError(error.message || "Status report review belum bisa diubah.");
    } finally {
      setReviewReportActionLoading((current) => {
        const next = { ...current };
        delete next[actionKey];
        return next;
      });
    }
  };

  const openCommunityDetail = (post) => {
    const hasReport = Boolean(post.reportId || post.reportReason);

    setSelectedCommunityReport({
      ...post,
      hasReport,
      reportReason: hasReport ? post.reportReason || "Konten community dilaporkan" : "Tidak ada report masuk",
      reportedAt: hasReport ? post.reportedAt || "-" : "Tidak ada report masuk",
    });
  };

  const handleUpdateCommunityReportStatus = async (post, status) => {
    const actionKey = String(post.reportId || post.id);
    const nextStatusLabel = status === "blocked" ? "Terblokir" : "Ditolak";
    const token = localStorage.getItem("token");

    if (!post.reportId) {
      setCommunityError("Post ini belum memiliki report untuk dimoderasi.");
      return;
    }

    setCommunityError("");
    setCommunityReportActionLoading((current) => ({
      ...current,
      [actionKey]: status,
    }));

    try {
      if (!token) {
        throw new Error("Sesi admin tidak tersedia.");
      }

      const response = await fetch(`${API_URL}/api/admin/community/reports/${post.reportId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseData?.message || "Status report community belum bisa diubah.");
      }

      const updatedPost = {
        ...post,
        status: responseData?.report?.statusLabel || nextStatusLabel,
        targetStatus: responseData?.target?.status || (status === "blocked" ? "blocked" : "active"),
        targetStatusLabel: responseData?.target?.statusLabel || (status === "blocked" ? "Terblokir" : "Aktif"),
      };

      setAdminCommunity((currentCommunity) => {
        const isSameReport = (item) =>
          String(item.reportId || item.id) === String(post.reportId || post.id);
        const isSameTarget = (item) => {
          if (post.targetKind === "reply") {
            return item.commentId && String(item.commentId) === String(post.commentId);
          }

          return item.postId && String(item.postId) === String(post.postId);
        };
        const reportedWithoutCurrent = (currentCommunity.reported || []).filter(
          (item) => !isSameReport(item)
        );
        const blockedWithoutCurrent = (currentCommunity.blocked || []).filter(
          (item) => !isSameReport(item)
        );
        const shouldMoveToBlocked =
          status === "blocked" ||
          isBlockedCommunityStatus(updatedPost.status) ||
          isBlockedCommunityStatus(responseData?.report?.status);
        const nextReported = [updatedPost, ...reportedWithoutCurrent];
        const nextBlocked = shouldMoveToBlocked
          ? [updatedPost, ...blockedWithoutCurrent]
          : blockedWithoutCurrent;
        const nextAll = (currentCommunity.all || []).map((item) =>
          isSameTarget(item)
            ? {
                ...item,
                status: updatedPost.targetStatusLabel,
                targetStatus: updatedPost.targetStatus,
                targetStatusLabel: updatedPost.targetStatusLabel,
              }
            : item
        );

        return {
          ...currentCommunity,
          all: nextAll,
          reported: nextReported,
          blocked: nextBlocked,
          summary: {
            ...currentCommunity.summary,
            reported: nextReported.length,
            blocked: nextBlocked.length,
          },
        };
      });

      setSelectedCommunityReport(null);
    } catch (error) {
      setCommunityError(error.message || "Status report community belum bisa diubah.");
    } finally {
      setCommunityReportActionLoading((current) => {
        const next = { ...current };
        delete next[actionKey];
        return next;
      });
    }
  };

  const updateContactTicketState = (ticket) => {
    if (!ticket) {
      return;
    }

    const normalizedTicket =
      ticket.source === "contact_form" ? normalizeContactFormMessage(ticket) : normalizeContactTicketMessage(ticket);

    setAdminContactMessages((currentMessages) => {
      const hasTicket = currentMessages.messages.some((item) => String(item.id) === String(normalizedTicket.id));
      const nextMessages = hasTicket
        ? currentMessages.messages.map((item) =>
            String(item.id) === String(normalizedTicket.id) ? normalizedTicket : item
          )
        : [normalizedTicket, ...currentMessages.messages];
      const nextSummary = summarizeContactMessages(nextMessages);

      return {
        summary: nextSummary,
        messages: nextMessages,
      };
    });

    setSelectedContactMessage((currentMessage) =>
      currentMessage && String(currentMessage.id) === String(normalizedTicket.id)
        ? { ...currentMessage, ...normalizedTicket }
        : currentMessage
    );
  };

  const openContactTicketDetail = async (ticket) => {
    const token = localStorage.getItem("token");

    setSelectedContactMessage({
      ...ticket,
      messages: ticket.messages || [],
      attachments: ticket.attachments || [],
    });
    setContactReplyText("");
    setContactResolutionNote("");
    setContactReplyFiles([]);
    setContactActionLoading((current) => ({
      ...current,
      [String(ticket.id)]: "detail",
    }));

    try {
      if (ticket.source === "contact_form") {
        return;
      }

      if (!token) {
        throw new Error("Sesi admin tidak tersedia.");
      }

      const response = await fetch(`${API_URL}/api/admin/customer-service/tickets/${ticket.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseData?.message || "Detail tiket belum bisa dimuat.");
      }

      setSelectedContactMessage({
        ...responseData.ticket,
        messages: responseData.messages || [],
        attachments: responseData.attachments || [],
      });
      updateContactTicketState(responseData.ticket);
    } catch (error) {
      setContactError(error.message || "Detail tiket belum bisa dimuat.");
    } finally {
      setContactActionLoading((current) => {
        const next = { ...current };
        delete next[String(ticket.id)];
        return next;
      });
    }
  };

  const handleUpdateContactFormStatus = async (message, nextStatus) => {
    const token = localStorage.getItem("token");
    const actionKey = String(message.id);
    const contactId = Number(message.sourceId);

    if (!contactId) {
      setContactError("ID laporan Contact Us tidak valid.");
      return;
    }

    setContactError("");
    setContactActionLoading((current) => ({ ...current, [actionKey]: nextStatus }));

    try {
      const response = await fetch(`${API_URL}/api/admin/contact-us/${contactId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseData?.message || "Status laporan belum bisa diubah.");
      }

      const normalizedMessage = normalizeContactFormMessage(responseData.contactMessage);
      updateContactTicketState(normalizedMessage);
    } catch (error) {
      setContactError(error.message || "Status laporan belum bisa diubah.");
    } finally {
      setContactActionLoading((current) => {
        const next = { ...current };
        delete next[actionKey];
        return next;
      });
    }
  };

  const handleClaimContactTicket = async (ticket) => {
    if (ticket.source === "contact_form") {
      await handleUpdateContactFormStatus(ticket, "reviewed");
      return;
    }

    const token = localStorage.getItem("token");
    const actionKey = String(ticket.id);

    setContactError("");
    setContactActionLoading((current) => ({ ...current, [actionKey]: "claim" }));

    try {
      const response = await fetch(`${API_URL}/api/admin/customer-service/tickets/${ticket.id}/claim`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseData?.message || "Tiket belum bisa diambil.");
      }

      setSelectedContactMessage({
        ...responseData.ticket,
        messages: responseData.messages || [],
        attachments: responseData.attachments || [],
      });
      updateContactTicketState(responseData.ticket);
    } catch (error) {
      setContactError(error.message || "Tiket belum bisa diambil.");
    } finally {
      setContactActionLoading((current) => {
        const next = { ...current };
        delete next[actionKey];
        return next;
      });
    }
  };

  const handleSendContactReply = async (event) => {
    event.preventDefault();

    if (!selectedContactMessage || selectedContactMessage.source === "contact_form") {
      return;
    }

    const token = localStorage.getItem("token");
    const actionKey = String(selectedContactMessage.id);
    const text = contactReplyText.trim();

    if (!text && !contactReplyFiles.length) {
      return;
    }

    setContactError("");
    setContactActionLoading((current) => ({ ...current, [actionKey]: "reply" }));

    try {
      const formData = new FormData();
      formData.append("message", text);
      contactReplyFiles.forEach((file) => formData.append("attachments", file));

      const response = await fetch(
        `${API_URL}/api/admin/customer-service/tickets/${selectedContactMessage.id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );
      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseData?.message || "Balasan belum bisa dikirim.");
      }

      setSelectedContactMessage({
        ...responseData.ticket,
        messages: responseData.messages || [],
        attachments: responseData.attachments || [],
      });
      updateContactTicketState(responseData.ticket);
      setContactReplyText("");
      setContactReplyFiles([]);
    } catch (error) {
      setContactError(error.message || "Balasan belum bisa dikirim.");
    } finally {
      setContactActionLoading((current) => {
        const next = { ...current };
        delete next[actionKey];
        return next;
      });
    }
  };

  const handleCloseContactTicket = async () => {
    if (!selectedContactMessage) {
      return;
    }

    if (selectedContactMessage.source === "contact_form") {
      await handleUpdateContactFormStatus(selectedContactMessage, "resolved");
      return;
    }

    const token = localStorage.getItem("token");
    const actionKey = String(selectedContactMessage.id);

    setContactError("");
    setContactActionLoading((current) => ({ ...current, [actionKey]: "close" }));

    try {
      const response = await fetch(
        `${API_URL}/api/admin/customer-service/tickets/${selectedContactMessage.id}/close`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ resolutionNote: contactResolutionNote }),
        },
      );
      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseData?.message || "Tiket belum bisa diselesaikan.");
      }

      setSelectedContactMessage({
        ...responseData.ticket,
        messages: responseData.messages || [],
        attachments: responseData.attachments || [],
      });
      updateContactTicketState(responseData.ticket);
      setContactResolutionNote("");
    } catch (error) {
      setContactError(error.message || "Tiket belum bisa diselesaikan.");
    } finally {
      setContactActionLoading((current) => {
        const next = { ...current };
        delete next[actionKey];
        return next;
      });
    }
  };

  const handleAddMovieFieldChange = (field, value) => {
    setAddMovieFeedback("");
    setAddMovieForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  };

  const toggleAddMovieOption = (field, value) => {
    setAddMovieFeedback("");
    setAddMovieForm((currentForm) => {
      const currentValues = currentForm[field];
      const hasValue = currentValues.includes(value);
      const nextValues = hasValue
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...currentForm,
        [field]: nextValues.length ? nextValues : [value]
      };
    });
  };

  const handlePosterFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleAddMovieFieldChange("posterDataUrl", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const openAddMovieForm = () => {
    setSelectedEditingMovie(null);
    setAddMovieForm(defaultAddMovieForm);
    setAddMovieFeedback("");
    setActiveMoviePanel("add");
  };

  const openEditMovieList = () => {
    setSelectedEditingMovie(null);
    setAddMovieForm(defaultAddMovieForm);
    setAddMovieFeedback("");
    setActiveMoviePanel("edit");
  };

  const openEditMovieForm = (movie) => {
    setSelectedEditingMovie(movie);
    setAddMovieForm(mapMovieToAdminForm(movie));
    setAddMovieFeedback("");
    setActiveMoviePanel("edit");
  };

  const handleSaveAdminMovie = async (status) => {
    if (!addMovieForm.title.trim()) {
      setAddMovieFeedback("Judul film wajib diisi sebelum disimpan.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setAddMovieFeedback("Sesi admin tidak tersedia. Silakan login ulang.");
      return;
    }

    const payload = {
      title: addMovieForm.title.trim(),
      year: addMovieForm.year.trim() || "-",
      rating: addMovieForm.rating.trim() || "-",
      status,
      posterUrl: addMoviePosterPreview || "",
      trailerUrl: addMovieForm.trailerUrl.trim(),
      duration: addMovieForm.duration.trim(),
      director: addMovieForm.director.trim(),
      synopsis: addMovieForm.synopsis.trim(),
      cast: addMovieForm.cast.trim(),
      country: addMovieForm.country.trim(),
      genres: addMovieForm.genres,
      platforms: addMovieForm.platforms,
      moods: addMovieForm.moods
    };

    setIsSavingMovie(true);
    setAddMovieFeedback("");

    try {
      const isEditRequest = Boolean(selectedEditingMovie?.id);
      const response = await fetch(
        isEditRequest ? `${API_URL}/api/admin/movies/${selectedEditingMovie.id}` : `${API_URL}/api/admin/movies`,
        {
          method: isEditRequest ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.movie) {
        setAddMovieFeedback(data?.message || "Film belum bisa disimpan.");
        return;
      }

      if (isEditRequest) {
        setManagedMovies((currentMovies) =>
          currentMovies.map((movie) => (Number(movie.id) === Number(data.movie.id) ? data.movie : movie))
        );
      } else {
        setManagedMovies((currentMovies) => [data.movie, ...currentMovies]);
        setManagedMoviesTotal((currentTotal) => Number(currentTotal || managedMovies.length) + 1);
      }

      setFilmPage(1);
      setAddMovieForm(defaultAddMovieForm);
      setSelectedEditingMovie(null);
      setAddMovieFeedback(data.message || (status === "Draft" ? "Draft film berhasil disimpan." : "Film berhasil dipublish."));
      setActiveMoviePanel("list");
      setMoviesError("");
    } catch {
      setAddMovieFeedback("Film belum bisa disimpan karena koneksi backend bermasalah.");
    } finally {
      setIsSavingMovie(false);
    }
  };

  return (
    <main className="admin-dashboard">
      <aside className="admin-sidebar" aria-label="Navigasi admin">
        <div className="admin-brand">
          <img src={flixAdminLogo} alt="FLIX Admin" className="admin-brand__admin-logo" />
          <Link to="/" className="admin-brand__home-link" aria-label="Kembali ke halaman awal">
            <img src={flixLogo} alt="FLIX" className="admin-brand__flix-logo" />
          </Link>
        </div>

        <nav className="admin-nav">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <div className="admin-nav__group" key={item.id}>
                <button
                  type="button"
                  className={`admin-nav__item${
                    activeAdminPage === item.id ? " admin-nav__item--active" : ""
                  }`}
                  onClick={() => handleAdminNavClick(item.id)}
                >
                  {item.image ? (
                    <img src={item.image} alt="" className="admin-nav__asset-icon" aria-hidden="true" />
                  ) : (
                    <Icon aria-hidden="true" />
                  )}
                  <span>{item.label}</span>
                </button>

                {item.id === "movies" && activeAdminPage === "movies" && (
                  <div className="admin-nav__submenu" aria-label="Submenu kelola film">
                    <button
                      type="button"
                      className={activeMoviePanel === "add" ? "admin-nav__submenu-item--active" : ""}
                      onClick={openAddMovieForm}
                    >
                      <FiPlus aria-hidden="true" />
                      <span>Tambah Film</span>
                    </button>
                    <button
                      type="button"
                      className={activeMoviePanel === "edit" ? "admin-nav__submenu-item--active" : ""}
                      onClick={openEditMovieList}
                    >
                      <FiEdit3 aria-hidden="true" />
                      <span>Edit Film</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar__bottom">
          <button type="button" className="admin-sidebar__logout" onClick={handleLogout}>
            <FiLogOut aria-hidden="true" />
            <span>Log Out</span>
          </button>

          <div className="admin-profile">
            <div className="admin-profile__avatar">
              <AdminAvatar imageUrl={adminProfileImageUrl} name={adminName} isPremium={user?.is_premium} />
            </div>
            <div className="admin-profile__meta">
              <strong>{adminName}</strong>
              <span>{isModerator ? "Moderator FLIX" : "Admin FLIX"}</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="admin-content-head">
            <div>
              <h1>{adminPageTitle}</h1>
            </div>

            <div className="admin-content-head__actions">
              <label className="admin-search">
                <FiSearch aria-hidden="true" />
                <input
                  type="search"
                  placeholder={
                    activeAdminPage === "movies"
                      ? "Cari film..."
                      : activeAdminPage === "users"
                        ? "Cari user..."
                        : activeAdminPage === "reviews"
                          ? "Cari review..."
                          : activeAdminPage === "community"
                            ? "Cari post..."
                            : activeAdminPage === "transactions"
                              ? "Cari transaksi..."
                        : "Cari..."
                  }
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
              <div className="admin-notification">
                <button
                  type="button"
                  className="admin-icon-button"
                  aria-label="Notifikasi admin"
                  aria-expanded={isAdminNotificationOpen}
                  onClick={() => setIsAdminNotificationOpen((current) => !current)}
                >
                  <FiBell aria-hidden="true" />
                  {actionableNotificationCount > 0 && (
                    <span className="admin-icon-button__dot">
                      {actionableNotificationCount > 9 ? "9+" : actionableNotificationCount}
                    </span>
                  )}
                </button>

                {isAdminNotificationOpen && (
                  <div className="admin-notification__panel" role="dialog" aria-label="Notifikasi admin">
                    <header>
                      <div>
                        <span>Notifikasi</span>
                        <h2>Aktivitas Admin</h2>
                      </div>
                      <small>{formatChartNumber(actionableNotificationCount)} perlu ditinjau</small>
                    </header>

                    <div className="admin-notification__list">
                      {adminNotifications.map((notification) => {
                        const Icon = notification.icon || FiBell;

                        return (
                          <button
                            type="button"
                            key={notification.id}
                            className={`admin-notification__item admin-notification__item--${notification.tone || "neutral"}`}
                            onClick={() => handleAdminNotificationClick(notification)}
                          >
                            <span className="admin-notification__icon">
                              <Icon aria-hidden="true" />
                            </span>
                            <span className="admin-notification__body">
                              <strong>{notification.title}</strong>
                              <span>{formatPostPreview(notification.description, 72)}</span>
                            </span>
                            <small>{notification.time}</small>
                          </button>
                        );
                      })}

                      {!adminNotifications.length && (
                        <div className="admin-notification__empty">
                          Belum ada notifikasi admin.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content">
          {activeAdminPage === "movies" ? (
            <section className="admin-manage-film" aria-label="Kelola film">
              {moviesError && <p className="admin-dashboard-alert">{moviesError}</p>}

              {isMovieFormPanel && (
                <section className="admin-add-movie" aria-label={isEditingMovie ? "Edit film" : "Tambah film baru"}>
                  <div className="admin-add-movie__head">
                    <div>
                      <h2>{isEditingMovie ? "Edit Film" : "Tambah Film Baru"}</h2>
                      <p>
                        {isEditingMovie
                          ? "Ubah informasi film lalu simpan sebagai draft atau publish."
                          : "Isi semua informasi film yang ingin ditambahkan."}
                      </p>
                    </div>

                    <div className="admin-add-movie__actions">
                      <button type="button" disabled={isSavingMovie} onClick={() => handleSaveAdminMovie("Draft")}>
                        {isSavingMovie ? "Menyimpan..." : "Draf"}
                      </button>
                      <button
                        type="button"
                        className="admin-add-movie__save"
                        disabled={isSavingMovie}
                        onClick={() => handleSaveAdminMovie("Published")}
                      >
                        <FiCheck aria-hidden="true" />
                        {isSavingMovie ? "Menyimpan..." : "Simpan Film"}
                      </button>
                    </div>
                  </div>

                  {addMovieFeedback && (
                    <p className="admin-add-movie__feedback">{addMovieFeedback}</p>
                  )}

                  <div className="admin-add-movie__grid">
                    <article className="admin-panel admin-add-movie__panel">
                      <h3>Informasi Film</h3>
                      <div className="admin-add-movie__divider" />

                      <label className="admin-add-movie__field">
                        <span>Judul Film</span>
                        <input
                          type="text"
                          placeholder="contoh: Oppenheimer"
                          value={addMovieForm.title}
                          onChange={(event) => handleAddMovieFieldChange("title", event.target.value)}
                        />
                      </label>

                      <div className="admin-add-movie__field-row">
                        <label className="admin-add-movie__field">
                          <span>Tahun Rilis</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="2024"
                            value={addMovieForm.year}
                            onChange={(event) => handleAddMovieFieldChange("year", event.target.value)}
                          />
                        </label>
                        <label className="admin-add-movie__field">
                          <span>Durasi</span>
                          <input
                            type="text"
                            placeholder="contoh: 2j 30m"
                            value={addMovieForm.duration}
                            onChange={(event) => handleAddMovieFieldChange("duration", event.target.value)}
                          />
                        </label>
                      </div>

                      <label className="admin-add-movie__field">
                        <span>Sutradara</span>
                        <input
                          type="text"
                          placeholder="contoh: Christopher Nolan"
                          value={addMovieForm.director}
                          onChange={(event) => handleAddMovieFieldChange("director", event.target.value)}
                        />
                      </label>

                      <label className="admin-add-movie__field">
                        <span>Sinopsis</span>
                        <textarea
                          maxLength={500}
                          placeholder="Tulis sinopsis film di sini..."
                          value={addMovieForm.synopsis}
                          onChange={(event) => handleAddMovieFieldChange("synopsis", event.target.value)}
                        />
                        <small>{addMovieForm.synopsis.length}/500 karakter</small>
                      </label>

                      <label className="admin-add-movie__field">
                        <span>Pemeran Utama</span>
                        <input
                          type="text"
                          placeholder="contoh: Cillian Murphy, Emily Blunt, Matt Damon"
                          value={addMovieForm.cast}
                          onChange={(event) => handleAddMovieFieldChange("cast", event.target.value)}
                        />
                        <small>Pisahkan dengan koma</small>
                      </label>
                    </article>

                    <article className="admin-panel admin-add-movie__panel">
                      <h3>Poster Film</h3>
                      <label className="admin-add-movie__upload">
                        <input type="file" accept="image/*" onChange={handlePosterFileChange} />
                        {addMoviePosterPreview ? (
                          <img src={addMoviePosterPreview} alt="Preview poster film" />
                        ) : (
                          <span>
                            <FiUploadCloud aria-hidden="true" />
                            Klik untuk upload poster atau drag & drop di sini
                            <small>JPG, PNG, WEBP - Maks 2 MB</small>
                          </span>
                        )}
                      </label>

                      <label className="admin-add-movie__field">
                        <span>URL Poster (Opsional)</span>
                        <input
                          type="url"
                          placeholder="https://..."
                          value={addMovieForm.posterUrl}
                          onChange={(event) => handleAddMovieFieldChange("posterUrl", event.target.value)}
                        />
                      </label>

                      <label className="admin-add-movie__field">
                        <span>URL Trailer</span>
                        <input
                          type="url"
                          placeholder="https://youtube.com/..."
                          value={addMovieForm.trailerUrl}
                          onChange={(event) => handleAddMovieFieldChange("trailerUrl", event.target.value)}
                        />
                      </label>
                    </article>

                    <article className="admin-panel admin-add-movie__panel">
                      <h3>Genre & Platform Film</h3>
                      <div className="admin-add-movie__divider" />

                      <div className="admin-add-movie__chip-group">
                        <span>Genre</span>
                        <div>
                          {genreOptions.map((genre) => (
                            <button
                              type="button"
                              key={genre}
                              className={addMovieForm.genres.includes(genre) ? "admin-add-movie__chip--active" : ""}
                              onClick={() => toggleAddMovieOption("genres", genre)}
                            >
                              {genre}
                            </button>
                          ))}
                          <button type="button" aria-label="Tambah genre">+</button>
                        </div>
                      </div>

                      <div className="admin-add-movie__chip-group">
                        <span>Platform Tersedia</span>
                        <div>
                          {platformOptions.map((platform) => (
                            <button
                              type="button"
                              key={platform}
                              className={
                                addMovieForm.platforms.includes(platform) ? "admin-add-movie__chip--active" : ""
                              }
                              onClick={() => toggleAddMovieOption("platforms", platform)}
                            >
                              {platform}
                            </button>
                          ))}
                          <button type="button" aria-label="Tambah platform">+</button>
                        </div>
                      </div>
                    </article>

                    <article className="admin-panel admin-add-movie__panel">
                      <h3>Tag Mood</h3>
                      <div className="admin-add-movie__divider" />

                      <div className="admin-add-movie__chip-group">
                        <span>Pilih mood yang cocok untuk film ini</span>
                        <div>
                          {moodOptions.map((mood) => (
                            <button
                              type="button"
                              key={mood}
                              className={addMovieForm.moods.includes(mood) ? "admin-add-movie__chip--active" : ""}
                              onClick={() => toggleAddMovieOption("moods", mood)}
                            >
                              {mood}
                            </button>
                          ))}
                          <button type="button" aria-label="Tambah mood">+</button>
                        </div>
                      </div>
                    </article>

                    <article className="admin-panel admin-add-movie__panel admin-add-movie__panel--rating">
                      <h3>Rating</h3>
                      <div className="admin-add-movie__divider" />

                      <div className="admin-add-movie__field-row">
                        <label className="admin-add-movie__field">
                          <span>Rating (1-10)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="8.5"
                            value={addMovieForm.rating}
                            onChange={(event) => handleAddMovieFieldChange("rating", event.target.value)}
                          />
                        </label>
                        <label className="admin-add-movie__field">
                          <span>Negara Asal</span>
                          <input
                            type="text"
                            placeholder="contoh: Amerika Serikat"
                            value={addMovieForm.country}
                            onChange={(event) => handleAddMovieFieldChange("country", event.target.value)}
                          />
                        </label>
                      </div>
                    </article>
                  </div>
                </section>
              )}

              {activeMoviePanel === "edit" && !selectedEditingMovie && (
                <article className="admin-panel admin-manage-film__card admin-edit-film__card">
                  <div className="admin-manage-film__header">
                    <div>
                      <h2>Edit Film</h2>
                      <p>Pilih film dari daftar, lalu lanjutkan proses edit data.</p>
                    </div>
                  </div>

                  <div className="admin-edit-film__list">
                    {visibleManagedMovies.map((movie) => (
                      <div className="admin-edit-film__item" key={`edit-${movie.mediaType}-${movie.id}`}>
                        <div className="admin-manage-table__movie">
                          <img src={movie.poster || flixAdminLogo} alt={movie.title} />
                          <div>
                            <strong>{movie.title}</strong>
                            <span>{movie.year} - {movie.genre}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => openEditMovieForm(movie)}>
                          <FiEdit3 aria-hidden="true" />
                          Edit
                        </button>
                      </div>
                    ))}

                    {!visibleManagedMovies.length && (
                      <p className="admin-empty-state">
                        {isLoading ? "Memuat data film..." : "Belum ada film yang bisa diedit."}
                      </p>
                    )}
                  </div>
                </article>
              )}

              {activeMoviePanel === "list" && (
              <article className="admin-panel admin-manage-film__card">
                <div className="admin-manage-film__header">
                  <div>
                    <h2>Semua Film</h2>
                    <p>Total {isLoading ? "..." : formatChartNumber(filmTotalLabel)} Film manual terdaftar</p>
                  </div>

                  <div className="admin-manage-film__actions">
                    <button
                      type="button"
                      className="admin-manage-film__add"
                      onClick={openAddMovieForm}
                    >
                      <FiPlus aria-hidden="true" />
                      Tambah Film
                    </button>
                    <AdminFilterButton
                      id="movies"
                      openFilter={openAdminFilter}
                      setOpenFilter={setOpenAdminFilter}
                      groups={[
                        {
                          id: "type",
                          label: "Tipe",
                          value: movieTypeFilter,
                          onChange: setMovieTypeFilter,
                          options: ["Semua Tipe", "Film", "TV Series"]
                        },
                        {
                          id: "status",
                          label: "Status",
                          value: movieStatusFilter,
                          onChange: setMovieStatusFilter,
                          options: movieStatusOptions
                        },
                        {
                          id: "genre",
                          label: "Genre",
                          value: movieGenreFilter,
                          onChange: setMovieGenreFilter,
                          options: movieGenreOptions
                        }
                      ]}
                    />
                  </div>
                </div>

                <div className="admin-manage-table" role="table" aria-label="Semua film admin">
                  <div
                    className="admin-manage-table__row admin-manage-table__row--head"
                    role="row"
                  >
                    <span role="columnheader">No</span>
                    <span role="columnheader">Film</span>
                    <span role="columnheader">Genre</span>
                    <span role="columnheader">Rating</span>
                    <span role="columnheader">Watchlist</span>
                  </div>

                  {visibleManagedMovies.map((movie, index) => (
                    <div
                      className="admin-manage-table__row"
                      role="row"
                      key={`${movie.mediaType}-${movie.id}-${movie.title}`}
                    >
                      <span className="admin-manage-table__no" role="cell">
                        {(currentFilmPage - 1) * filmRowsPerPage + index + 1}
                      </span>
                      <div className="admin-manage-table__movie" role="cell">
                        <img src={movie.poster || flixAdminLogo} alt={movie.title} />
                        <div>
                          <strong>{movie.title}</strong>
                          <span>{movie.year}</span>
                        </div>
                      </div>
                      <span role="cell">{movie.genre}</span>
                      <span className="admin-manage-table__rating" role="cell">
                        <FaStar aria-hidden="true" />
                        {movie.rating}
                      </span>
                      <span role="cell">{movie.watchlist || movie.reviewCount || "0"}</span>
                    </div>
                  ))}

                  {!visibleManagedMovies.length && (
                    <div className="admin-manage-table__empty">
                      {isLoading ? "Memuat data film..." : "Belum ada film manual yang ditambahkan."}
                    </div>
                  )}
                </div>

                <div className="admin-manage-pagination" aria-label="Pagination film">
                  <button
                    type="button"
                    aria-label="Halaman sebelumnya"
                    disabled={currentFilmPage === 1}
                    onClick={() => setFilmPage((page) => Math.max(1, page - 1))}
                  >
                    &lt;
                  </button>
                  {paginationItems.map((item, index) =>
                    typeof item === "string" ? (
                      <span key={`${item}-${index}`} className="admin-manage-pagination__ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        type="button"
                        key={item}
                        className={currentFilmPage === item ? "admin-manage-pagination__active" : ""}
                        onClick={() => setFilmPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    aria-label="Halaman berikutnya"
                    disabled={currentFilmPage === totalFilmPages}
                    onClick={() => setFilmPage((page) => Math.min(totalFilmPages, page + 1))}
                  >
                    &gt;
                  </button>
                </div>
              </article>
              )}
            </section>
          ) : activeAdminPage === "reviews" ? (
            <section className="admin-review-management" aria-label="Moderasi review">
              {reviewsError && <p className="admin-dashboard-alert">{reviewsError}</p>}

              <article className="admin-panel admin-review-card">
                <div className="admin-review-card__header">
                  <div>
                    <h2>Moderasi Review</h2>
                    <p>
                      {formatChartNumber(adminReviews.summary?.incoming || 0)} review menunggu persetujuan
                    </p>
                  </div>

                  <AdminFilterButton
                    id="reviews"
                    openFilter={openAdminFilter}
                    setOpenFilter={setOpenAdminFilter}
                    groups={[
                      {
                        id: "media",
                        label: "Media",
                        value: reviewMediaFilter,
                        onChange: setReviewMediaFilter,
                        options: ["Semua Media", "Film", "TV Series"]
                      },
                      {
                        id: "rating",
                        label: "Rating",
                        value: reviewRatingFilter,
                        onChange: setReviewRatingFilter,
                        options: ["Semua Rating", "5", "4", "3", "2", "1"]
                      }
                    ]}
                  />
                </div>

                <div className="admin-review-tabs" role="tablist" aria-label="Filter moderasi review">
                  {reviewTabs.map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      className={activeReviewTab === tab.id ? "admin-review-tabs__item--active" : ""}
                      role="tab"
                      aria-selected={activeReviewTab === tab.id}
                      onClick={() => {
                        setActiveReviewTab(tab.id);
                        setSelectedReviewReport(null);
                      }}
                    >
                      <span>{tab.label}</span>
                      <small>{formatChartNumber(adminReviews.summary?.[tab.countKey] || 0)}</small>
                    </button>
                  ))}
                </div>

                <div className="admin-review-table" role="table" aria-label="Daftar moderasi review">
                  {activeReviewTab === "reported" ? (
                    <>
                      <div
                        className="admin-review-table__row admin-review-table__row--head admin-review-table__row--report"
                        role="row"
                      >
                        <span role="columnheader">No</span>
                        <span role="columnheader">User Pelapor</span>
                        <span role="columnheader">Film</span>
                        <span role="columnheader">Review</span>
                        <span role="columnheader">Alasan Laporan</span>
                        <span role="columnheader">Status</span>
                        <span role="columnheader">Tanggal</span>
                      </div>

                      {visibleAdminReviews.map((review, index) => (
                        <div
                          className="admin-review-table__row admin-review-table__row--report"
                          role="row"
                          key={review.id}
                        >
                          <span className="admin-review-table__no" role="cell">
                            {(currentReviewPage - 1) * reviewRowsPerPage + index + 1}
                          </span>
                          <div className="admin-review-table__user" role="cell">
                            <AdminAvatar imageUrl={review.user?.profileImageUrl} name={review.user?.name} isPremium={review.user?.isPremium} />
                            <strong>{review.user?.name || "User FLIX"}</strong>
                          </div>
                          <strong className="admin-review-table__film" role="cell">
                            {review.title}
                          </strong>
                          <div className="admin-review-table__content" role="cell">
                            <p>{review.content}</p>
                          </div>
                          <span className="admin-review-table__reason" role="cell">
                            {getReviewReportReasonSummary(review)}
                          </span>
                          <div className="admin-review-table__status-cell" role="cell">
                            <span
                              className={`admin-review-status admin-review-status--${String(
                                review.status || "pending"
                              ).toLowerCase()}`}
                            >
                              {review.status || "Pending"}
                            </span>
                            <div className="admin-review-table__actions">
                              <button
                                type="button"
                                className="admin-review-table__action admin-review-table__action--detail"
                                onClick={() => openReviewDetail(review)}
                              >
                                Detail
                              </button>
                            </div>
                          </div>
                          <span className="admin-review-table__date" role="cell">
                            {review.date}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div
                        className={`admin-review-table__row admin-review-table__row--head${
                          activeReviewTab === "incoming" ? " admin-review-table__row--incoming" : ""
                        }${
                          activeReviewTab === "blocked" ? " admin-review-table__row--blocked" : ""
                        }`}
                        role="row"
                      >
                        <span role="columnheader">No</span>
                        <span role="columnheader">User</span>
                        <span role="columnheader">Film</span>
                        <span role="columnheader">Review</span>
                        <span role="columnheader">Tanggal</span>
                        {activeReviewTab === "blocked" && <span role="columnheader">Status</span>}
                        {(activeReviewTab === "incoming" || activeReviewTab === "blocked") && (
                          <span role="columnheader">Detail</span>
                        )}
                      </div>

                      {visibleAdminReviews.map((review, index) => (
                        <div
                          className={`admin-review-table__row${
                            activeReviewTab === "incoming" ? " admin-review-table__row--incoming" : ""
                          }${
                            activeReviewTab === "blocked" ? " admin-review-table__row--blocked" : ""
                          }`}
                          role="row"
                          key={review.id}
                        >
                          <span className="admin-review-table__no" role="cell">
                            {(currentReviewPage - 1) * reviewRowsPerPage + index + 1}
                          </span>
                          <div className="admin-review-table__user" role="cell">
                            <AdminAvatar imageUrl={review.user?.profileImageUrl} name={review.user?.name} isPremium={review.user?.isPremium} />
                            <strong>{review.user?.name || "User FLIX"}</strong>
                          </div>
                          <strong className="admin-review-table__film" role="cell">
                            {review.title}
                          </strong>
                          <div className="admin-review-table__content" role="cell">
                            <p>{review.content}</p>
                            {review.rating ? (
                              <small>
                                <FaStar aria-hidden="true" />
                                {Number(review.rating).toFixed(1)}
                              </small>
                            ) : (
                              <small>{review.status}</small>
                            )}
                          </div>
                          <span className="admin-review-table__date" role="cell">
                            {review.date}
                          </span>
                          {activeReviewTab === "blocked" && (
                            <span
                              className={`admin-review-status admin-review-status--${String(
                                review.status || "diblokir"
                              ).toLowerCase()}`}
                              role="cell"
                            >
                              {review.status || "Diblokir"}
                            </span>
                          )}
                          {(activeReviewTab === "incoming" || activeReviewTab === "blocked") && (
                            <div className="admin-review-table__detail-cell" role="cell">
                              <button
                                type="button"
                                className="admin-review-table__action admin-review-table__action--detail"
                                onClick={() => openReviewDetail(review)}
                              >
                                Detail
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {!visibleAdminReviews.length && (
                    <div
                      className={`admin-review-table__empty${
                        activeReviewTab === "reported" ? " admin-review-table__empty--report" : ""
                      }`}
                    >
                      {isLoading ? "Memuat data review..." : "Belum ada review pada tab ini."}
                    </div>
                  )}
                </div>

                <div className="admin-manage-pagination" aria-label="Pagination review">
                  <button
                    type="button"
                    aria-label="Halaman review sebelumnya"
                    disabled={currentReviewPage === 1}
                    onClick={() => setReviewPage((page) => Math.max(1, page - 1))}
                  >
                    &lt;
                  </button>
                  {reviewPaginationItems.map((item, index) =>
                    typeof item === "string" ? (
                      <span key={`${item}-${index}`} className="admin-manage-pagination__ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        type="button"
                        key={item}
                        className={currentReviewPage === item ? "admin-manage-pagination__active" : ""}
                        onClick={() => setReviewPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    aria-label="Halaman review berikutnya"
                    disabled={currentReviewPage === totalReviewPages}
                    onClick={() => setReviewPage((page) => Math.min(totalReviewPages, page + 1))}
                  >
                    &gt;
                  </button>
                </div>
              </article>
            </section>
          ) : activeAdminPage === "community" ? (
            <section className="admin-community-management" aria-label="Kelola post community">
              <section className="admin-community-summary" aria-label="Ringkasan community">
                {communitySummaryCards.map((stat) => (
                  <article className="admin-community-summary__card" key={stat.label}>
                    <strong>{isLoading ? "..." : formatChartNumber(stat.value)}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </section>

              {communityError && <p className="admin-dashboard-alert">{communityError}</p>}

              <article className="admin-panel admin-community-card">
                <div className="admin-community-card__header">
                  <div>
                    <h2>Kelola Post Community</h2>
                    <p>Moderasi semua postingan dari pengguna</p>
                  </div>
                </div>

                <div className="admin-community-tabs" role="tablist" aria-label="Filter post community">
                  {communityTabs.map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      className={activeCommunityTab === tab.id ? "admin-community-tabs__item--active" : ""}
                      role="tab"
                      aria-selected={activeCommunityTab === tab.id}
                      onClick={() => setActiveCommunityTab(tab.id)}
                    >
                      <span>{tab.label}</span>
                      <small>{formatChartNumber(adminCommunity.summary?.[tab.countKey] || 0)}</small>
                    </button>
                  ))}
                </div>

                <div className="admin-community-list">
                  {visibleCommunityPosts.map((post) => (
                    <article
                      className={`admin-community-post${
                        post.status === "Terblokir" ? " admin-community-post--blocked" : ""
                      }`}
                      key={post.id}
                    >
                      <div className="admin-community-post__top">
                        <div className="admin-community-post__author">
                          <AdminAvatar imageUrl={post.profileImageUrl} name={post.author} isPremium={post.isPremium} />
                          <div>
                            <strong>{post.author || "User FLIX"}</strong>
                            <small>{post.time || post.date || "-"}</small>
                          </div>
                        </div>

                        <div className="admin-community-post__actions">
                          <button
                            type="button"
                            aria-label="Lihat detail post"
                            onClick={() => openCommunityDetail(post)}
                          >
                            <FiEye aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="admin-community-post__action--block"
                            aria-label="Blokir post"
                            disabled={
                              !post.reportId ||
                              isBlockedCommunityStatus(post.status) ||
                              Boolean(communityReportActionLoading[String(post.reportId || post.id)])
                            }
                            onClick={() => handleUpdateCommunityReportStatus(post, "blocked")}
                          >
                            <FiSlash aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <p className="admin-community-post__content">
                        {formatPostPreview(post.content)}
                      </p>

                      {post.reportReason && (
                        <div className="admin-community-post__report">
                          <FiAlertTriangle aria-hidden="true" />
                          <div>
                            <strong>{post.reportReason}</strong>
                            <span>{post.reportedAt}</span>
                          </div>
                          {isRejectedCommunityStatus(post.status) ? (
                            <span
                              className="admin-community-post__report-check"
                              aria-label="Report ditolak"
                              role="img"
                            >
                              <FiCheckCircle aria-hidden="true" />
                            </span>
                          ) : (
                            <span aria-hidden="true" />
                          )}
                        </div>
                      )}

                      <div className="admin-community-post__metrics">
                        <span>
                          <FiEye aria-hidden="true" />
                          {formatChartNumber(post.metrics?.views || 0)}
                        </span>
                        <span>
                          <FiMessageSquare aria-hidden="true" />
                          {formatChartNumber(post.metrics?.replies || 0)}
                        </span>
                        <span>
                          <FiShare2 aria-hidden="true" />
                          {formatChartNumber(post.metrics?.shares || 0)}
                        </span>
                      </div>
                    </article>
                  ))}

                  {!visibleCommunityPosts.length && (
                    <p className="admin-empty-state">
                      {isLoading ? "Memuat post community..." : "Belum ada post pada tab ini."}
                    </p>
                  )}
                </div>

                <div className="admin-manage-pagination" aria-label="Pagination community">
                  <button
                    type="button"
                    aria-label="Halaman community sebelumnya"
                    disabled={currentCommunityPage === 1}
                    onClick={() => setCommunityPage((page) => Math.max(1, page - 1))}
                  >
                    &lt;
                  </button>
                  {communityPaginationItems.map((item, index) =>
                    typeof item === "string" ? (
                      <span key={`${item}-${index}`} className="admin-manage-pagination__ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        type="button"
                        key={item}
                        className={currentCommunityPage === item ? "admin-manage-pagination__active" : ""}
                        onClick={() => setCommunityPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    aria-label="Halaman community berikutnya"
                    disabled={currentCommunityPage === totalCommunityPages}
                    onClick={() => setCommunityPage((page) => Math.min(totalCommunityPages, page + 1))}
                  >
                    &gt;
                  </button>
                </div>
              </article>
            </section>
          ) : activeAdminPage === "contact" ? (
            <section className="admin-contact-management" aria-label="Kelola report Contact Us">
              {contactError && <p className="admin-dashboard-alert">{contactError}</p>}

              <article className="admin-panel admin-contact-card">
                {selectedContactMessage ? (
                  <div className="admin-contact-detail-page">
                    <header className="admin-contact-detail-page__head">
                      <button
                        type="button"
                        className="admin-contact-detail-page__back"
                        onClick={() => {
                          setSelectedContactMessage(null);
                          setContactReplyFiles([]);
                        }}
                      >
                        <FiArrowLeft aria-hidden="true" />
                        Kembali ke daftar report
                      </button>
                      <div>
                        <span>
                          {selectedContactMessage.source === "contact_form"
                            ? "Detail Laporan Contact Us"
                            : "Detail Tiket Customer Service"}
                        </span>
                        <h2>{selectedContactMessage.subject || "Tanpa subjek"}</h2>
                        <small>{selectedContactMessage.ticketCode}</small>
                      </div>
                    </header>

                    <section className="admin-contact-detail-summary">
                      <div>
                        <span className="admin-contact-message__avatar">
                          {String(selectedContactMessage.userName || "U").slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <small>Pengirim</small>
                          <strong>{selectedContactMessage.userName}</strong>
                          <p>{selectedContactMessage.userEmail}</p>
                        </div>
                      </div>
                      <span className={`admin-contact-status admin-contact-status--${selectedContactMessage.status}`}>
                        {selectedContactMessage.statusLabel}
                      </span>
                    </section>

                    <dl className="admin-contact-detail-meta">
                      <div>
                        <dt>Subjek</dt>
                        <dd>{selectedContactMessage.subject || "Tanpa subjek"}</dd>
                      </div>
                      <div>
                        <dt>Kategori</dt>
                        <dd>{selectedContactMessage.categoryLabel}</dd>
                      </div>
                      <div>
                        <dt>Tanggal Masuk</dt>
                        <dd>{selectedContactMessage.formattedDate}</dd>
                      </div>
                      {selectedContactMessage.source !== "contact_form" && (
                        <div>
                          <dt>Penanggung Jawab</dt>
                          <dd>{selectedContactMessage.assignedAdminName || "Belum ditangani"}</dd>
                        </div>
                      )}
                    </dl>

                    <section className="admin-contact-detail-message">
                      <span>Isi Laporan</span>
                      <p>{selectedContactMessage.description}</p>
                      {selectedContactMessage.detail?.extraInfo && (
                        <p className="admin-contact-detail-modal__extra">{selectedContactMessage.detail.extraInfo}</p>
                      )}
                    </section>

                    {selectedContactMessage.source !== "contact_form" && (
                      <section className="admin-contact-thread" aria-label="Riwayat chat customer service">
                        {(selectedContactMessage.messages || []).map((message) => (
                          <article
                            className={`admin-contact-thread__message admin-contact-thread__message--${message.senderType}`}
                            key={message.id}
                          >
                            <div>
                              <strong>{message.senderName}</strong>
                              <p>{message.message}</p>
                              {Boolean(message.attachments?.length) && (
                                <div className="admin-contact-thread__attachments">
                                  {message.attachments.map((attachment) => (
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
                              )}
                              <time>{message.formattedDate}</time>
                            </div>
                          </article>
                        ))}
                      </section>
                    )}

                    {selectedContactMessage.source === "contact_form" ? (
                      selectedContactMessage.status !== "done" ? (
                        <section className="admin-contact-resolve">
                          <span>Action Laporan</span>
                          <div className="admin-contact-form-actions">
                            {selectedContactMessage.status === "waiting_admin" && (
                              <button
                                type="button"
                                className="admin-review-report-modal__action"
                                disabled={Boolean(contactActionLoading[String(selectedContactMessage.id)])}
                                onClick={() => handleUpdateContactFormStatus(selectedContactMessage, "reviewed")}
                              >
                                Tandai Ditinjau
                              </button>
                            )}
                            <button
                              type="button"
                              className="admin-review-report-modal__action admin-review-report-modal__action--restore"
                              disabled={Boolean(contactActionLoading[String(selectedContactMessage.id)])}
                              onClick={handleCloseContactTicket}
                            >
                              Selesaikan Laporan
                            </button>
                          </div>
                        </section>
                      ) : (
                        <section className="admin-contact-resolve admin-contact-resolve--done">
                          <span>Status Laporan</span>
                          <p>Laporan sudah selesai ditangani.</p>
                        </section>
                      )
                    ) : selectedContactMessage.status !== "done" ? (
                      <>
                        {!selectedContactMessage.assignedAdminId && (
                          <button
                            type="button"
                            className="admin-review-report-modal__action admin-contact-detail-modal__claim"
                            disabled={Boolean(contactActionLoading[String(selectedContactMessage.id)])}
                            onClick={() => handleClaimContactTicket(selectedContactMessage)}
                          >
                            Ambil Tiket
                          </button>
                        )}

                        <form className="admin-contact-reply" onSubmit={handleSendContactReply}>
                          <textarea
                            value={contactReplyText}
                            onChange={(event) => setContactReplyText(event.target.value)}
                            placeholder="Tulis balasan untuk pengguna..."
                            rows={3}
                          />
                          <div>
                            <label>
                              Lampiran
                              <input
                                type="file"
                                multiple
                                accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx"
                                onChange={(event) => setContactReplyFiles(Array.from(event.target.files || []))}
                              />
                            </label>
                            <button
                              type="submit"
                              className="admin-review-report-modal__action"
                              disabled={Boolean(contactActionLoading[String(selectedContactMessage.id)])}
                            >
                              Kirim Balasan
                            </button>
                          </div>
                        </form>

                        <section className="admin-contact-resolve">
                          <textarea
                            value={contactResolutionNote}
                            onChange={(event) => setContactResolutionNote(event.target.value)}
                            placeholder="Catatan penyelesaian..."
                            rows={2}
                          />
                          <button
                            type="button"
                            className="admin-review-report-modal__action admin-review-report-modal__action--restore"
                            disabled={Boolean(contactActionLoading[String(selectedContactMessage.id)])}
                            onClick={handleCloseContactTicket}
                          >
                            Selesaikan Tiket
                          </button>
                        </section>
                      </>
                    ) : (
                      <section className="admin-contact-resolve admin-contact-resolve--done">
                        <span>Catatan Penyelesaian</span>
                        <p>{selectedContactMessage.resolutionNote || "Tiket selesai ditangani."}</p>
                      </section>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="admin-contact-card__header">
                      <div>
                        <h2>Report Customer Service</h2>
                        <p>Kelola tiket bantuan pengguna, riwayat chat, lampiran, dan status penanganan.</p>
                      </div>
                    </div>

                    <div className="admin-contact-tabs" role="tablist" aria-label="Filter report">
                      {contactTabs.map((tab) => (
                        <button
                          type="button"
                          key={tab.id}
                          className={activeContactTab === tab.id ? "admin-contact-tabs__item--active" : ""}
                          role="tab"
                          aria-selected={activeContactTab === tab.id}
                          onClick={() => setActiveContactTab(tab.id)}
                        >
                          <span>{tab.label}</span>
                          <small>{formatChartNumber(adminContactMessages.summary?.[tab.countKey] || 0)}</small>
                        </button>
                      ))}
                    </div>

                    <div className="admin-contact-list">
                      {visibleContactMessages.map((message) => (
                        <article className="admin-contact-message" key={message.id}>
                          <div className="admin-contact-message__main">
                            <div className="admin-contact-message__top">
                              <span className="admin-contact-message__avatar">
                                {String(message.userName || "U").slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <strong>{message.userName}</strong>
                                <small>{message.userEmail}</small>
                              </div>
                            </div>

                            <div className="admin-contact-message__content">
                              <div>
                                <h3>{message.ticketCode} - {message.subject}</h3>
                                <p>{formatPostPreview(message.description, 150)}</p>
                              </div>
                              <span className={`admin-contact-status admin-contact-status--${message.status}`}>
                                {message.statusLabel}
                              </span>
                            </div>

                            <div className="admin-contact-message__meta">
                              <span>{message.categoryLabel}</span>
                              <span>PIC: {message.assignedAdminName || "Belum ditangani"}</span>
                              <span>{message.formattedDate}</span>
                            </div>
                          </div>

                          <div className="admin-contact-message__actions">
                            <button
                              type="button"
                              aria-label="Lihat detail report"
                              onClick={() => openContactTicketDetail(message)}
                            >
                              <FiEye aria-hidden="true" />
                            </button>
                            {message.status === "waiting_admin" && (
                              <button
                                type="button"
                                className="admin-contact-message__claim"
                                disabled={Boolean(contactActionLoading[String(message.id)])}
                                onClick={() => handleClaimContactTicket(message)}
                              >
                                {message.source === "contact_form" ? "Tinjau" : "Ambil"}
                              </button>
                            )}
                          </div>
                        </article>
                      ))}

                      {!visibleContactMessages.length && (
                        <p className="admin-empty-state">
                          {isLoading ? "Memuat report..." : "Belum ada report pada tab ini."}
                        </p>
                      )}
                    </div>

                    <div className="admin-manage-pagination" aria-label="Pagination report">
                      <button
                        type="button"
                        aria-label="Halaman report sebelumnya"
                        disabled={currentContactPage === 1}
                        onClick={() => setContactPage((page) => Math.max(1, page - 1))}
                      >
                        &lt;
                      </button>
                      {contactPaginationItems.map((item, index) =>
                        typeof item === "string" ? (
                          <span key={`${item}-${index}`} className="admin-manage-pagination__ellipsis">
                            ...
                          </span>
                        ) : (
                          <button
                            type="button"
                            key={item}
                            className={currentContactPage === item ? "admin-manage-pagination__active" : ""}
                            onClick={() => setContactPage(item)}
                          >
                            {item}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        aria-label="Halaman report berikutnya"
                        disabled={currentContactPage === totalContactPages}
                        onClick={() => setContactPage((page) => Math.min(totalContactPages, page + 1))}
                      >
                        &gt;
                      </button>
                    </div>
                  </>
                )}
              </article>
            </section>
          ) : activeAdminPage === "transactions" && activeTransactionPanel === "payment-settings" ? (
            <section className="admin-payment-settings" aria-label="Kelola pembayaran premium">
              <div className="admin-payment-settings__head">
                <button
                  type="button"
                  className="admin-payment-settings__back"
                  onClick={() => setActiveTransactionPanel("list")}
                >
                  <FiArrowLeft aria-hidden="true" />
                  Kembali
                </button>
                <div>
                  <h2>Kelola Metode Pembayaran & Harga Paket</h2>
                  <p>Kelola paket, metode pembayaran, dan harga untuk paket Premium dan Premium Tahunan.</p>
                </div>
              </div>

              {paymentSettingsFeedback && (
                <p className="admin-payment-settings__feedback">{paymentSettingsFeedback}</p>
              )}

              <article className="admin-payment-step">
                <div className="admin-payment-step__header">
                  <div className="admin-payment-step__title">
                    <span>1</span>
                    <div>
                      <h3>Kelola Metode Pembayaran</h3>
                      <p>Tambah, edit, atau hapus metode pembayaran yang tersedia.</p>
                    </div>
                  </div>
                  <button type="button" className="admin-payment-secondary-button" onClick={addPaymentMethod}>
                    <FiPlus aria-hidden="true" />
                    Tambah Metode
                  </button>
                </div>

                <div className="admin-payment-method-layout">
                  <section className="admin-payment-method-list">
                    <h4>Daftar Metode Pembayaran</h4>
                    <div className="admin-payment-method-list__items">
                      {paymentMethods.map((method) => (
                        <div
                          className={`admin-payment-method-card${
                            selectedPaymentMethodId === method.id ? " admin-payment-method-card--active" : ""
                          }`}
                          key={method.id}
                        >
                          <button
                            type="button"
                            className="admin-payment-method-card__main"
                            onClick={() => setSelectedPaymentMethodId(method.id)}
                          >
                            <span className="admin-payment-method-card__icon">
                              {method.imageUrl ? (
                                <img src={resolveMediaUrl(method.imageUrl)} alt="" />
                              ) : method.type === "ewallet" ? (
                                <FiCreditCard aria-hidden="true" />
                              ) : method.type === "qris" ? (
                                <FiGrid aria-hidden="true" />
                              ) : (
                                <FiShield aria-hidden="true" />
                              )}
                            </span>
                            <span>
                              <strong>{method.name}</strong>
                              <small>{method.category}</small>
                              <small>
                                {method.type === "qris" ? "QRIS ID" : "Nomor"}:{" "}
                                {method.accountNumber || "-"}
                              </small>
                            </span>
                          </button>
                          <div className="admin-payment-method-card__actions">
                            <button type="button" onClick={() => setSelectedPaymentMethodId(method.id)}>
                              <FiEdit3 aria-hidden="true" />
                              Edit
                            </button>
                            <button type="button" onClick={() => removePaymentMethod(method.id)}>
                              <FiTrash2 aria-hidden="true" />
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))}

                      <button type="button" className="admin-payment-add-line" onClick={addPaymentMethod}>
                        <FiPlus aria-hidden="true" />
                        Tambah Metode
                      </button>
                    </div>
                  </section>

                  <section className="admin-payment-method-editor">
                    <h4>Edit Metode Pembayaran</h4>
                    <p>Ubah informasi metode pembayaran yang dipilih.</p>

                    <div className="admin-payment-field-group">
                      <label>Jenis Metode</label>
                      <div className="admin-payment-type-grid">
                        {paymentMethodTypes.map((type) => (
                          <button
                            type="button"
                            key={type.id}
                            className={`admin-payment-type${
                              selectedPaymentMethod?.type === type.id ? " admin-payment-type--active" : ""
                            }`}
                            onClick={() => updateSelectedPaymentMethod("type", type.id)}
                          >
                            <span className="admin-payment-type__radio" aria-hidden="true" />
                            {type.icon}
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="admin-payment-field">
                      <span>Nama Metode</span>
                      <input
                        type="text"
                        value={selectedPaymentMethod?.name || ""}
                        onChange={(event) => updateSelectedPaymentMethod("name", event.target.value)}
                      />
                    </label>

                    <div className="admin-payment-field-row">
                      <label className="admin-payment-field">
                        <span>Nomor Rekening / Nomor Kode</span>
                        <input
                          type="text"
                          value={selectedPaymentMethod?.accountNumber || ""}
                          onChange={(event) =>
                            updateSelectedPaymentMethod("accountNumber", event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-payment-field">
                        <span>Atas Nama</span>
                        <input
                          type="text"
                          value={selectedPaymentMethod?.accountName || ""}
                          onChange={(event) => updateSelectedPaymentMethod("accountName", event.target.value)}
                        />
                      </label>
                    </div>

                    <div className="admin-payment-upload">
                      <div>
                        <span className="admin-payment-upload__preview">
                          {selectedPaymentMethod?.imageUrl ? (
                            <img
                              src={resolveMediaUrl(selectedPaymentMethod.imageUrl)}
                              alt={selectedPaymentMethod?.name || "Logo metode pembayaran"}
                            />
                          ) : (
                            <FiUploadCloud aria-hidden="true" />
                          )}
                        </span>
                        <div>
                          <strong>{selectedPaymentMethod?.imageName || "Belum ada gambar"}</strong>
                          <small>PNG, JPG maks. 2MB</small>
                        </div>
                      </div>
                      <label className="admin-payment-upload__button">
                        <FiUploadCloud aria-hidden="true" />
                        Ganti Gambar
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={handlePaymentMethodImageChange}
                        />
                      </label>
                      <button
                        type="button"
                        aria-label="Hapus gambar metode pembayaran"
                        onClick={() => {
                          updateSelectedPaymentMethod("imageUrl", "");
                          updateSelectedPaymentMethod("imageName", "");
                        }}
                      >
                        <FiX aria-hidden="true" />
                      </button>
                    </div>
                  </section>
                </div>
              </article>

              <article className="admin-payment-step">
                <div className="admin-payment-step__title">
                  <span>2</span>
                  <div>
                    <h3>Edit Harga</h3>
                    <p>Atur harga untuk setiap paket.</p>
                  </div>
                </div>

                <div className="admin-payment-price-grid">
                  {paymentPackageOptions.map((paymentPackage) => (
                    <section className="admin-payment-price-card" key={paymentPackage.id}>
                      <div className="admin-payment-price-card__label">
                        <span>{paymentPackage.icon}</span>
                        <div>
                          <strong>{paymentPackage.name}</strong>
                          <small>
                            Paket bulanan
                          </small>
                        </div>
                      </div>
                      <div className="admin-payment-price-card__current">
                        <small>Harga saat ini</small>
                        <strong>Rp{paymentPrices[paymentPackage.id] || defaultPaymentPrices[paymentPackage.id]}</strong>
                      </div>
                      <label className="admin-payment-price-card__new">
                        <span>Harga Baru</span>
                        <div>
                          <small>Rp</small>
                          <input
                            type="text"
                            value={paymentPrices[paymentPackage.id] || ""}
                            onChange={(event) =>
                              setPaymentPrices((prices) => ({
                                ...prices,
                                [paymentPackage.id]: event.target.value
                              }))
                            }
                          />
                        </div>
                      </label>
                    </section>
                  ))}
                </div>
              </article>

              <article className="admin-payment-step admin-payment-save">
                <div className="admin-payment-step__title">
                  <span>3</span>
                  <div>
                    <h3>Simpan Perubahan</h3>
                    <p>
                      Pastikan semua metode pembayaran dan harga paket sudah sesuai sebelum disimpan.
                    </p>
                  </div>
                </div>
                <button type="button" className="admin-payment-save__button" onClick={savePaymentSettings}>
                  <FiKey aria-hidden="true" />
                  Simpan Perubahan
                </button>
              </article>
            </section>
          ) : activeAdminPage === "transactions" ? (
            <section className="admin-transaction-page" aria-label="Riwayat transaksi premium">
              {transactionsError && <p className="admin-dashboard-alert">{transactionsError}</p>}

              <article className="admin-panel admin-transaction-card">
                <div className="admin-transaction-card__header">
                  <div>
                    <h2>Riwayat Transaksi</h2>
                    <p>Semua transaksi upgrade Premium</p>
                  </div>
                  <button
                    type="button"
                    className="admin-transaction-edit"
                    onClick={() => setActiveTransactionPanel("payment-settings")}
                  >
                    <FiEdit3 aria-hidden="true" />
                    Edit Pembayaran
                  </button>
                </div>

                <div className="admin-transaction-tabs" role="tablist" aria-label="Filter status transaksi">
                  {transactionTabs.map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      className={activeTransactionTab === tab.id ? "admin-transaction-tabs__item--active" : ""}
                      role="tab"
                      aria-selected={activeTransactionTab === tab.id}
                      onClick={() => setActiveTransactionTab(tab.id)}
                    >
                      <span>{tab.label}</span>
                      <small>{formatChartNumber(adminTransactions.summary?.[tab.countKey] || 0)}</small>
                    </button>
                  ))}
                </div>

                <div className="admin-transaction-filters" aria-label="Filter transaksi">
                  {[
                    {
                      id: "package",
                      value: transactionPackageFilter,
                      options: ["Semua Paket", "Premium", "Eksklusif"],
                      onSelect: setTransactionPackageFilter
                    },
                    {
                      id: "payment",
                      value: transactionPaymentFilter,
                      options: ["Semua Pembayaran", "QR Code", "E Wallet", "Bank"],
                      onSelect: setTransactionPaymentFilter
                    },
                    {
                      id: "date",
                      value: transactionDateFilter,
                      options: ["Bulan ini", "Tahun ini", "Semua Waktu"],
                      onSelect: setTransactionDateFilter
                    }
                  ].map((filter) => (
                    <div className="admin-transaction-filter" key={filter.id}>
                      <button
                        type="button"
                        aria-expanded={openTransactionFilter === filter.id}
                        onClick={() =>
                          setOpenTransactionFilter((currentFilter) =>
                            currentFilter === filter.id ? null : filter.id
                          )
                        }
                      >
                        {filter.value}
                        <FiChevronDown aria-hidden="true" />
                      </button>
                      {openTransactionFilter === filter.id && (
                        <div className="admin-transaction-filter__menu" role="menu">
                          {filter.options.map((option) => (
                            <button
                              type="button"
                              role="menuitem"
                              key={option}
                              className={filter.value === option ? "is-active" : ""}
                              onClick={() => {
                                filter.onSelect(option);
                                setOpenTransactionFilter(null);
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="admin-transaction-table" role="table" aria-label="Riwayat transaksi premium">
                  <div className="admin-transaction-table__row admin-transaction-table__row--head" role="row">
                    <span role="columnheader">ID Transaksi</span>
                    <span role="columnheader">User</span>
                    <span role="columnheader">Paket</span>
                    <span role="columnheader">Durasi</span>
                    <span role="columnheader">Metode</span>
                    <span role="columnheader">Jumlah</span>
                    <span role="columnheader">Status</span>
                    <span role="columnheader">Aksi</span>
                  </div>

                  {visibleTransactions.map((transaction) => (
                    <div className="admin-transaction-table__row" role="row" key={transaction.id}>
                      <div className="admin-transaction-id" role="cell">
                        <strong>{transaction.transactionId}</strong>
                        <small>{transaction.date}</small>
                      </div>
                      <div className="admin-transaction-user" role="cell">
                        <AdminAvatar imageUrl={transaction.user?.profileImageUrl} name={transaction.user?.name} isPremium={transaction.user?.isPremium} />
                        <div>
                          <strong>{transaction.user?.name || "User FLIX"}</strong>
                          <small>{transaction.user?.email || "-"}</small>
                        </div>
                      </div>
                      <span role="cell">{transaction.package}</span>
                      <span role="cell">{formatSubscriptionDuration(transaction.durationMonths)}</span>
                      <span role="cell">{transaction.method}</span>
                      <strong role="cell">{transaction.amountLabel}</strong>
                      <span role="cell">
                        <span
                          className={`admin-transaction-status admin-transaction-status--${String(
                            transaction.status || "pending"
                          ).toLowerCase()}`}
                        >
                          {transaction.status}
                        </span>
                      </span>
                      <div className="admin-transaction-actions" role="cell">
                        <button
                          type="button"
                          aria-label="Lihat detail transaksi"
                          onClick={() => setSelectedTransactionDetail(transaction)}
                        >
                          <FiEye aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {!visibleTransactions.length && (
                    <div className="admin-transaction-table__empty">
                      {isLoading ? "Memuat transaksi..." : "Belum ada transaksi premium."}
                    </div>
                  )}
                </div>

                <div className="admin-manage-pagination" aria-label="Pagination transaksi">
                  <button
                    type="button"
                    aria-label="Halaman transaksi sebelumnya"
                    disabled={currentTransactionPage === 1}
                    onClick={() => setTransactionPage((page) => Math.max(1, page - 1))}
                  >
                    &lt;
                  </button>
                  {transactionPaginationItems.map((item, index) =>
                    typeof item === "string" ? (
                      <span key={`${item}-${index}`} className="admin-manage-pagination__ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        type="button"
                        key={item}
                        className={currentTransactionPage === item ? "admin-manage-pagination__active" : ""}
                        onClick={() => setTransactionPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    aria-label="Halaman transaksi berikutnya"
                    disabled={currentTransactionPage === totalTransactionPages}
                    onClick={() => setTransactionPage((page) => Math.min(totalTransactionPages, page + 1))}
                  >
                    &gt;
                  </button>
                </div>
              </article>
            </section>
          ) : activeAdminPage === "settings" ? (
            <AdminSettingsPanel />
          ) : activeAdminPage === "users" ? (
            <section className="admin-user-management" aria-label="Kelola user">
              {usersError && <p className="admin-dashboard-alert">{usersError}</p>}

              {activeUserPanel === "detail" && (
                <section className="admin-user-detail" aria-label="Detail user">
                  <div className="admin-user-detail__head">
                    <div>
                      <h2>Detail User</h2>
                      <p>Informasi lengkap & aktivitas user</p>
                    </div>
                    <div className="admin-user-detail__actions">
                      <button
                        type="button"
                        className={
                          detailUser?.isActive === false
                            ? "admin-user-detail__success"
                            : "admin-user-detail__danger"
                        }
                        disabled={!detailUser || isUserStatusLoading}
                        onClick={handleToggleUserStatus}
                      >
                        {detailUser?.isActive === false ? (
                          <FiUserCheck aria-hidden="true" />
                        ) : (
                          <FiUserX aria-hidden="true" />
                        )}
                        {isUserStatusLoading
                          ? "Memproses..."
                          : detailUser?.isActive === false
                            ? "Aktifkan user"
                            : "Nonaktifkan user"}
                      </button>
                      <button type="button" onClick={closeUserDetail}>
                        <FiArrowLeft aria-hidden="true" />
                        Kembali
                      </button>
                    </div>
                  </div>

                  {userDetailError && <p className="admin-dashboard-alert">{userDetailError}</p>}
                  {userStatusFeedback && (
                    <p className="admin-dashboard-alert admin-dashboard-alert--inline">
                      {userStatusFeedback}
                    </p>
                  )}

                  {isUserDetailLoading && (
                    <article className="admin-panel admin-user-detail__loading">
                      Memuat detail user...
                    </article>
                  )}

                  {!isUserDetailLoading && detailUser && (
                    <>
                      <article className="admin-panel admin-user-detail__profile-card">
                        <div className="admin-user-detail__identity">
                          <div className="admin-user-detail__avatar">
                            <AdminAvatar imageUrl={detailUser.profileImageUrl} name={detailUser.username} isPremium={detailUser.isPremium} />
                            <small className="admin-user-detail__premium-badge">💎 Premium</small>
                          </div>
                          <div className="admin-user-detail__meta">
                            <h3>{detailUser.username}</h3>
                            <p>{detailUser.email}</p>
                            <div className="admin-user-detail__joined-row">
                              <span>
                                <FiCalendar aria-hidden="true" />
                                Bergabung sejak {detailUser.joinedAt}
                              </span>
                            </div>
                            <div className="admin-user-detail__info-row">
                              <span>
                                <FiClock aria-hidden="true" />
                                Login terakhir: {detailUser.lastLoginAt || "29 Apr 2026 13:00"}
                              </span>
                              <span>
                                <FiMapPin aria-hidden="true" />
                                {detailUser.location || "Sragen, Jawa Tengah"}
                              </span>
                            </div>
                            <span
                              className={`admin-user-status${
                                detailUser.status === "Aktif"
                                  ? " admin-user-status--active"
                                  : detailUser.status === "Nonaktif"
                                    ? " admin-user-status--inactive"
                                    : ""
                              }`}
                            >
                              {detailUser.status}
                            </span>
                          </div>
                        </div>

                        <div className="admin-user-detail__profile-actions">
                          <button type="button" onClick={openEditUserModal}>
                            <FiEdit3 aria-hidden="true" />
                            Edit User
                          </button>
                          <button type="button" onClick={openResetPasswordModal}>
                            <FiKey aria-hidden="true" />
                            Reset Password
                          </button>
                        </div>
                      </article>

                      <section className="admin-user-detail__stats" aria-label="Statistik user">
                        <article>
                          <strong>{formatChartNumber(detailTotalWatchlist)}</strong>
                          <span>Total Watchlist</span>
                        </article>
                        <article>
                          <strong>{formatChartNumber(detailStats.reviewsCreated)}</strong>
                          <span>Review Dibuat</span>
                        </article>
                        <article>
                          <strong>{formatChartNumber(detailStats.watchedMovies)}</strong>
                          <span>Film Ditandai Ditonton</span>
                        </article>
                        <article>
                          <strong>
                            <FaStar aria-hidden="true" />
                            {Number(detailStats.averageRating || 0).toFixed(1)}
                          </strong>
                          <span>Rata-rata Rating</span>
                        </article>
                      </section>

                      <section className="admin-user-detail__grid">
                        <article className="admin-panel admin-user-detail__panel">
                          <h3>Aktivitas Terbaru</h3>
                          <div className="admin-user-detail__timeline">
                            {detailActivities.map((activity, index) => (
                              <div key={`${activity.title}-${index}`}>
                                <span />
                                <div>
                                  <strong>{activity.title}</strong>
                                  <small>{activity.time}</small>
                                </div>
                              </div>
                            ))}
                            {!detailActivities.length && (
                              <p className="admin-empty-state">Belum ada aktivitas user.</p>
                            )}
                          </div>
                        </article>

                        <article className="admin-panel admin-user-detail__panel">
                          <h3>Review Terbaru ({detailStats.reviewsCreated || 0})</h3>
                          <div className="admin-user-detail__review-list">
                            {detailReviews.map((review) => (
                              <div key={`${review.mediaType}-${review.id}`}>
                                <img src={review.poster || flixAdminLogo} alt={review.title} />
                                <div>
                                  <strong>{review.title}</strong>
                                  <span>{review.year}</span>
                                  <p className="admin-user-detail__review-content">
                                    {formatPostPreview(review.content, 110)}
                                  </p>
                                </div>
                                <span className="admin-user-detail__stars">
                                  {Array.from({ length: 5 }, (_, index) => (
                                    <FaStar
                                      key={index}
                                      aria-hidden="true"
                                      className={index < Number(review.rating || 0) ? "is-active" : ""}
                                    />
                                  ))}
                                </span>
                                <span className="admin-user-detail__approved">{review.status}</span>
                              </div>
                            ))}
                            {!detailReviews.length && (
                              <p className="admin-empty-state">Belum ada review terbaru.</p>
                            )}
                          </div>
                        </article>

                        <article className="admin-panel admin-user-detail__panel">
                          <h3>Watchlist User ({formatChartNumber(detailTotalWatchlist)} Film)</h3>
                          <div className="admin-user-detail__simple-list">
                            {detailWatchlist.map((item) => (
                              <div key={`${item.mediaType}-${item.id}`}>
                                <img src={item.poster || flixAdminLogo} alt={item.title} />
                                <div>
                                  <strong>{item.title}</strong>
                                  <span>{item.year}</span>
                                </div>
                                <small>{item.savedAt}</small>
                              </div>
                            ))}
                            {!detailWatchlist.length && (
                              <p className="admin-empty-state">
                                Watchlist user belum tersedia.
                              </p>
                            )}
                          </div>
                        </article>

                        <article className="admin-panel admin-user-detail__panel">
                          <h3>Postingan Terbaru ({detailStats.postsCreated || 0} Post)</h3>
                          <div className="admin-user-detail__post-list">
                            {detailPosts.map((post) => (
                              <div key={post.id}>
                                <strong>{post.title}</strong>
                                <p>{formatPostPreview(post.content, 130)}</p>
                                <div>
                                  <span>{post.date}</span>
                                  <span><FiEye aria-hidden="true" /> {post.viewCount}</span>
                                  <span><FiHeart aria-hidden="true" /> {post.likeCount}</span>
                                  <span><FiMessageSquare aria-hidden="true" /> {post.replyCount}</span>
                                </div>
                              </div>
                            ))}
                            {!detailPosts.length && (
                              <p className="admin-empty-state">Belum ada postingan terbaru.</p>
                            )}
                          </div>
                        </article>
                      </section>
                    </>
                  )}
                </section>
              )}

              {activeUserPanel === "list" && (
                <>

              <section className="admin-user-summary" aria-label="Ringkasan user">
                <article className="admin-user-summary__card">
                  <FiUsers aria-hidden="true" />
                  <div>
                    <strong>{isLoading ? "..." : formatChartNumber(adminUsersSummary.total)}</strong>
                    <span>Total User</span>
                  </div>
                </article>
                <article className="admin-user-summary__card">
                  <FiShield aria-hidden="true" />
                  <div>
                    <strong>{isLoading ? "..." : formatChartNumber(adminUsersSummary.admin)}</strong>
                    <span>Admin</span>
                  </div>
                </article>
                <article className="admin-user-summary__card">
                  <FiUserCheck aria-hidden="true" />
                  <div>
                    <strong>{isLoading ? "..." : formatChartNumber(adminUsersSummary.moderator)}</strong>
                    <span>Moderator</span>
                  </div>
                </article>
                <article className="admin-user-summary__card">
                  <FiUserPlus aria-hidden="true" />
                  <div>
                    <strong>{isLoading ? "..." : formatChartNumber(adminUsersSummary.registeredUser)}</strong>
                    <span>User Biasa</span>
                  </div>
                </article>
              </section>

              <article className="admin-panel admin-user-card">
                <div className="admin-user-card__header">
                  <div>
                    <h2>Semua User</h2>
                    <p>Admin dan moderator ditampilkan terlebih dahulu, lalu user biasa.</p>
                  </div>
                  <AdminFilterButton
                    id="users"
                    openFilter={openAdminFilter}
                    setOpenFilter={setOpenAdminFilter}
                    groups={[
                      {
                        id: "role",
                        label: "Role",
                        value: userRoleFilter,
                        onChange: setUserRoleFilter,
                        options: ["Semua Role", "Admin", "Moderator", "User Biasa"]
                      },
                      {
                        id: "status",
                        label: "Status",
                        value: userStatusFilter,
                        onChange: setUserStatusFilter,
                        options: ["Semua Status", "Aktif", "Belum Verifikasi", "Nonaktif"]
                      }
                    ]}
                  />
                </div>

                <div className="admin-user-table" role="table" aria-label="Daftar user admin">
                  <div className="admin-user-table__row admin-user-table__row--head" role="row">
                    <span role="columnheader">No</span>
                    <span role="columnheader">User</span>
                    <span role="columnheader">Role</span>
                    <span role="columnheader">Bergabung</span>
                    <span role="columnheader">Aktifitas</span>
                    <span role="columnheader">Status</span>
                    <span role="columnheader">Aksi</span>
                  </div>

                  {visibleAdminUsers.map((item, index) => (
                    <div className="admin-user-table__row" role="row" key={item.id}>
                      <span className="admin-user-table__no" role="cell">
                        {(currentUserPage - 1) * userRowsPerPage + index + 1}
                      </span>
                      <div className="admin-user-table__profile" role="cell">
                        <AdminAvatar imageUrl={item.profileImageUrl} name={item.username} isPremium={item.isPremium} />
                        <div>
                          <strong>{item.username}</strong>
                          <small>{item.email}</small>
                        </div>
                      </div>
                      <span role="cell">
                        <span className={`admin-role-pill admin-role-pill--${item.role}`}>
                          {item.roleLabel}
                        </span>
                      </span>
                      <span role="cell">{item.joinedAt}</span>
                      <div className="admin-user-activities" role="cell">
                        <span>
                          <i className="is-watchlist" />
                          {formatChartNumber(
                            Number(item.activities?.watchlist || 0) ||
                            getStoredUserWatchlist({ id: item.id }).length,
                          )} watchlist
                        </span>
                        <span><i className="is-review" />{formatChartNumber(item.activities?.review || 0)} review</span>
                        <span><i className="is-post" />{formatChartNumber(item.activities?.post || 0)} post</span>
                        <span><i className="is-reply" />{formatChartNumber(item.activities?.reply || 0)} reply</span>
                      </div>
                      <span role="cell">
                        <span
                          className={`admin-user-status${
                            item.status === "Aktif"
                              ? " admin-user-status--active"
                              : item.status === "Nonaktif"
                                ? " admin-user-status--inactive"
                                : ""
                          }`}
                        >
                          {item.status}
                        </span>
                      </span>
                      <span role="cell">
                        <button
                          type="button"
                          className="admin-user-table__detail-button"
                          onClick={() => loadAdminUserDetail(item.id)}
                        >
                          Detail
                        </button>
                      </span>
                    </div>
                  ))}

                  {!visibleAdminUsers.length && (
                    <div className="admin-user-table__empty">
                      {isLoading ? "Memuat data user..." : "Belum ada user yang bisa ditampilkan."}
                    </div>
                  )}
                </div>

                <div className="admin-manage-pagination" aria-label="Pagination user">
                  <button
                    type="button"
                    aria-label="Halaman user sebelumnya"
                    disabled={currentUserPage === 1}
                    onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                  >
                    &lt;
                  </button>
                  {userPaginationItems.map((item, index) =>
                    typeof item === "string" ? (
                      <span key={`${item}-${index}`} className="admin-manage-pagination__ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        type="button"
                        key={item}
                        className={currentUserPage === item ? "admin-manage-pagination__active" : ""}
                        onClick={() => setUserPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    aria-label="Halaman user berikutnya"
                    disabled={currentUserPage === totalUserPages}
                    onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
                  >
                    &gt;
                  </button>
                </div>
              </article>
                </>
              )}
            </section>
          ) : (
            <>
              <section className="admin-stats-grid" aria-label="Ringkasan dashboard">
                {dashboard.stats.map((stat) => (
                  <article className="admin-stat-card" key={stat.label}>
                    <strong>{isLoading ? "..." : stat.value}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </section>

              {dashboardError && <p className="admin-dashboard-alert">{dashboardError}</p>}

              <section className="admin-dashboard-grid">
                <article className="admin-panel admin-chart-panel">
                  <div className="admin-panel__header admin-panel__header--stacked">
                    <h2>Aktivitas Pengguna</h2>
                    <div className="admin-filter-row">
                      <div className="admin-filter-row__item">
                        <button
                          type="button"
                          className="admin-filter-row__trigger"
                          aria-expanded={openChartFilter === "activity"}
                          onClick={() =>
                            setOpenChartFilter((currentFilter) =>
                              currentFilter === "activity" ? null : "activity"
                            )
                          }
                        >
                          {selectedChartActivityLabel}
                          <FiChevronDown aria-hidden="true" />
                        </button>
                        {openChartFilter === "activity" && (
                          <div className="admin-filter-row__menu" role="menu">
                            {chartActivityOptions.map((option) => (
                              <button
                                type="button"
                                key={option.id}
                                className={selectedChartActivity === option.id ? "is-active" : ""}
                                role="menuitem"
                                onClick={() => {
                                  setSelectedChartActivity(option.id);
                                  setOpenChartFilter(null);
                                }}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="admin-filter-row__item">
                        <button
                          type="button"
                          className="admin-filter-row__trigger"
                          aria-expanded={openChartFilter === "year"}
                          onClick={() =>
                            setOpenChartFilter((currentFilter) =>
                              currentFilter === "year" ? null : "year"
                            )
                          }
                        >
                          {selectedChartYear}
                          <FiChevronDown aria-hidden="true" />
                        </button>
                        {openChartFilter === "year" && (
                          <div className="admin-filter-row__menu admin-filter-row__menu--year" role="menu">
                            {chartYearOptions.map((year) => (
                              <button
                                type="button"
                                key={year}
                                className={selectedChartYear === year ? "is-active" : ""}
                                role="menuitem"
                                onClick={() => {
                                  setSelectedChartYear(year);
                                  setOpenChartFilter(null);
                                }}
                              >
                                {year}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="admin-chart" aria-label="Grafik aktivitas pengguna">
                    {chartItems.map((item) => (
                      <div
                        className="admin-chart__item"
                        key={item.month}
                        title={`${item.month}: ${item.valueLabel} aktivitas`}
                      >
                        <span className="admin-chart__value">{item.valueLabel}</span>
                        <span
                          className="admin-chart__bar"
                          style={{ "--bar-height": `${item.barHeight}%` }}
                        />
                        <span className="admin-chart__label">{item.month}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="admin-panel admin-activity-panel">
                  <div className="admin-panel__header">
                    <h2>Aktivitas Terbaru</h2>
                  </div>

                  <div className="admin-activity-list">
                    {filteredActivities.map((activity) => {
                      const Icon = activityIcons[activity.icon] || FiMessageSquare;

                      return (
                        <div className="admin-activity-item" key={`${activity.title}-${activity.time}`}>
                          <div className="admin-activity-item__icon">
                            <Icon aria-hidden="true" />
                          </div>
                          <div className="admin-activity-item__content">
                            <strong>{activity.title}</strong>
                            <span>{activity.time}</span>
                          </div>
                        </div>
                      );
                    })}
                    {!filteredActivities.length && (
                      <p className="admin-empty-state">
                        {isLoading ? "Memuat aktivitas..." : "Belum ada aktivitas terbaru."}
                      </p>
                    )}
                  </div>
                </article>
              </section>

              <article className="admin-panel admin-table-panel">
                <div className="admin-table-title">
                  <h2>Film Paling Banyak Simpan di Watchlist</h2>
                  <div className="admin-table-limit-filter">
                    <button
                      type="button"
                      className="admin-table-limit"
                      aria-haspopup="menu"
                      aria-expanded={isTableLimitOpen}
                      onClick={() => setIsTableLimitOpen((isOpen) => !isOpen)}
                    >
                      {tableLimit}
                      <FiChevronDown aria-hidden="true" />
                    </button>
                    {isTableLimitOpen && (
                      <div className="admin-table-limit-filter__menu" role="menu" aria-label="Jumlah film yang tampil">
                        {tableLimitOptions.map((limit) => (
                          <button
                            type="button"
                            role="menuitem"
                            key={limit}
                            className={tableLimit === limit ? "is-active" : ""}
                            onClick={() => {
                              setTableLimit(limit);
                              setIsTableLimitOpen(false);
                            }}
                          >
                            {limit}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-table admin-table--watchlist" role="table" aria-label="Film paling banyak simpan di watchlist">
                  <div className="admin-table__row admin-table__row--head" role="row">
                    <span role="columnheader">No</span>
                    <span role="columnheader">Film</span>
                    <span role="columnheader">Genre</span>
                    <span role="columnheader">Rating</span>
                    <span role="columnheader">Watchlist</span>
                  </div>

                  {visibleWatchlistMovies.map((movie) => (
                    <div className="admin-table__row" role="row" key={`${movie.title}-${movie.no}`}>
                      <span className="admin-table__no" role="cell">
                        {movie.no}
                      </span>
                      <div className="admin-table__movie" role="cell">
                        <img src={movie.poster || flixAdminLogo} alt={movie.title} />
                        <div>
                          <strong>{movie.title}</strong>
                          <span>{movie.year}</span>
                        </div>
                      </div>
                      <span role="cell">{movie.genre}</span>
                      <span className="admin-table__rating" role="cell">
                        <FaStar aria-hidden="true" />
                        {movie.rating}
                      </span>
                      <span role="cell">{movie.watchlist}</span>
                    </div>
                  ))}
                  {!visibleWatchlistMovies.length && (
                    <div className="admin-table__empty">
                      {isLoading ? "Memuat data film..." : "Belum ada data watchlist film."}
                    </div>
                  )}
                </div>
              </article>
            </>
          )}
        </div>
      </section>

      {selectedTransactionDetail && (
        <div
          className="admin-review-report-modal admin-transaction-detail-modal"
          role="presentation"
          onClick={() => setSelectedTransactionDetail(null)}
        >
          <article
            className="admin-review-report-modal__card admin-transaction-detail-modal__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-transaction-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-review-report-modal__head">
              <div>
                <span>Detail Transaksi Premium</span>
                <h2 id="admin-transaction-detail-title">
                  {selectedTransactionDetail.transactionId}
                </h2>
              </div>
              <button
                type="button"
                className="admin-review-report-modal__close"
                aria-label="Tutup detail transaksi"
                onClick={() => setSelectedTransactionDetail(null)}
              >
                <FiX aria-hidden="true" />
              </button>
            </header>

            <section className="admin-review-report-modal__user">
              <AdminAvatar
                imageUrl={selectedTransactionDetail.user?.profileImageUrl}
                name={selectedTransactionDetail.user?.name}
                isPremium={selectedTransactionDetail.user?.isPremium}
              />
              <div>
                <span>User</span>
                <strong>{selectedTransactionDetail.user?.name || "User FLIX"}</strong>
                <small>{selectedTransactionDetail.user?.email || "-"}</small>
              </div>
              <span
                className={`admin-transaction-status admin-transaction-status--${String(
                  selectedTransactionDetail.status || "pending"
                ).toLowerCase()}`}
              >
                {selectedTransactionDetail.status || "Pending"}
              </span>
            </section>

            <dl className="admin-review-report-modal__meta admin-transaction-detail-modal__meta">
              <div>
                <dt>Paket</dt>
                <dd>{selectedTransactionDetail.package || "-"}</dd>
              </div>
              <div>
                <dt>Durasi Langganan</dt>
                <dd>{formatSubscriptionDuration(selectedTransactionDetail.durationMonths)}</dd>
              </div>
              <div>
                <dt>Metode Pembayaran</dt>
                <dd>{selectedTransactionDetail.method || "-"}</dd>
              </div>
              <div>
                <dt>Jumlah</dt>
                <dd>{selectedTransactionDetail.amountLabel || "-"}</dd>
              </div>
              <div>
                <dt>Tanggal Transaksi</dt>
                <dd>{selectedTransactionDetail.date || "-"}</dd>
              </div>
              <div>
                <dt>Berakhir Premium</dt>
                <dd>{selectedTransactionDetail.premiumExpiredAt || "-"}</dd>
              </div>
            </dl>

            <section className="admin-review-report-modal__section">
              <span>Bukti Pembayaran</span>
              <div className="admin-transaction-detail-modal__proof">
                {selectedTransactionDetail.paymentProof ? (
                  <>
                    <img
                      src={resolveMediaUrl(selectedTransactionDetail.paymentProof)}
                      alt="Bukti pembayaran"
                    />
                    <button
                      type="button"
                      onClick={() => openTransactionProof(selectedTransactionDetail.paymentProof)}
                    >
                      <FiEye aria-hidden="true" />
                      Lihat bukti penuh
                    </button>
                  </>
                ) : (
                  <p>Bukti pembayaran belum tersedia.</p>
                )}
              </div>
            </section>

            <footer className="admin-review-report-modal__actions">
              <button
                type="button"
                className="admin-review-report-modal__action admin-review-report-modal__action--reject"
                disabled={
                  selectedTransactionDetail.status !== "Pending" ||
                  Boolean(transactionActionLoading[selectedTransactionDetail.id])
                }
                onClick={() => updateTransactionStatus(selectedTransactionDetail.id, "rejected")}
              >
                {transactionActionLoading[selectedTransactionDetail.id] === "rejected"
                  ? "Memproses..."
                  : "Tolak"}
              </button>
              <button
                type="button"
                className="admin-review-report-modal__action admin-review-report-modal__action--restore"
                disabled={
                  selectedTransactionDetail.status !== "Pending" ||
                  Boolean(transactionActionLoading[selectedTransactionDetail.id])
                }
                onClick={() => updateTransactionStatus(selectedTransactionDetail.id, "approved")}
              >
                {transactionActionLoading[selectedTransactionDetail.id] === "approved"
                  ? "Memproses..."
                  : "Setuju"}
              </button>
            </footer>
          </article>
        </div>
      )}

      {selectedReviewReport && (
        <div
          className="admin-review-report-modal"
          role="presentation"
          onClick={() => setSelectedReviewReport(null)}
        >
          <article
            className="admin-review-report-modal__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-review-report-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-review-report-modal__head">
              <div>
                <span>
                  {selectedReviewReport.hasReport ? "Detail Report Review" : "Detail Review Masuk"}
                </span>
                <h2 id="admin-review-report-title">{selectedReviewReport.title}</h2>
              </div>
              <button
                type="button"
                className="admin-review-report-modal__close"
                aria-label="Tutup detail report review"
                onClick={() => setSelectedReviewReport(null)}
              >
                <FiX aria-hidden="true" />
              </button>
            </header>

            <section className="admin-review-report-modal__user">
              <AdminAvatar
                imageUrl={selectedReviewReport.user?.profileImageUrl}
                name={selectedReviewReport.user?.name}
                isPremium={selectedReviewReport.user?.isPremium}
              />
              <div>
                <span>User Pelapor</span>
                <strong>{selectedReviewReport.user?.name || "User FLIX"}</strong>
              </div>
              <span
                className={`admin-review-status admin-review-status--${String(
                  selectedReviewReport.status || "pending"
                ).toLowerCase()}`}
              >
                {selectedReviewReport.status || "Pending"}
              </span>
            </section>

            <dl className="admin-review-report-modal__meta">
              <div>
                <dt>Film / Series</dt>
                <dd>{selectedReviewReport.title}</dd>
              </div>
              <div>
                <dt>{selectedReviewReport.hasReport ? "Tanggal Report" : "Tanggal Review"}</dt>
                <dd>{selectedReviewReport.date || "-"}</dd>
              </div>
              <div>
                <dt>Rating Review</dt>
                <dd>
                  {selectedReviewReport.rating ? (
                    <>
                      <FaStar aria-hidden="true" />
                      {Number(selectedReviewReport.rating).toFixed(1)}
                    </>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
            </dl>

            <section className="admin-review-report-modal__section">
              <span>Isi Review</span>
              <p>{selectedReviewReport.content || "Review belum memiliki isi."}</p>
            </section>

            <section className="admin-review-report-modal__section admin-review-report-modal__section--reason">
              <span>Alasan Report</span>
              <p>{selectedReviewReport.reason || "Tidak ada report masuk"}</p>
            </section>

            <footer className="admin-review-report-modal__actions">
              {selectedReviewReport.hasReport ? (
                isBlockedReviewStatus(selectedReviewReport.status) ? (
                  <button
                    type="button"
                    className="admin-review-report-modal__action admin-review-report-modal__action--restore"
                    disabled={Boolean(
                      reviewReportActionLoading[
                        String(selectedReviewReport.reportId || selectedReviewReport.id)
                      ]
                    )}
                    onClick={() => handleUpdateReviewReportStatus(selectedReviewReport, "rejected")}
                  >
                    {reviewReportActionLoading[String(selectedReviewReport.reportId || selectedReviewReport.id)] ===
                    "rejected"
                      ? "Memproses..."
                      : "Kembalikan Review"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="admin-review-report-modal__action admin-review-report-modal__action--reject"
                      disabled={
                        Boolean(
                          reviewReportActionLoading[
                            String(selectedReviewReport.reportId || selectedReviewReport.id)
                          ]
                        ) || selectedReviewReport.status === "Ditolak"
                      }
                      onClick={() => handleUpdateReviewReportStatus(selectedReviewReport, "rejected")}
                    >
                      {reviewReportActionLoading[String(selectedReviewReport.reportId || selectedReviewReport.id)] ===
                      "rejected"
                        ? "Memproses..."
                        : "Tolak"}
                    </button>
                    <button
                      type="button"
                      className="admin-review-report-modal__action admin-review-report-modal__action--block"
                      disabled={Boolean(
                        reviewReportActionLoading[
                          String(selectedReviewReport.reportId || selectedReviewReport.id)
                        ]
                      )}
                      onClick={() => handleUpdateReviewReportStatus(selectedReviewReport, "blocked")}
                    >
                      {reviewReportActionLoading[String(selectedReviewReport.reportId || selectedReviewReport.id)] ===
                      "blocked"
                        ? "Memproses..."
                        : "Blokir Review"}
                    </button>
                  </>
                )
              ) : (
                <button
                  type="button"
                  className="admin-review-report-modal__action admin-review-report-modal__action--close"
                  onClick={() => setSelectedReviewReport(null)}
                >
                  Tutup
                </button>
              )}
            </footer>
          </article>
        </div>
      )}

      {selectedCommunityReport && (
        <div
          className="admin-review-report-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-community-report-title"
        >
          <article className="admin-review-report-modal__card">
            <header className="admin-review-report-modal__head">
              <div>
                <span>
                  {selectedCommunityReport.hasReport ? "Detail Report Community" : "Detail Post Community"}
                </span>
                <h2 id="admin-community-report-title">
                  {selectedCommunityReport.title || "Community Post"}
                </h2>
              </div>
              <button
                type="button"
                className="admin-review-report-modal__close"
                aria-label="Tutup detail report community"
                onClick={() => setSelectedCommunityReport(null)}
              >
                <FiX aria-hidden="true" />
              </button>
            </header>

            <section className="admin-review-report-modal__user">
              <AdminAvatar
                imageUrl={selectedCommunityReport.profileImageUrl}
                name={selectedCommunityReport.author}
                isPremium={selectedCommunityReport.isPremium}
              />
              <div>
                <span>{selectedCommunityReport.targetKind === "reply" ? "Pemilik Reply" : "Pemilik Post"}</span>
                <strong>{selectedCommunityReport.author || "User FLIX"}</strong>
              </div>
              <span
                className={`admin-community-status admin-community-status--${String(
                  selectedCommunityReport.status || "aktif"
                ).toLowerCase()}`}
              >
                {selectedCommunityReport.status || "Aktif"}
              </span>
            </section>

            <dl className="admin-review-report-modal__meta">
              <div>
                <dt>Jenis Konten</dt>
                <dd>{selectedCommunityReport.targetKind === "reply" ? "Reply Community" : "Post Community"}</dd>
              </div>
              <div>
                <dt>{selectedCommunityReport.hasReport ? "Tanggal Report" : "Tanggal Post"}</dt>
                <dd>{selectedCommunityReport.hasReport ? selectedCommunityReport.reportedAt : selectedCommunityReport.date}</dd>
              </div>
              <div>
                <dt>Insight</dt>
                <dd>
                  {formatChartNumber(selectedCommunityReport.metrics?.views || 0)} view
                </dd>
              </div>
            </dl>

            <section className="admin-review-report-modal__section">
              <span>Isi Konten</span>
              <p>{selectedCommunityReport.content || "Konten belum memiliki isi."}</p>
            </section>

            <section className="admin-review-report-modal__section admin-review-report-modal__section--reason">
              <span>Alasan Report</span>
              <p>{selectedCommunityReport.reportReason || "Tidak ada report masuk"}</p>
            </section>

            <footer className="admin-review-report-modal__actions">
              {selectedCommunityReport.hasReport ? (
                isBlockedCommunityStatus(selectedCommunityReport.status) ? (
                  <button
                    type="button"
                    className="admin-review-report-modal__action admin-review-report-modal__action--restore"
                    disabled={Boolean(
                      communityReportActionLoading[
                        String(selectedCommunityReport.reportId || selectedCommunityReport.id)
                      ]
                    )}
                    onClick={() => handleUpdateCommunityReportStatus(selectedCommunityReport, "rejected")}
                  >
                    {communityReportActionLoading[
                      String(selectedCommunityReport.reportId || selectedCommunityReport.id)
                    ] === "rejected"
                      ? "Memproses..."
                      : "Kembalikan Post"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="admin-review-report-modal__action admin-review-report-modal__action--reject"
                      disabled={
                        Boolean(
                          communityReportActionLoading[
                            String(selectedCommunityReport.reportId || selectedCommunityReport.id)
                          ]
                        ) || isRejectedCommunityStatus(selectedCommunityReport.status)
                      }
                      onClick={() => handleUpdateCommunityReportStatus(selectedCommunityReport, "rejected")}
                    >
                      {communityReportActionLoading[
                        String(selectedCommunityReport.reportId || selectedCommunityReport.id)
                      ] === "rejected"
                        ? "Memproses..."
                        : "Tolak Report"}
                    </button>
                    <button
                      type="button"
                      className="admin-review-report-modal__action admin-review-report-modal__action--block"
                      disabled={Boolean(
                        communityReportActionLoading[
                          String(selectedCommunityReport.reportId || selectedCommunityReport.id)
                        ]
                      )}
                      onClick={() => handleUpdateCommunityReportStatus(selectedCommunityReport, "blocked")}
                    >
                      {communityReportActionLoading[
                        String(selectedCommunityReport.reportId || selectedCommunityReport.id)
                      ] === "blocked"
                        ? "Memproses..."
                        : "Blokir Post"}
                    </button>
                  </>
                )
              ) : (
                <button
                  type="button"
                  className="admin-review-report-modal__action admin-review-report-modal__action--close"
                  onClick={() => setSelectedCommunityReport(null)}
                >
                  Tutup
                </button>
              )}
            </footer>
          </article>
        </div>
      )}
      {isUserEditOpen && detailUser && (
        <div
          className="admin-user-modal"
          role="presentation"
          onClick={closeEditUserModal}
        >
          <form
            className="admin-user-modal__card"
            onSubmit={handleSaveUserEdit}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-user-modal__head">
              <div>
                <span>Kelola User</span>
                <h2>Edit User</h2>
              </div>
              <button type="button" aria-label="Tutup edit user" onClick={closeEditUserModal}>
                <FiX aria-hidden="true" />
              </button>
            </header>

            <label className="admin-user-modal__field">
              <span>Username</span>
              <input
                type="text"
                value={userEditForm.username}
                minLength={3}
                onChange={(event) =>
                  setUserEditForm((currentForm) => ({
                    ...currentForm,
                    username: event.target.value,
                  }))
                }
                required
              />
            </label>

            <label className="admin-user-modal__field">
              <span>Email</span>
              <input
                type="email"
                value={userEditForm.email}
                onChange={(event) =>
                  setUserEditForm((currentForm) => ({
                    ...currentForm,
                    email: event.target.value,
                  }))
                }
                required
              />
            </label>

            <label className="admin-user-modal__field">
              <span>Role</span>
              <select
                value={userEditForm.role}
                onChange={(event) =>
                  setUserEditForm((currentForm) => ({
                    ...currentForm,
                    role: event.target.value,
                  }))
                }
              >
                {adminRoleOptions.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="admin-user-modal__note">
              User Biasa mengikuti akses langganan. Moderator dapat mengelola film,
              review, community, transaksi, dan report.
            </p>

            <footer className="admin-user-modal__actions">
              <button type="button" onClick={closeEditUserModal}>
                Batal
              </button>
              <button type="submit" disabled={isSavingUserEdit}>
                {isSavingUserEdit ? "Menyimpan..." : "Simpan User"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {isResetPasswordOpen && detailUser && (
        <div
          className="admin-user-modal"
          role="presentation"
          onClick={closeResetPasswordModal}
        >
          <form
            className="admin-user-modal__card"
            onSubmit={handleResetUserPassword}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-user-modal__head">
              <div>
                <span>Reset Password</span>
                <h2>{detailUser.username}</h2>
              </div>
              <button type="button" aria-label="Tutup reset password" onClick={closeResetPasswordModal}>
                <FiX aria-hidden="true" />
              </button>
            </header>

            <label className="admin-user-modal__field">
              <span>Password Baru</span>
              <input
                type="text"
                value={resetPasswordForm.password}
                minLength={6}
                onChange={(event) =>
                  setResetPasswordForm((currentForm) => ({
                    ...currentForm,
                    password: event.target.value,
                  }))
                }
                placeholder="Minimal 6 karakter"
                required
              />
            </label>

            <label className="admin-user-modal__field">
              <span>Konfirmasi Password</span>
              <input
                type="text"
                value={resetPasswordForm.confirmPassword}
                minLength={6}
                onChange={(event) =>
                  setResetPasswordForm((currentForm) => ({
                    ...currentForm,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="Ulangi password baru"
                required
              />
            </label>

            <button
              type="button"
              className="admin-user-modal__generate"
              onClick={handleGeneratePassword}
            >
              Generate Password
            </button>

            <p className="admin-user-modal__note">
              Setelah reset berhasil, berikan password baru ke user melalui kanal yang aman.
            </p>

            <footer className="admin-user-modal__actions">
              <button type="button" onClick={closeResetPasswordModal}>
                Batal
              </button>
              <button type="submit" disabled={isResettingPassword}>
                {isResettingPassword ? "Mereset..." : "Reset Password"}
              </button>
            </footer>
          </form>
        </div>
      )}

      <AdminPaymentImageCropModal
        cropData={paymentImageCropData}
        saving={isCroppingPaymentImage}
        onClose={closePaymentImageCropModal}
        onZoomChange={(zoom) =>
          setPaymentImageCropData((currentCropData) =>
            currentCropData ? { ...currentCropData, zoom } : currentCropData
          )
        }
        onPanChange={(pan) =>
          setPaymentImageCropData((currentCropData) =>
            currentCropData ? { ...currentCropData, pan } : currentCropData
          )
        }
        onStageSizeChange={(stageSize) =>
          setPaymentImageCropData((currentCropData) =>
            currentCropData ? { ...currentCropData, stageSize } : currentCropData
          )
        }
        onImageLoad={({ naturalSize, stageSize }) =>
          setPaymentImageCropData((currentCropData) =>
            currentCropData
              ? {
                  ...currentCropData,
                  naturalSize,
                  stageSize
                }
              : currentCropData
          )
        }
        onUseImage={handleUseCroppedPaymentImage}
      />
    </main>
  );
}

export default AdminPage;
