import pool from "../config/db.js";
import bcrypt from "bcrypt";
import { initializeUserStatusColumns } from "../config/initUserStatus.js";
import { initializePaymentTransactionsTable } from "../config/initPaymentTransactions.js";
import { initializePaymentMethodsTable } from "../config/initPaymentMethods.js";
import { initializeContactMessagesTable } from "../config/initContactMessages.js";
import {
  getPaymentMethodRows,
  getPaymentPackageRows,
  mapPaymentMethodRow,
  mapPaymentPackageRow,
} from "./paymentController.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w92";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const chartActivityOptions = {
  login: {
    label: "Login",
    sourceQuery: `
      SELECT created_at
      FROM flix.users
    `,
  },
  review: {
    label: "Review",
    sourceQuery: `
      SELECT created_at
      FROM flix.movie_reviews
      WHERE parent_review_id IS NULL
      UNION ALL
      SELECT created_at
      FROM flix.tv_series_reviews
      WHERE parent_review_id IS NULL
    `,
  },
  community: {
    label: "Community",
    sourceQuery: `
      SELECT created_at
      FROM flix.posts
    `,
  },
  report: {
    label: "Report",
    sourceQuery: `
      SELECT created_at
      FROM flix.reports
    `,
  },
};

const formatNumber = (value) =>
  new Intl.NumberFormat("id-ID").format(Number(value || 0));

const formatCurrency = (value) => `Rp ${formatNumber(value)}`;

const paymentTransactionStatusLabels = {
  pending: "Pending",
  approved: "Berhasil",
  rejected: "Ditolak",
  expired: "Expired",
};

const paymentTransactionStatusFromLabel = {
  pending: "pending",
  berhasil: "approved",
  approved: "approved",
  ditolak: "rejected",
  rejected: "rejected",
  gagal: "rejected",
  expired: "expired",
};

const formatPaymentTransactionId = (id, createdAt) => {
  const date = new Date(createdAt);
  const dateToken = Number.isNaN(date.getTime())
    ? "00000000"
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  return `#TRX-${dateToken}-${String(id).padStart(3, "0")}`;
};

const formatDate = (dateValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (dateValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const reportCategoryLabels = {
  spam: "Spam / promosi",
  harassment: "Pelecehan / bullying",
  hate_speech: "Ujaran kebencian",
  violence: "Kekerasan / ancaman",
  sexual_content: "Konten seksual",
  misinformation: "Informasi salah",
  spoiler: "Spoiler tanpa peringatan",
  copyright: "Pelanggaran hak cipta",
  other: "Lainnya",
};

const formatReportCategory = (category) =>
  reportCategoryLabels[category] || "Konten bermasalah";

const formatReportStatus = (status) => {
  const normalizedStatus = String(status || "pending").toLowerCase();

  if (normalizedStatus === "approved") return "Disetujui";
  if (normalizedStatus === "rejected") return "Ditolak";
  if (normalizedStatus === "reviewed") return "Ditinjau";
  return "Pending";
};

const normalizeReviewReportStatus = (status) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (["blocked", "approved", "terblokir", "blokir"].includes(normalizedStatus)) {
    return "approved";
  }

  if (["rejected", "ditolak", "tolak"].includes(normalizedStatus)) {
    return "rejected";
  }

  if (normalizedStatus === "pending") {
    return "pending";
  }

  return null;
};

const formatReviewReportStatus = (status) => {
  const normalizedStatus = String(status || "pending").toLowerCase();

  if (normalizedStatus === "approved") return "Diblokir";
  if (normalizedStatus === "rejected") return "Ditolak";
  if (normalizedStatus === "reviewed") return "Ditinjau";
  return "Pending";
};

const formatCommunityReportStatus = (status) => {
  const normalizedStatus = String(status || "pending").toLowerCase();

  if (normalizedStatus === "approved") return "Terblokir";
  if (normalizedStatus === "rejected") return "Ditolak";
  if (normalizedStatus === "reviewed") return "Ditinjau";
  return "Dilaporkan";
};

const formatCommunityTargetStatus = (status) =>
  String(status || "").toLowerCase() === "blocked" ? "Terblokir" : "Aktif";

const safeRows = async (query, params = []) => {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch {
    return [];
  }
};

const safeCount = async (query, params = []) => {
  const rows = await safeRows(query, params);
  return Number(rows[0]?.count || rows[0]?.total || 0);
};

const getTmdbAuth = () => {
  const credential = process.env.TMDB_API_KEY?.trim();

  if (!credential) {
    return null;
  }

  if (credential.startsWith("eyJ")) {
    return {
      headers: {
        Authorization: `Bearer ${credential}`,
        accept: "application/json",
      },
      apiKey: null,
    };
  }

  return {
    headers: {
      accept: "application/json",
    },
    apiKey: credential,
  };
};

const fetchTmdbMedia = async (mediaType, tmdbId) => {
  const auth = getTmdbAuth();

  if (!auth || !tmdbId) {
    return null;
  }

  const params = new URLSearchParams({ language: "id-ID" });

  if (auth.apiKey) {
    params.set("api_key", auth.apiKey);
  }

  const path = mediaType === "tv" ? "tv" : "movie";
  const response = await fetch(`${TMDB_BASE_URL}/${path}/${tmdbId}?${params.toString()}`, {
    headers: auth.headers,
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
};

const enrichMediaRows = async (rows) =>
  Promise.all(
    rows.map(async (row) => {
      const detail = await fetchTmdbMedia(row.media_type, row.tmdb_id).catch(() => null);
      const title =
        detail?.title ||
        detail?.name ||
        `${row.media_type === "tv" ? "Series" : "Film"} #${row.tmdb_id}`;
      const releaseDate = detail?.release_date || detail?.first_air_date || "";
      const genres = (detail?.genres || []).map((genre) => genre.name).filter(Boolean);
      const poster = detail?.poster_path ? `${TMDB_IMAGE_BASE_URL}${detail.poster_path}` : null;
      const rating = Number(row.average_rating || detail?.vote_average || 0);

      return {
        no: Number(row.row_number || 0),
        id: Number(row.tmdb_id),
        mediaType: row.media_type,
        title,
        year: releaseDate ? releaseDate.slice(0, 4) : "-",
        genre: genres.length ? genres.slice(0, 2).join(", ") : "-",
        rating: rating ? rating.toFixed(1) : "-",
        watchlist: formatNumber(row.interaction_count),
        reviewCount: formatNumber(row.interaction_count),
        status: "Aktif",
        poster,
      };
    }),
  );

const normalizeTextArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const normalizeMovieStatus = (status) =>
  ["draf", "draft"].includes(String(status || "Published").trim().toLowerCase())
    ? "Draft"
    : "Published";

const normalizeMovieRating = (rating) => {
  if (rating === null || rating === undefined || rating === "") {
    return null;
  }

  const parsedRating = Number(String(rating).replace(",", "."));

  if (!Number.isFinite(parsedRating)) {
    return null;
  }

  return Math.min(10, Math.max(0, parsedRating));
};

const mapAdminMovieRow = (row) => {
  const genres = Array.isArray(row.genres) ? row.genres.filter(Boolean) : [];
  const rating = normalizeMovieRating(row.rating);

  return {
    no: Number(row.row_number || 0),
    id: Number(row.id_admin_movie),
    mediaType: "movie",
    title: row.title,
    year: row.release_year || "-",
    genre: genres.length ? genres.slice(0, 2).join(", ") : "-",
    genres,
    rating: rating === null ? "-" : rating.toFixed(1),
    watchlist: formatNumber(row.watchlist_count || 0),
    reviewCount: "0",
    status: normalizeMovieStatus(row.status),
    poster: row.poster_url || null,
    duration: row.duration || "",
    director: row.director || "",
    synopsis: row.synopsis || "",
    cast: Array.isArray(row.cast_members) ? row.cast_members.join(", ") : "",
    country: row.country || "",
    platforms: Array.isArray(row.platforms) ? row.platforms : [],
    moods: Array.isArray(row.moods) ? row.moods : [],
    trailerUrl: row.trailer_url || "",
    createdAt: row.created_at || null,
  };
};

const getAdminMoviePayload = (body = {}) => {
  const title = String(body?.title || "").trim();

  if (!title) {
    return {
      error: "Judul film wajib diisi",
    };
  }

  return {
    title,
    releaseYear: String(body?.year || body?.releaseYear || "").trim() || null,
    duration: String(body?.duration || "").trim() || null,
    director: String(body?.director || "").trim() || null,
    synopsis: String(body?.synopsis || "").trim() || null,
    castMembers: normalizeTextArray(body?.cast || body?.castMembers),
    posterUrl: String(body?.posterUrl || body?.poster || "").trim() || null,
    trailerUrl: String(body?.trailerUrl || "").trim() || null,
    rating: normalizeMovieRating(body?.rating),
    country: String(body?.country || "").trim() || null,
    genres: normalizeTextArray(body?.genres),
    platforms: normalizeTextArray(body?.platforms),
    moods: normalizeTextArray(body?.moods),
    status: normalizeMovieStatus(body?.status),
  };
};

const getRelativeTime = (dateValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Baru saja";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} menit yang lalu`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} jam yang lalu`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays} hari yang lalu`;
};

const getEmptyYearChart = () =>
  monthLabels.map((month) => ({
    month,
    value: 0,
  }));

const getChartData = async ({ activity = "login", year = new Date().getFullYear() } = {}) => {
  const selectedActivity = chartActivityOptions[activity] ? activity : "login";
  const selectedYear = Number.parseInt(year, 10);
  const chartYear = Number.isInteger(selectedYear)
    ? Math.min(Math.max(selectedYear, 2000), new Date().getFullYear() + 1)
    : new Date().getFullYear();
  const { sourceQuery } = chartActivityOptions[selectedActivity];
  const rows = await safeRows(`
    WITH months AS (
      SELECT generate_series(
        make_date($1::INTEGER, 1, 1),
        make_date($1::INTEGER, 12, 1),
        interval '1 month'
      ) AS month_start
    ),
    events AS (
      ${sourceQuery}
    )
    SELECT
      EXTRACT(MONTH FROM months.month_start)::INTEGER AS month_number,
      COALESCE(COUNT(events.created_at), 0)::INTEGER AS value
    FROM months
    LEFT JOIN events
      ON date_trunc('month', events.created_at) = months.month_start
    GROUP BY months.month_start
    ORDER BY months.month_start ASC
  `, [chartYear]);

  if (!rows.length) {
    return getEmptyYearChart();
  }

  return rows.map((row) => ({
    month: monthLabels[Number(row.month_number) - 1] || "-",
    value: Number(row.value || 0),
  }));
};

const getRecentActivities = async () => {
  const [latestUserRows, movieReviewRows, tvReviewRows, latestPostRows, reportRows, reportCount] =
    await Promise.all([
      safeRows(`
        SELECT created_at
        FROM flix.users
        ORDER BY created_at DESC
        LIMIT 1
      `),
      safeRows(`
        SELECT created_at
        FROM flix.movie_reviews
        WHERE parent_review_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `),
      safeRows(`
        SELECT created_at
        FROM flix.tv_series_reviews
        WHERE parent_review_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `),
      safeRows(`
        SELECT created_at
        FROM flix.posts
        ORDER BY created_at DESC
        LIMIT 1
      `),
      safeRows(`
        SELECT created_at
        FROM flix.reports
        ORDER BY created_at DESC
        LIMIT 1
      `),
      safeCount(`
        SELECT COUNT(*)::INTEGER AS count
        FROM flix.reports
      `),
    ]);

  const latestReview = [...movieReviewRows, ...tvReviewRows]
    .filter((activity) => activity.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestReport = reportRows[0];

  return [
    {
      title: "User baru mendaftar",
      time: latestUserRows[0]?.created_at ? getRelativeTime(latestUserRows[0].created_at) : "Belum ada user",
      icon: "user",
    },
    {
      title: "Review terbaru",
      time: latestReview?.created_at ? getRelativeTime(latestReview.created_at) : "Belum ada review",
      icon: "review",
    },
    {
      title: "Community Post terbaru",
      time: latestPostRows[0]?.created_at ? getRelativeTime(latestPostRows[0].created_at) : "Belum ada post",
      icon: "community",
    },
    {
      title: "Report masuk terakhir",
      time: latestReport?.created_at
        ? `${formatNumber(reportCount)} laporan - ${getRelativeTime(latestReport.created_at)}`
        : `${formatNumber(reportCount)} laporan`,
      icon: "report",
    },
  ];
};

const getTopMediaRows = async () =>
  safeRows(`
    WITH media_activity AS (
      SELECT
        'movie' AS media_type,
        tmdb_movie_id AS tmdb_id,
        COUNT(*)::INTEGER AS interaction_count,
        ROUND(AVG(rating)::numeric, 1) AS average_rating
      FROM flix.movie_reviews
      WHERE parent_review_id IS NULL
      GROUP BY tmdb_movie_id

      UNION ALL

      SELECT
        'tv' AS media_type,
        tmdb_series_id AS tmdb_id,
        COUNT(*)::INTEGER AS interaction_count,
        ROUND(AVG(rating)::numeric, 1) AS average_rating
      FROM flix.tv_series_reviews
      WHERE parent_review_id IS NULL
      GROUP BY tmdb_series_id
    )
    SELECT
      ROW_NUMBER() OVER (ORDER BY interaction_count DESC, tmdb_id ASC) AS row_number,
      media_type,
      tmdb_id,
      interaction_count,
      average_rating
    FROM media_activity
    ORDER BY interaction_count DESC, tmdb_id ASC
    LIMIT 10
  `);

const getManagedMediaRows = async () =>
  safeRows(`
    SELECT
      ROW_NUMBER() OVER (ORDER BY created_at DESC, id_admin_movie DESC) AS row_number,
      id_admin_movie,
      title,
      release_year,
      duration,
      director,
      synopsis,
      cast_members,
      poster_url,
      trailer_url,
      rating,
      country,
      genres,
      platforms,
      moods,
      status,
      0::INTEGER AS watchlist_count,
      created_at
    FROM flix.admin_movies
    ORDER BY created_at DESC, id_admin_movie DESC
    LIMIT 120
  `);

const normalizeUserRole = (roleName) => {
  if (roleName === "admin") {
    return "Admin";
  }

  if (roleName === "moderator") {
    return "Moderator";
  }

  return "User Biasa";
};

const formatAdminUserStatus = (row) => {
  if (row.is_active === false) {
    return "Nonaktif";
  }

  if (row.email_verified === false) {
    return "Belum Verifikasi";
  }

  return "Aktif";
};

const getAdminUserRows = async () =>
  safeRows(`
    SELECT
      u.id_user,
      u.username,
      u.email,
      u.email_verified,
      u.is_active,
      u.is_premium,
      u.profile_image_url,
      u.created_at,
      r.role_name,
      0::INTEGER AS watchlist_count,
      COALESCE(movie_reviews.review_count, 0)::INTEGER
        + COALESCE(tv_reviews.review_count, 0)::INTEGER AS review_count,
      COALESCE(posts.post_count, 0)::INTEGER AS post_count,
      COALESCE(replies.reply_count, 0)::INTEGER AS reply_count
    FROM flix.users u
    JOIN flix.roles r ON u.id_role = r.id_role
    LEFT JOIN (
      SELECT id_user, COUNT(*)::INTEGER AS review_count
      FROM flix.movie_reviews
      WHERE parent_review_id IS NULL
      GROUP BY id_user
    ) movie_reviews ON u.id_user = movie_reviews.id_user
    LEFT JOIN (
      SELECT id_user, COUNT(*)::INTEGER AS review_count
      FROM flix.tv_series_reviews
      WHERE parent_review_id IS NULL
      GROUP BY id_user
    ) tv_reviews ON u.id_user = tv_reviews.id_user
    LEFT JOIN (
      SELECT id_user, COUNT(*)::INTEGER AS post_count
      FROM flix.posts
      GROUP BY id_user
    ) posts ON u.id_user = posts.id_user
    LEFT JOIN (
      SELECT id_user, COUNT(*)::INTEGER AS reply_count
      FROM flix.comments
      GROUP BY id_user
    ) replies ON u.id_user = replies.id_user
    ORDER BY
      CASE
        WHEN r.role_name = 'admin' THEN 1
        WHEN r.role_name = 'moderator' THEN 2
        ELSE 3
      END,
      u.created_at DESC,
      u.username ASC
  `);

const mapAdminUsers = (rows) =>
  rows.map((row, index) => ({
    no: index + 1,
    id: Number(row.id_user),
    username: row.username,
    email: row.email,
    role: row.role_name,
    roleLabel: normalizeUserRole(row.role_name),
    status: formatAdminUserStatus(row),
    isActive: row.is_active !== false,
    isPremium: Boolean(row.is_premium),
    joinedAt: formatDate(row.created_at),
    profileImageUrl: row.profile_image_url,
    activities: {
      watchlist: Number(row.watchlist_count || 0),
      review: Number(row.review_count || 0),
      post: Number(row.post_count || 0),
      reply: Number(row.reply_count || 0),
    },
  }));

const mapAdminUserResponse = (row) => ({
  id: Number(row.id_user),
  username: row.username,
  email: row.email,
  role: row.role_name,
  roleLabel: normalizeUserRole(row.role_name),
  status: formatAdminUserStatus(row),
  isActive: row.is_active !== false,
  isPremium: Boolean(row.is_premium),
  joinedAt: formatDate(row.created_at),
  joinedAtDetail: row.created_at ? formatDateTime(row.created_at) : null,
  deactivatedAt: row.deactivated_at ? formatDateTime(row.deactivated_at) : null,
  profileImageUrl: row.profile_image_url,
  bannerImageUrl: row.banner_image_url,
});

const getAdminTransactionRows = async () =>
  safeRows(`
    SELECT
      pt.id_transaction,
      pt.id_user,
      pt.package_code,
      pt.package_name,
      pt.duration_months,
      pt.payment_method,
      pt.payment_method_detail,
      pt.amount,
      pt.admin_fee,
      pt.total_amount,
      pt.payment_proof,
      pt.status,
      pt.admin_note,
      pt.verified_at,
      pt.premium_started_at,
      pt.premium_expired_at,
      pt.created_at,
      pt.updated_at,
      u.id_user,
      u.username,
      u.email,
      u.profile_image_url,
      u.is_premium
    FROM flix.payment_transactions pt
    JOIN flix.users u ON u.id_user = pt.id_user
    ORDER BY pt.created_at DESC, pt.id_transaction DESC
    LIMIT 300
  `);

const mapAdminTransactions = (rows) =>
  rows.map((row) => ({
      id: Number(row.id_transaction),
      transactionId: formatPaymentTransactionId(row.id_transaction, row.created_at),
      user: {
        id: Number(row.id_user),
        name: row.username || "User FLIX",
        email: row.email || "-",
        profileImageUrl: row.profile_image_url || null,
        isPremium: Boolean(row.is_premium),
      },
      package: row.package_name || "Premium Bulanan",
      packageCode: row.package_code || "premium",
      durationMonths: Number(row.duration_months || 1),
      method: row.payment_method_detail || row.payment_method || "-",
      methodCode: row.payment_method || null,
      amount: Number(row.total_amount || row.amount || 0),
      amountLabel: formatCurrency(row.total_amount || row.amount || 0),
      baseAmount: Number(row.amount || 0),
      adminFee: Number(row.admin_fee || 0),
      status: paymentTransactionStatusLabels[row.status] || "Pending",
      statusCode: row.status || "pending",
      paymentProof: row.payment_proof || null,
      adminNote: row.admin_note || "",
      date: formatDateTime(row.created_at),
      createdAt: row.created_at,
      verifiedAt: row.verified_at ? formatDateTime(row.verified_at) : null,
      premiumStartedAt: row.premium_started_at ? formatDateTime(row.premium_started_at) : null,
      premiumExpiredAt: row.premium_expired_at ? formatDateTime(row.premium_expired_at) : null,
    }));

const mapReviewMediaRows = async (rows) =>
  Promise.all(
    rows.map(async (row) => {
      const detail = await fetchTmdbMedia(row.media_type, row.tmdb_id).catch(() => null);
      const title =
        detail?.title ||
        detail?.name ||
        `${row.media_type === "tv" ? "Series" : "Film"} #${row.tmdb_id}`;
      const releaseDate = detail?.release_date || detail?.first_air_date || "";
      const poster = detail?.poster_path ? `${TMDB_IMAGE_BASE_URL}${detail.poster_path}` : null;

      return {
        id: Number(row.id_review),
        mediaType: row.media_type,
        mediaId: Number(row.tmdb_id),
        title,
        year: releaseDate ? releaseDate.slice(0, 4) : "-",
        content: row.content,
        rating: Number(row.rating || 0),
        status: "Disetujui",
        createdAt: row.created_at,
        date: formatDate(row.created_at),
        poster,
      };
    }),
  );

const mapAdminReviewRows = async (rows) =>
  Promise.all(
    rows.map(async (row, index) => {
      const mediaType = row.media_type === "tv" ? "tv" : "movie";
      const mediaId = Number(row.tmdb_id || row.metadata_tmdb_id || 0);
      const detail = await fetchTmdbMedia(mediaType, mediaId).catch(() => null);
      const title =
        detail?.title ||
        detail?.name ||
        row.media_title ||
        `${mediaType === "tv" ? "Series" : "Film"} #${mediaId || "-"}`;

      return {
        no: index + 1,
        id: row.id_report
          ? `report-${row.id_report}`
          : `${mediaType}-${row.id_review || row.id_notification || index}`,
        reportId: Number(row.id_report || row.id_notification || 0),
        reviewId: Number(row.id_review || 0),
        notificationId: Number(row.id_notification || 0),
        mediaType,
        mediaId,
        title,
        content: row.content || row.metadata_content || "Review belum memiliki isi.",
        category: row.category || null,
        reason:
          row.reason || row.report_reason
            ? `${formatReportCategory(row.category)}: ${row.reason || row.report_reason}`
            : null,
        rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
        status: row.status || formatReportStatus(row.report_status) || "Menunggu",
        date: formatDate(row.created_at),
        createdAt: row.created_at,
        user: {
          id: Number(row.id_user || row.actor_user_id || 0),
          name: row.username || row.actor_username || "User FLIX",
          profileImageUrl: row.profile_image_url || row.actor_profile_image_url || null,
          isPremium: Boolean(row.is_premium || row.actor_is_premium),
        },
      };
    }),
  );

const getAdminIncomingReviewRows = async () =>
  safeRows(`
    WITH reviews AS (
      SELECT
        id_review,
        'movie' AS media_type,
        tmdb_movie_id AS tmdb_id,
        id_user,
        content,
        rating,
        moderation_status,
        created_at
      FROM flix.movie_reviews
      WHERE parent_review_id IS NULL
        AND COALESCE(moderation_status, 'active') <> 'blocked'
        AND NOT EXISTS (
          SELECT 1
          FROM flix.reports report
          WHERE report.movie_review_id = flix.movie_reviews.id_review
            AND report.status = 'approved'
        )

      UNION ALL

      SELECT
        id_review,
        'tv' AS media_type,
        tmdb_series_id AS tmdb_id,
        id_user,
        content,
        rating,
        moderation_status,
        created_at
      FROM flix.tv_series_reviews
      WHERE parent_review_id IS NULL
        AND COALESCE(moderation_status, 'active') <> 'blocked'
        AND NOT EXISTS (
          SELECT 1
          FROM flix.reports report
          WHERE report.tv_series_review_id = flix.tv_series_reviews.id_review
            AND report.status = 'approved'
        )
    )
    SELECT
      reviews.*,
      users.username,
      users.profile_image_url,
      users.is_premium
    FROM reviews
    JOIN flix.users users ON reviews.id_user = users.id_user
    ORDER BY reviews.created_at DESC, reviews.id_review DESC
    LIMIT 100
  `);

const getAdminReportedReviewRows = async () =>
  safeRows(`
    WITH reported_reviews AS (
      SELECT
        reports.id_report,
        reports.reporter_user_id AS actor_user_id,
        reports.category,
        reports.reason,
        reports.status AS report_status,
        reports.created_at,
        movie_reviews.id_review,
        'movie' AS media_type,
        movie_reviews.tmdb_movie_id AS tmdb_id,
        movie_reviews.content,
        movie_reviews.rating,
        movie_reviews.moderation_status
      FROM flix.reports reports
      JOIN flix.movie_reviews movie_reviews
        ON reports.movie_review_id = movie_reviews.id_review
      WHERE reports.movie_review_id IS NOT NULL

      UNION ALL

      SELECT
        reports.id_report,
        reports.reporter_user_id AS actor_user_id,
        reports.category,
        reports.reason,
        reports.status AS report_status,
        reports.created_at,
        tv_reviews.id_review,
        'tv' AS media_type,
        tv_reviews.tmdb_series_id AS tmdb_id,
        tv_reviews.content,
        tv_reviews.rating,
        tv_reviews.moderation_status
      FROM flix.reports reports
      JOIN flix.tv_series_reviews tv_reviews
        ON reports.tv_series_review_id = tv_reviews.id_review
      WHERE reports.tv_series_review_id IS NOT NULL
    )
    SELECT
      reported_reviews.*,
      reported_reviews.tmdb_id AS metadata_tmdb_id,
      reported_reviews.content AS metadata_content,
      CASE
        WHEN reported_reviews.report_status = 'approved' THEN 'Terblokir'
        WHEN reported_reviews.report_status = 'rejected' THEN 'Ditolak'
        WHEN reported_reviews.report_status = 'reviewed' THEN 'Ditinjau'
        ELSE 'Pending'
      END AS status,
      actor.username AS actor_username,
      actor.profile_image_url AS actor_profile_image_url,
      actor.is_premium AS actor_is_premium
    FROM reported_reviews
    JOIN flix.users actor ON reported_reviews.actor_user_id = actor.id_user
    ORDER BY reported_reviews.created_at DESC
    LIMIT 100
  `);

const mapAdminCommunityRows = (rows) =>
  rows.map((row) => ({
    id: row.id_report ? `report-${row.id_report}` : Number(row.id_post),
    postId: Number(row.id_post),
    commentId: row.id_comment ? Number(row.id_comment) : null,
    reportId: Number(row.id_report || 0),
    reportType: row.report_type || null,
    targetKind: row.target_kind || "post",
    author: row.username || "User FLIX",
    profileImageUrl: row.profile_image_url || null,
    isPremium: Boolean(row.is_premium),
    time: getRelativeTime(row.created_at),
    date: formatDate(row.created_at),
    title: row.title || "",
    content: row.content || "",
    status: row.status || "Aktif",
    targetStatus: row.target_status || row.moderation_status || "active",
    targetStatusLabel: formatCommunityTargetStatus(row.target_status || row.moderation_status),
    reportReason: row.reason
      ? `${formatReportCategory(row.category)}: ${row.reason}`
      : null,
    reportedAt: row.report_created_at
      ? `${row.reporter_username || "User FLIX"} - ${formatDateTime(row.report_created_at)}`
      : null,
    metrics: {
      views: Number(row.view_count || 0),
      replies: Number(row.reply_count || 0),
      shares: Number(row.share_count || 0),
      likes: Number(row.like_count || 0),
      reactions: Number(row.reaction_count || 0),
    },
  }));

const getAdminCommunityRows = async () =>
  safeRows(`
    SELECT
      p.id_post,
      p.title,
      p.content,
      p.created_at,
      p.moderation_status,
      p.moderation_status AS target_status,
      CASE
        WHEN COALESCE(p.moderation_status, 'active') = 'blocked' THEN 'Terblokir'
        ELSE 'Aktif'
      END AS status,
      'post' AS target_kind,
      u.username,
      u.profile_image_url,
      u.is_premium,
      COALESCE(v.view_count, 0)::INTEGER AS view_count,
      COALESCE(c.reply_count, 0)::INTEGER AS reply_count,
      COALESCE(s.share_count, 0)::INTEGER AS share_count,
      COALESCE(l.like_count, 0)::INTEGER AS like_count,
      COALESCE(r.reaction_count, 0)::INTEGER AS reaction_count
    FROM flix.posts p
    JOIN flix.users u ON p.id_user = u.id_user
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS view_count
      FROM flix.post_views
      GROUP BY id_post
    ) v ON p.id_post = v.id_post
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS reply_count
      FROM flix.comments
      GROUP BY id_post
    ) c ON p.id_post = c.id_post
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS share_count
      FROM flix.post_shares
      GROUP BY id_post
    ) s ON p.id_post = s.id_post
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS like_count
      FROM flix.post_likes
      GROUP BY id_post
    ) l ON p.id_post = l.id_post
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS reaction_count
      FROM flix.post_reactions
      GROUP BY id_post
    ) r ON p.id_post = r.id_post
    ORDER BY p.created_at DESC, p.id_post DESC
    LIMIT 100
  `);

const getAdminReportedCommunityRows = async () =>
  safeRows(`
    WITH reported_community AS (
      SELECT
        reports.id_report,
        reports.report_type,
        reports.category,
        reports.reason,
        reports.status AS report_status,
        reports.created_at AS report_created_at,
        reports.reporter_user_id,
        posts.id_post,
        NULL::BIGINT AS id_comment,
        posts.title,
        posts.content,
        posts.created_at,
        posts.id_user,
        posts.moderation_status,
        'post' AS target_kind
      FROM flix.reports reports
      JOIN flix.posts posts ON reports.community_post_id = posts.id_post
      WHERE reports.community_post_id IS NOT NULL

      UNION ALL

      SELECT
        reports.id_report,
        reports.report_type,
        reports.category,
        reports.reason,
        reports.status AS report_status,
        reports.created_at AS report_created_at,
        reports.reporter_user_id,
        posts.id_post,
        comments.id_comment,
        posts.title,
        comments.content,
        comments.created_at,
        comments.id_user,
        comments.moderation_status,
        'reply' AS target_kind
      FROM flix.reports reports
      JOIN flix.comments comments
        ON reports.community_comment_id = comments.id_comment
      JOIN flix.posts posts ON comments.id_post = posts.id_post
      WHERE reports.community_comment_id IS NOT NULL
    )
    SELECT
      reported_community.*,
      target_user.username,
      target_user.profile_image_url,
      target_user.is_premium,
      reporter.username AS reporter_username,
      CASE
        WHEN reported_community.report_status = 'approved'
          OR COALESCE(reported_community.moderation_status, 'active') = 'blocked' THEN 'Terblokir'
        WHEN reported_community.report_status = 'rejected' THEN 'Ditolak'
        WHEN reported_community.report_status = 'reviewed' THEN 'Ditinjau'
        ELSE 'Dilaporkan'
      END AS status,
      reported_community.moderation_status AS target_status,
      COALESCE(v.view_count, 0)::INTEGER AS view_count,
      COALESCE(c.reply_count, 0)::INTEGER AS reply_count,
      COALESCE(s.share_count, 0)::INTEGER AS share_count,
      COALESCE(l.like_count, 0)::INTEGER AS like_count,
      COALESCE(r.reaction_count, 0)::INTEGER AS reaction_count
    FROM reported_community
    JOIN flix.users target_user ON reported_community.id_user = target_user.id_user
    JOIN flix.users reporter ON reported_community.reporter_user_id = reporter.id_user
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS view_count
      FROM flix.post_views
      GROUP BY id_post
    ) v ON reported_community.id_post = v.id_post
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS reply_count
      FROM flix.comments
      GROUP BY id_post
    ) c ON reported_community.id_post = c.id_post
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS share_count
      FROM flix.post_shares
      GROUP BY id_post
    ) s ON reported_community.id_post = s.id_post
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS like_count
      FROM flix.post_likes
      GROUP BY id_post
    ) l ON reported_community.id_post = l.id_post
    LEFT JOIN (
      SELECT id_post, COUNT(*) AS reaction_count
      FROM flix.post_reactions
      GROUP BY id_post
    ) r ON reported_community.id_post = r.id_post
    ORDER BY reported_community.report_created_at DESC
    LIMIT 100
  `);

const getAdminUserDetailRows = async (userId) => {
  const [
    userRows,
    reviewStatsRows,
    postCountRows,
    latestReviewRows,
    latestPostRows,
  ] = await Promise.all([
    safeRows(
      `SELECT
        u.id_user,
        u.username,
        u.email,
        u.email_verified,
        u.is_active,
        u.is_premium,
        u.profile_image_url,
        u.banner_image_url,
        u.deactivated_at,
        u.created_at,
        r.role_name
       FROM flix.users u
       JOIN flix.roles r ON u.id_role = r.id_role
       WHERE u.id_user = $1`,
      [userId],
    ),
    safeRows(
      `WITH reviews AS (
        SELECT rating
        FROM flix.movie_reviews
        WHERE id_user = $1
          AND parent_review_id IS NULL

        UNION ALL

        SELECT rating
        FROM flix.tv_series_reviews
        WHERE id_user = $1
          AND parent_review_id IS NULL
      )
      SELECT
        COUNT(*)::INTEGER AS review_count,
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::FLOAT AS average_rating
      FROM reviews`,
      [userId],
    ),
    safeRows(
      `SELECT COUNT(*)::INTEGER AS post_count
       FROM flix.posts
       WHERE id_user = $1`,
      [userId],
    ),
    safeRows(
      `SELECT *
       FROM (
        SELECT
          id_review,
          'movie' AS media_type,
          tmdb_movie_id AS tmdb_id,
          content,
          rating,
          created_at
        FROM flix.movie_reviews
        WHERE id_user = $1
          AND parent_review_id IS NULL

        UNION ALL

        SELECT
          id_review,
          'tv' AS media_type,
          tmdb_series_id AS tmdb_id,
          content,
          rating,
          created_at
        FROM flix.tv_series_reviews
        WHERE id_user = $1
          AND parent_review_id IS NULL
       ) reviews
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId],
    ),
    safeRows(
      `SELECT
        p.id_post,
        p.title,
        p.content,
        p.created_at,
        COALESCE(v.view_count, 0)::INTEGER AS view_count,
        COALESCE(l.like_count, 0)::INTEGER AS like_count,
        COALESCE(c.reply_count, 0)::INTEGER AS reply_count,
        COALESCE(s.share_count, 0)::INTEGER AS share_count
       FROM flix.posts p
       LEFT JOIN (
        SELECT id_post, COUNT(*) AS view_count
        FROM flix.post_views
        GROUP BY id_post
       ) v ON p.id_post = v.id_post
       LEFT JOIN (
        SELECT id_post, COUNT(*) AS like_count
        FROM flix.post_likes
        GROUP BY id_post
       ) l ON p.id_post = l.id_post
       LEFT JOIN (
        SELECT id_post, COUNT(*) AS reply_count
        FROM flix.comments
        GROUP BY id_post
       ) c ON p.id_post = c.id_post
       LEFT JOIN (
        SELECT id_post, COUNT(*) AS share_count
        FROM flix.post_shares
        GROUP BY id_post
       ) s ON p.id_post = s.id_post
       WHERE p.id_user = $1
       ORDER BY p.created_at DESC
       LIMIT 5`,
      [userId],
    ),
  ]);

  return {
    userRows,
    reviewStatsRows,
    postCountRows,
    latestReviewRows,
    latestPostRows,
  };
};

export const getAdminDashboard = async (req, res) => {
  try {
    const selectedChartActivity = chartActivityOptions[req.query.activity]
      ? req.query.activity
      : "login";
    const selectedChartYear = Number.parseInt(req.query.year, 10) || new Date().getFullYear();
    const [
      movieContentCount,
      tvContentCount,
      activeUserCount,
      communityPostCount,
      moderationCount,
      chart,
      activities,
      topMediaRows,
    ] = await Promise.all([
      safeCount(`
        SELECT COUNT(DISTINCT tmdb_movie_id)::INTEGER AS count
        FROM flix.movie_reviews
      `),
      safeCount(`
        SELECT COUNT(DISTINCT tmdb_series_id)::INTEGER AS count
        FROM flix.tv_series_reviews
      `),
      safeCount(`
        SELECT COUNT(*)::INTEGER AS count
        FROM flix.users
      `),
      safeCount(`
        SELECT COUNT(*)::INTEGER AS count
        FROM flix.posts
      `),
      safeCount(`
        SELECT COUNT(*)::INTEGER AS count
        FROM flix.notifications
        WHERE notification_type ILIKE '%report%'
          AND is_read = FALSE
      `),
      getChartData({
        activity: selectedChartActivity,
        year: selectedChartYear,
      }),
      getRecentActivities(),
      getTopMediaRows(),
    ]);

    const watchlistMovies = await enrichMediaRows(topMediaRows);
    const totalContentCount = movieContentCount + tvContentCount;

    return res.json({
      message: "Dashboard admin berhasil dimuat",
      user: req.user,
      stats: [
        {
          value: formatNumber(totalContentCount),
          label: "Film dan Series Direview",
        },
        {
          value: formatNumber(activeUserCount),
          label: "Total User Aktif",
        },
        {
          value: formatNumber(communityPostCount),
          label: "Community Post",
        },
        {
          value: formatNumber(moderationCount),
          label: "Laporan Masuk",
        },
      ],
      chart,
      chartMeta: {
        activity: selectedChartActivity,
        activityLabel: chartActivityOptions[selectedChartActivity].label,
        year: selectedChartYear,
      },
      activities,
      watchlistMovies,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil dashboard admin",
      error: error.message,
    });
  }
};

export const getAdminMovies = async (req, res) => {
  try {
    const managedRows = await getManagedMediaRows();
    const movies = managedRows.map(mapAdminMovieRow);

    return res.json({
      message: "Daftar film admin berhasil dimuat",
      total: movies.length,
      movies,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil daftar film admin",
      error: error.message,
    });
  }
};

export const createAdminMovie = async (req, res) => {
  try {
    const moviePayload = getAdminMoviePayload(req.body);

    if (moviePayload.error) {
      return res.status(400).json({
        message: moviePayload.error,
      });
    }

    const result = await pool.query(
      `
        INSERT INTO flix.admin_movies (
          created_by_user_id,
          title,
          release_year,
          duration,
          director,
          synopsis,
          cast_members,
          poster_url,
          trailer_url,
          rating,
          country,
          genres,
          platforms,
          moods,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING
          1 AS row_number,
          id_admin_movie,
          title,
          release_year,
          duration,
          director,
          synopsis,
          cast_members,
          poster_url,
          trailer_url,
          rating,
          country,
          genres,
          platforms,
          moods,
          status,
          0::INTEGER AS watchlist_count,
          created_at
      `,
      [
        req.user?.id_user || null,
        moviePayload.title,
        moviePayload.releaseYear,
        moviePayload.duration,
        moviePayload.director,
        moviePayload.synopsis,
        moviePayload.castMembers,
        moviePayload.posterUrl,
        moviePayload.trailerUrl,
        moviePayload.rating,
        moviePayload.country,
        moviePayload.genres,
        moviePayload.platforms,
        moviePayload.moods,
        moviePayload.status,
      ],
    );

    return res.status(201).json({
      message: moviePayload.status === "Draft" ? "Draft film berhasil disimpan" : "Film berhasil dipublish",
      movie: mapAdminMovieRow(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menambahkan film admin",
      error: error.message,
    });
  }
};

export const updateAdminMovie = async (req, res) => {
  try {
    const movieId = Number(req.params.id);

    if (!Number.isInteger(movieId) || movieId <= 0) {
      return res.status(400).json({
        message: "ID film tidak valid",
      });
    }

    const moviePayload = getAdminMoviePayload(req.body);

    if (moviePayload.error) {
      return res.status(400).json({
        message: moviePayload.error,
      });
    }

    const result = await pool.query(
      `
        UPDATE flix.admin_movies
        SET
          title = $1,
          release_year = $2,
          duration = $3,
          director = $4,
          synopsis = $5,
          cast_members = $6,
          poster_url = $7,
          trailer_url = $8,
          rating = $9,
          country = $10,
          genres = $11,
          platforms = $12,
          moods = $13,
          status = $14,
          updated_at = CURRENT_TIMESTAMP
        WHERE id_admin_movie = $15
        RETURNING
          1 AS row_number,
          id_admin_movie,
          title,
          release_year,
          duration,
          director,
          synopsis,
          cast_members,
          poster_url,
          trailer_url,
          rating,
          country,
          genres,
          platforms,
          moods,
          status,
          0::INTEGER AS watchlist_count,
          created_at
      `,
      [
        moviePayload.title,
        moviePayload.releaseYear,
        moviePayload.duration,
        moviePayload.director,
        moviePayload.synopsis,
        moviePayload.castMembers,
        moviePayload.posterUrl,
        moviePayload.trailerUrl,
        moviePayload.rating,
        moviePayload.country,
        moviePayload.genres,
        moviePayload.platforms,
        moviePayload.moods,
        moviePayload.status,
        movieId,
      ],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "Film tidak ditemukan",
      });
    }

    return res.json({
      message: moviePayload.status === "Draft" ? "Perubahan film disimpan sebagai draft" : "Perubahan film berhasil dipublish",
      movie: mapAdminMovieRow(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengubah film admin",
      error: error.message,
    });
  }
};

export const getAdminReviews = async (req, res) => {
  try {
    const [incomingRows, reportedRows] = await Promise.all([
      getAdminIncomingReviewRows(),
      getAdminReportedReviewRows(),
    ]);
    const isBlockedReviewReport = (row) =>
      String(row.report_status || "").toLowerCase() === "approved" ||
      String(row.moderation_status || "").toLowerCase() === "blocked";
    const blockedRows = reportedRows.filter(isBlockedReviewReport);
    const normalizeReportedRow = (row) => ({
      ...row,
      tmdb_id: row.metadata_tmdb_id,
      content: row.metadata_content || "Review dilaporkan oleh user.",
    });

    const [incoming, reported, blocked] = await Promise.all([
      mapAdminReviewRows(incomingRows),
      mapAdminReviewRows(reportedRows.map(normalizeReportedRow)),
      mapAdminReviewRows(blockedRows.map(normalizeReportedRow)),
    ]);

    return res.json({
      message: "Moderasi review admin berhasil dimuat",
      summary: {
        incoming: incoming.length,
        reported: reported.length,
        blocked: blocked.length,
      },
      reviews: {
        incoming,
        reported,
        blocked,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil moderasi review admin",
      error: error.message,
    });
  }
};

export const getAdminCommunity = async (req, res) => {
  try {
    const [postRows, reportedRows, totalPostRows, totalReplyRows] = await Promise.all([
      getAdminCommunityRows(),
      getAdminReportedCommunityRows(),
      safeRows(`
        SELECT COUNT(*)::INTEGER AS count
        FROM flix.posts
      `),
      safeRows(`
        SELECT COUNT(*)::INTEGER AS count
        FROM flix.comments
      `),
    ]);

    const posts = mapAdminCommunityRows(postRows);
    const reportedPosts = mapAdminCommunityRows(reportedRows);
    const blockedPosts = mapAdminCommunityRows(
      reportedRows.filter(
        (row) =>
          String(row.report_status || "").toLowerCase() === "approved" ||
          String(row.target_status || row.moderation_status || "").toLowerCase() === "blocked",
      ),
    );

    return res.json({
      message: "Kelola community admin berhasil dimuat",
      summary: {
        totalPost: Number(totalPostRows[0]?.count || posts.length),
        totalReply: Number(totalReplyRows[0]?.count || 0),
        reported: reportedPosts.length,
        blocked: blockedPosts.length,
      },
      posts: {
        all: posts,
        reported: reportedPosts,
        blocked: blockedPosts,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil kelola community admin",
      error: error.message,
    });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const users = mapAdminUsers(await getAdminUserRows());
    const summary = users.reduce(
      (accumulator, user) => {
        if (user.role === "admin") {
          accumulator.admin += 1;
        } else if (user.role === "moderator") {
          accumulator.moderator += 1;
        } else {
          accumulator.registeredUser += 1;
        }

        accumulator.total += 1;
        return accumulator;
      },
      {
        total: 0,
        admin: 0,
        moderator: 0,
        registeredUser: 0,
      },
    );

    return res.json({
      message: "Daftar user admin berhasil dimuat",
      summary,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil daftar user admin",
      error: error.message,
    });
  }
};

export const getAdminTransactions = async (req, res) => {
  try {
    await initializeUserStatusColumns();
    await initializePaymentTransactionsTable();

    const transactions = mapAdminTransactions(await getAdminTransactionRows());
    const summary = transactions.reduce(
      (accumulator, transaction) => {
        accumulator.all += 1;

        if (transaction.status === "Berhasil") {
          accumulator.success += 1;
        } else if (transaction.status === "Pending") {
          accumulator.pending += 1;
        } else {
          accumulator.failed += 1;
        }

        return accumulator;
      },
      {
        all: 0,
        success: 0,
        pending: 0,
        failed: 0,
      },
    );

    return res.json({
      message: "Riwayat transaksi admin berhasil dimuat",
      summary,
      transactions,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil transaksi admin",
      error: error.message,
    });
  }
};

const normalizeAdminPaymentMethods = (methods) => {
  if (!Array.isArray(methods)) {
    return [];
  }

  return methods
    .map((method, index) => {
      const id = String(method.id || method.id_method || "").trim();
      const type = String(method.type || "").trim().toLowerCase();
      const name = String(method.name || "").trim();

      if (!id || !["bank", "qris", "ewallet"].includes(type) || !name) {
        return null;
      }

      return {
        id,
        type,
        name,
        category: String(method.category || "").trim(),
        accountNumber: String(method.accountNumber || method.account_number || "").trim(),
        accountName: String(method.accountName || method.account_name || "").trim(),
        imageUrl: String(method.imageUrl || method.image_url || "").trim(),
        imageName: String(method.imageName || method.image_name || "").trim(),
        sortOrder: Number.isFinite(Number(method.sortOrder ?? method.sort_order))
          ? Number(method.sortOrder ?? method.sort_order)
          : index + 1,
      };
    })
    .filter(Boolean);
};

const normalizeAdminPaymentPackages = (packages) => {
  if (!Array.isArray(packages)) {
    return [];
  }

  return packages
    .map((paymentPackage, index) => {
      const code = String(
        paymentPackage.code || paymentPackage.packageCode || paymentPackage.package_code || "",
      ).trim();
      const name = String(
        paymentPackage.name || paymentPackage.packageName || paymentPackage.package_name || "",
      ).trim();
      const durationMonths = Number(
        paymentPackage.durationMonths || paymentPackage.duration_months || 1,
      );
      const price = Number(
        String(paymentPackage.price ?? paymentPackage.amount ?? "")
          .replace(/[^\d]/g, ""),
      );

      if (!code || !name || !Number.isFinite(durationMonths) || durationMonths <= 0) {
        return null;
      }

      return {
        code,
        name,
        durationMonths,
        price: Number.isFinite(price) ? price : 0,
        sortOrder: Number.isFinite(Number(paymentPackage.sortOrder ?? paymentPackage.sort_order))
          ? Number(paymentPackage.sortOrder ?? paymentPackage.sort_order)
          : index + 1,
      };
    })
    .filter(Boolean);
};

export const getAdminPaymentSettings = async (req, res) => {
  try {
    const methods = (await getPaymentMethodRows()).map(mapPaymentMethodRow);
    const packages = (await getPaymentPackageRows()).map(mapPaymentPackageRow);

    return res.json({ methods, packages });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil pengaturan pembayaran",
      error: error.message,
    });
  }
};

export const updateAdminPaymentSettings = async (req, res) => {
  const client = await pool.connect();

  try {
    const methods = normalizeAdminPaymentMethods(req.body?.methods);
    const packages = normalizeAdminPaymentPackages(req.body?.packages);

    if (!methods.length) {
      return res.status(400).json({
        message: "Minimal harus ada satu metode pembayaran aktif.",
      });
    }

    await initializePaymentMethodsTable();
    await client.query("BEGIN");
    await client.query("UPDATE flix.payment_methods SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP");

    for (const method of methods) {
      await client.query(
        `INSERT INTO flix.payment_methods (
           id_method,
           type,
           name,
           category,
           account_number,
           account_name,
           image_url,
           image_name,
           is_active,
           sort_order,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, CURRENT_TIMESTAMP)
         ON CONFLICT (id_method) DO UPDATE
         SET type = EXCLUDED.type,
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             account_number = EXCLUDED.account_number,
             account_name = EXCLUDED.account_name,
             image_url = EXCLUDED.image_url,
             image_name = EXCLUDED.image_name,
             is_active = TRUE,
             sort_order = EXCLUDED.sort_order,
             updated_at = CURRENT_TIMESTAMP`,
        [
          method.id,
          method.type,
          method.name,
          method.category,
          method.accountNumber,
          method.accountName,
          method.imageUrl,
          method.imageName,
          method.sortOrder,
        ],
      );
    }

    if (packages.length) {
      await client.query(
        "UPDATE flix.payment_packages SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP",
      );

      for (const paymentPackage of packages) {
        await client.query(
          `INSERT INTO flix.payment_packages (
             package_code,
             package_name,
             duration_months,
             price,
             is_active,
             sort_order,
             updated_at
           )
           VALUES ($1, $2, $3, $4, TRUE, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (package_code) DO UPDATE
           SET package_name = EXCLUDED.package_name,
               duration_months = EXCLUDED.duration_months,
               price = EXCLUDED.price,
               is_active = TRUE,
               sort_order = EXCLUDED.sort_order,
               updated_at = CURRENT_TIMESTAMP`,
          [
            paymentPackage.code,
            paymentPackage.name,
            paymentPackage.durationMonths,
            paymentPackage.price,
            paymentPackage.sortOrder,
          ],
        );
      }
    }

    await client.query("COMMIT");

    const nextMethods = (await getPaymentMethodRows()).map(mapPaymentMethodRow);
    const nextPackages = (await getPaymentPackageRows()).map(mapPaymentPackageRow);

    return res.json({
      message: "Pengaturan pembayaran berhasil disimpan.",
      methods: nextMethods,
      packages: nextPackages,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    return res.status(500).json({
      message: "Gagal menyimpan pengaturan pembayaran",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const updateAdminTransactionStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const transactionId = Number(req.params.id);
    const requestedStatus = String(req.body?.status || req.body?.action || "").trim().toLowerCase();
    const nextStatus = paymentTransactionStatusFromLabel[requestedStatus] || requestedStatus;

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return res.status(400).json({
        message: "ID transaksi tidak valid",
      });
    }

    if (!["approved", "rejected"].includes(nextStatus)) {
      return res.status(400).json({
        message: "Status transaksi harus approved atau rejected",
      });
    }

    await initializeUserStatusColumns();
    await initializePaymentTransactionsTable();

    await client.query("BEGIN");

    const transactionResult = await client.query(
      `SELECT pt.*, u.username, u.email, u.profile_image_url, u.is_premium, u.subscription_plan
       FROM flix.payment_transactions pt
       JOIN flix.users u ON u.id_user = pt.id_user
       WHERE pt.id_transaction = $1
       FOR UPDATE`,
      [transactionId],
    );

    if (transactionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Transaksi tidak ditemukan",
      });
    }

    const transaction = transactionResult.rows[0];

    if (transaction.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Status transaksi yang sudah diproses tidak bisa diubah ulang",
      });
    }

    const adminNote = String(req.body?.admin_note || req.body?.adminNote || "").trim();
    let updatedTransaction;

    if (nextStatus === "approved") {
      const approvedPlan =
        Number(transaction.duration_months || 1) >= 12 ||
        String(transaction.package_code || "").toLowerCase().includes("year") ||
        String(transaction.package_name || "").toLowerCase().includes("eksklusif")
          ? "exclusive"
          : "premium";

      const updateResult = await client.query(
        `UPDATE flix.payment_transactions
         SET status = 'approved',
             admin_note = NULLIF($1, ''),
             verified_by_user_id = $2,
             verified_at = CURRENT_TIMESTAMP,
             premium_started_at = CURRENT_TIMESTAMP,
             premium_expired_at = CURRENT_TIMESTAMP + ($3::TEXT || ' months')::INTERVAL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_transaction = $4
         RETURNING *`,
        [
          adminNote,
          req.user.id_user,
          Number(transaction.duration_months || 1),
          transactionId,
        ],
      );

      updatedTransaction = updateResult.rows[0];

      await client.query(
        `UPDATE flix.users
         SET is_premium = TRUE,
             subscription_plan = $1,
             payment_proof = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_user = $3`,
        [approvedPlan, transaction.payment_proof, transaction.id_user],
      );
    } else {
      const updateResult = await client.query(
        `UPDATE flix.payment_transactions
         SET status = 'rejected',
             admin_note = NULLIF($1, ''),
             verified_by_user_id = $2,
             verified_at = CURRENT_TIMESTAMP,
             premium_started_at = NULL,
             premium_expired_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_transaction = $3
         RETURNING *`,
        [adminNote, req.user.id_user, transactionId],
      );

      updatedTransaction = updateResult.rows[0];
    }

    await client.query("COMMIT");

    const mappedTransaction = mapAdminTransactions([
      {
        ...updatedTransaction,
        username: transaction.username,
        email: transaction.email,
        profile_image_url: transaction.profile_image_url,
        is_premium: nextStatus === "approved" ? true : transaction.is_premium,
      },
    ])[0];

    return res.json({
      message:
        nextStatus === "approved"
          ? "Transaksi berhasil disetujui dan akses premium user aktif."
          : "Transaksi berhasil ditolak.",
      transaction: mappedTransaction,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      message: "Gagal mengubah status transaksi",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const updateAdminUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const isActive = req.body?.is_active ?? req.body?.isActive;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "ID user tidak valid",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "Status aktif user harus berupa boolean",
      });
    }

    if (!isActive && Number(req.user?.id_user) === userId) {
      return res.status(400).json({
        message: "Admin tidak bisa menonaktifkan akun sendiri",
      });
    }

    await initializeUserStatusColumns();

    const result = await pool.query(
      `WITH updated_user AS (
        UPDATE flix.users
        SET
          is_active = $1::BOOLEAN,
          deactivated_at = CASE WHEN $1::BOOLEAN THEN NULL ELSE CURRENT_TIMESTAMP END,
          deactivated_by_user_id = CASE WHEN $1::BOOLEAN THEN NULL ELSE $2::BIGINT END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id_user = $3
        RETURNING
          id_user,
          username,
          email,
          email_verified,
          is_active,
          is_premium,
          profile_image_url,
          banner_image_url,
          created_at,
          deactivated_at,
          id_role
      )
      SELECT
        updated_user.*,
        roles.role_name
      FROM updated_user
      JOIN flix.roles roles ON updated_user.id_role = roles.id_role`,
      [isActive, req.user?.id_user || null, userId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const userRow = result.rows[0];

    return res.json({
      message: isActive ? "User berhasil diaktifkan" : "User berhasil dinonaktifkan",
      user: {
        id: Number(userRow.id_user),
        username: userRow.username,
        email: userRow.email,
        role: userRow.role_name,
        roleLabel: normalizeUserRole(userRow.role_name),
        status: formatAdminUserStatus(userRow),
        isActive: userRow.is_active !== false,
        isPremium: Boolean(userRow.is_premium),
        joinedAt: formatDate(userRow.created_at),
        deactivatedAt: userRow.deactivated_at ? formatDateTime(userRow.deactivated_at) : null,
        profileImageUrl: userRow.profile_image_url,
        bannerImageUrl: userRow.banner_image_url,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengubah status user",
      error: error.message,
    });
  }
};

export const updateAdminUser = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.params.id);
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = String(req.body?.role || "").trim();
    const allowedRoles = new Set(["registered_user", "moderator"]);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "ID user tidak valid",
      });
    }

    if (!username || username.length < 3) {
      return res.status(400).json({
        message: "Username minimal 3 karakter",
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "Format email tidak valid",
      });
    }

    if (!allowedRoles.has(role)) {
      return res.status(400).json({
        message: "Role hanya bisa diubah ke User Biasa atau Moderator",
      });
    }

    if (Number(req.user?.id_user) === userId && role !== "admin") {
      return res.status(400).json({
        message: "Admin tidak bisa menurunkan role akun sendiri",
      });
    }

    await client.query("BEGIN");

    const targetResult = await client.query(
      `SELECT id_user, username, email
       FROM flix.users
       WHERE id_user = $1
       FOR UPDATE`,
      [userId],
    );

    if (!targetResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const duplicateResult = await client.query(
      `SELECT id_user
       FROM flix.users
       WHERE id_user <> $1
         AND (LOWER(email) = LOWER($2) OR LOWER(username) = LOWER($3))
       LIMIT 1`,
      [userId, email, username],
    );

    if (duplicateResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Email atau username sudah digunakan user lain",
      });
    }

    const roleResult = await client.query(
      `SELECT id_role, role_name
       FROM flix.roles
       WHERE role_name = $1`,
      [role],
    );

    if (!roleResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Role tidak tersedia di database",
      });
    }

    const result = await client.query(
      `WITH updated_user AS (
        UPDATE flix.users
        SET
          username = $1,
          email = $2,
          id_role = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id_user = $4
        RETURNING
          id_user,
          username,
          email,
          email_verified,
          is_active,
          is_premium,
          profile_image_url,
          banner_image_url,
          created_at,
          deactivated_at,
          id_role
      )
      SELECT updated_user.*, roles.role_name
      FROM updated_user
      JOIN flix.roles roles ON updated_user.id_role = roles.id_role`,
      [username, email, roleResult.rows[0].id_role, userId],
    );

    await client.query("COMMIT");

    return res.json({
      message: "Data user berhasil diperbarui",
      user: mapAdminUserResponse(result.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      message: "Gagal memperbarui user",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const deleteAdminUser = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "ID user tidak valid",
      });
    }

    if (Number(req.user?.id_user) === userId) {
      return res.status(400).json({
        message: "Admin tidak bisa menghapus akun sendiri",
      });
    }

    await client.query("BEGIN");

    const targetResult = await client.query(
      `SELECT u.id_user, u.username, u.email, r.role_name
       FROM flix.users u
       JOIN flix.roles r ON r.id_role = u.id_role
       WHERE u.id_user = $1
       FOR UPDATE`,
      [userId],
    );

    if (!targetResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const targetUser = targetResult.rows[0];

    if (targetUser.role_name === "admin") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Akun admin tidak bisa dihapus dari dashboard",
      });
    }

    await client.query(
      `DELETE FROM flix.users
       WHERE id_user = $1`,
      [userId],
    );

    await client.query("COMMIT");

    return res.json({
      message: "User berhasil dihapus",
      user: {
        id: Number(targetUser.id_user),
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role_name,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      message: "Gagal menghapus user",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const resetAdminUserPassword = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const password = String(req.body?.password || "").trim();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "ID user tidak valid",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password baru minimal 6 karakter",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `WITH updated_user AS (
        UPDATE flix.users
        SET
          password = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id_user = $2
        RETURNING
          id_user,
          username,
          email,
          email_verified,
          is_active,
          is_premium,
          profile_image_url,
          banner_image_url,
          created_at,
          deactivated_at,
          id_role
      )
      SELECT updated_user.*, roles.role_name
      FROM updated_user
      JOIN flix.roles roles ON updated_user.id_role = roles.id_role`,
      [hashedPassword, userId],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    return res.json({
      message: "Password user berhasil direset",
      user: mapAdminUserResponse(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal reset password user",
      error: error.message,
    });
  }
};

export const updateAdminReviewReportStatus = async (req, res) => {
  const reportId = Number(req.params.reportId);
  const nextStatus = normalizeReviewReportStatus(req.body?.status);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({
      message: "ID report tidak valid",
    });
  }

  if (!nextStatus || !["approved", "rejected", "pending"].includes(nextStatus)) {
    return res.status(400).json({
      message: "Status report tidak valid",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `SELECT
         id_report,
         movie_review_id,
         tv_series_review_id
       FROM flix.reports
       WHERE id_report = $1
         AND (movie_review_id IS NOT NULL OR tv_series_review_id IS NOT NULL)`,
      [reportId],
    );

    if (!reportResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Report review tidak ditemukan",
      });
    }

    const report = reportResult.rows[0];
    const mediaType = report.movie_review_id ? "movie" : "tv";
    const reviewId = Number(report.movie_review_id || report.tv_series_review_id);
    const reportColumn = mediaType === "movie" ? "movie_review_id" : "tv_series_review_id";
    const reviewTable = mediaType === "movie" ? "flix.movie_reviews" : "flix.tv_series_reviews";

    const updatedReport = await client.query(
      `UPDATE flix.reports
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_report = $2
       RETURNING id_report, status, updated_at`,
      [nextStatus, reportId],
    );

    if (nextStatus === "approved") {
      await client.query(
        `UPDATE ${reviewTable}
         SET moderation_status = 'blocked',
             blocked_at = CURRENT_TIMESTAMP,
             blocked_by_user_id = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_review = $2`,
        [req.user.id_user, reviewId],
      );
    } else {
      const otherApprovedReports = await client.query(
        `SELECT COUNT(*)::INTEGER AS count
         FROM flix.reports
         WHERE ${reportColumn} = $1
           AND id_report <> $2
           AND status = 'approved'`,
        [reviewId, reportId],
      );

      if (Number(otherApprovedReports.rows[0]?.count || 0) === 0) {
        await client.query(
          `UPDATE ${reviewTable}
           SET moderation_status = 'active',
               blocked_at = NULL,
               blocked_by_user_id = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id_review = $1`,
          [reviewId],
        );
      }
    }

    await client.query("COMMIT");

    return res.json({
      message:
        nextStatus === "approved"
          ? "Review berhasil dipindahkan ke Review Terblokir"
          : "Report review berhasil ditolak",
      report: {
        id: Number(updatedReport.rows[0].id_report),
        status: updatedReport.rows[0].status,
        statusLabel: formatReviewReportStatus(updatedReport.rows[0].status),
        mediaType,
        reviewId,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      message: "Gagal mengubah status report review",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const updateAdminCommunityReportStatus = async (req, res) => {
  const reportId = Number(req.params.reportId);
  const nextStatus = normalizeReviewReportStatus(req.body?.status);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({
      message: "ID report tidak valid",
    });
  }

  if (!nextStatus || !["approved", "rejected", "pending"].includes(nextStatus)) {
    return res.status(400).json({
      message: "Status report tidak valid",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `SELECT
         id_report,
         community_post_id,
         community_comment_id
       FROM flix.reports
       WHERE id_report = $1
         AND (community_post_id IS NOT NULL OR community_comment_id IS NOT NULL)`,
      [reportId],
    );

    if (!reportResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Report community tidak ditemukan",
      });
    }

    const report = reportResult.rows[0];
    const isPostReport = Boolean(report.community_post_id);
    const targetId = Number(report.community_post_id || report.community_comment_id);
    const targetKind = isPostReport ? "post" : "reply";
    const reportColumn = isPostReport ? "community_post_id" : "community_comment_id";
    const targetTable = isPostReport ? "flix.posts" : "flix.comments";
    const targetIdColumn = isPostReport ? "id_post" : "id_comment";

    const updatedReport = await client.query(
      `UPDATE flix.reports
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_report = $2
       RETURNING id_report, status, updated_at`,
      [nextStatus, reportId],
    );

    let targetStatus = "active";

    if (nextStatus === "approved") {
      targetStatus = "blocked";
      await client.query(
        `UPDATE ${targetTable}
         SET moderation_status = 'blocked',
             blocked_at = CURRENT_TIMESTAMP,
             blocked_by_user_id = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE ${targetIdColumn} = $2`,
        [req.user.id_user, targetId],
      );
    } else {
      const otherApprovedReports = await client.query(
        `SELECT COUNT(*)::INTEGER AS count
         FROM flix.reports
         WHERE ${reportColumn} = $1
           AND id_report <> $2
           AND status = 'approved'`,
        [targetId, reportId],
      );

      if (Number(otherApprovedReports.rows[0]?.count || 0) === 0) {
        await client.query(
          `UPDATE ${targetTable}
           SET moderation_status = 'active',
               blocked_at = NULL,
               blocked_by_user_id = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE ${targetIdColumn} = $1`,
          [targetId],
        );
      } else {
        targetStatus = "blocked";
      }
    }

    await client.query("COMMIT");

    return res.json({
      message:
        nextStatus === "approved"
          ? "Konten community berhasil diblokir"
          : "Report community berhasil ditolak",
      report: {
        id: Number(updatedReport.rows[0].id_report),
        status: updatedReport.rows[0].status,
        statusLabel: formatCommunityReportStatus(updatedReport.rows[0].status),
        targetKind,
        targetId,
      },
      target: {
        kind: targetKind,
        id: targetId,
        status: targetStatus,
        statusLabel: formatCommunityTargetStatus(targetStatus),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      message: "Gagal mengubah status report community",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const getAdminUserDetail = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "ID user tidak valid",
      });
    }

    const {
      userRows,
      reviewStatsRows,
      postCountRows,
      latestReviewRows,
      latestPostRows,
    } = await getAdminUserDetailRows(userId);

    if (!userRows.length) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const userRow = userRows[0];
    const reviews = await mapReviewMediaRows(latestReviewRows);
    const posts = latestPostRows.map((post) => ({
      id: Number(post.id_post),
      title: post.title || "Post tanpa judul",
      content: post.content || "",
      date: formatDate(post.created_at),
      createdAt: post.created_at,
      viewCount: Number(post.view_count || 0),
      likeCount: Number(post.like_count || 0),
      replyCount: Number(post.reply_count || 0),
      shareCount: Number(post.share_count || 0),
    }));

    const activities = [
      ...reviews.map((review) => ({
        type: "Review",
        title: `Menulis Review ${review.title}`,
        time: formatDateTime(review.createdAt),
        createdAt: review.createdAt,
      })),
      ...posts.map((post) => ({
        type: "Post",
        title: `Membuat Post ${post.title}`,
        time: formatDateTime(post.createdAt),
        createdAt: post.createdAt,
      })),
      {
        type: "Akun",
        title: "Bergabung ke FLIX",
        time: formatDateTime(userRow.created_at),
        createdAt: userRow.created_at,
      },
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    const reviewStats = reviewStatsRows[0] || {};
    const postCount = Number(postCountRows[0]?.post_count || 0);

    return res.json({
      message: "Detail user admin berhasil dimuat",
      user: {
        id: Number(userRow.id_user),
        username: userRow.username,
        email: userRow.email,
        role: userRow.role_name,
        roleLabel: normalizeUserRole(userRow.role_name),
        status: formatAdminUserStatus(userRow),
        isActive: userRow.is_active !== false,
        isPremium: Boolean(userRow.is_premium),
        joinedAt: formatDate(userRow.created_at),
        joinedAtDetail: formatDateTime(userRow.created_at),
        deactivatedAt: userRow.deactivated_at ? formatDateTime(userRow.deactivated_at) : null,
        location: "-",
        profileImageUrl: userRow.profile_image_url,
        bannerImageUrl: userRow.banner_image_url,
      },
      stats: {
        totalWatchlist: 0,
        reviewsCreated: Number(reviewStats.review_count || 0),
        watchedMovies: 0,
        averageRating: Number(reviewStats.average_rating || 0),
        postsCreated: postCount,
      },
      activities,
      reviews,
      posts,
      watchlist: [],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil detail user admin",
      error: error.message,
    });
  }
};

const contactCategoryLabels = {
  bug_report: "Bug Report",
  kritik_saran: "Kritik & Saran",
  kendala_akun: "Kendala Akun",
  pertanyaan_umum: "Pertanyaan Umum",
  lainnya: "Lainnya",
};

const contactStatusLabels = {
  pending: "Pending",
  reviewed: "Ditinjau",
  resolved: "Selesai",
  closed: "Ditutup",
};

const mapAdminContactMessage = (row) => ({
  id: Number(row.id_contact_message),
  userId: row.id_user ? Number(row.id_user) : null,
  name: row.name || "-",
  email: row.email || "-",
  subject: row.subject || "-",
  category: row.category || "lainnya",
  categoryLabel: contactCategoryLabels[row.category] || "Lainnya",
  message: row.message || "-",
  status: row.status || "pending",
  statusLabel: contactStatusLabels[row.status] || "Pending",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  formattedDate: formatDateTime(row.created_at),
});

export const getAdminContactMessages = async (req, res) => {
  try {
    await initializeContactMessagesTable();

    const result = await pool.query(
      `SELECT
          id_contact_message,
          id_user,
          name,
          email,
          subject,
          category,
          message,
          status,
          created_at,
          updated_at
       FROM flix.contact_messages
       ORDER BY created_at DESC`,
    );

    const messages = result.rows.map(mapAdminContactMessage);
    const summary = messages.reduce(
      (accumulator, message) => {
        accumulator.all += 1;
        accumulator[message.status] = (accumulator[message.status] || 0) + 1;
        return accumulator;
      },
      {
        all: 0,
        pending: 0,
        reviewed: 0,
        resolved: 0,
        closed: 0,
      },
    );

    return res.json({
      message: "Pesan Contact Us berhasil dimuat",
      summary,
      messages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil pesan Contact Us",
      error: error.message,
    });
  }
};

export const updateAdminContactMessageStatus = async (req, res) => {
  try {
    await initializeContactMessagesTable();

    const messageId = Number(req.params.id);
    const nextStatus = String(req.body?.status || "").toLowerCase();

    if (!Number.isFinite(messageId)) {
      return res.status(400).json({ message: "ID pesan Contact Us tidak valid" });
    }

    if (!["pending", "reviewed", "resolved", "closed"].includes(nextStatus)) {
      return res.status(400).json({ message: "Status Contact Us tidak valid" });
    }

    const result = await pool.query(
      `UPDATE flix.contact_messages
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id_contact_message = $2
       RETURNING *`,
      [nextStatus, messageId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Pesan Contact Us tidak ditemukan" });
    }

    return res.json({
      message: "Status pesan Contact Us berhasil diperbarui",
      contactMessage: mapAdminContactMessage(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal memperbarui status Contact Us",
      error: error.message,
    });
  }
};
