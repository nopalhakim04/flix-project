import pool from "../config/db.js";

export const REPORT_CATEGORIES = [
  { value: "spam", label: "Spam / promosi" },
  { value: "harassment", label: "Pelecehan / bullying" },
  { value: "hate_speech", label: "Ujaran kebencian" },
  { value: "violence", label: "Kekerasan / ancaman" },
  { value: "sexual_content", label: "Konten seksual" },
  { value: "misinformation", label: "Informasi salah" },
  { value: "spoiler", label: "Spoiler tanpa peringatan" },
  { value: "copyright", label: "Pelanggaran hak cipta" },
  { value: "other", label: "Lainnya" },
];

const reportTargets = {
  movie_review: {
    type: "movie_review",
    reportColumn: "movie_review_id",
    targetTable: "flix.movie_reviews",
    targetIdColumn: "id_review",
    ownerColumn: "id_user",
  },
  tv_series_review: {
    type: "tv_series_review",
    reportColumn: "tv_series_review_id",
    targetTable: "flix.tv_series_reviews",
    targetIdColumn: "id_review",
    ownerColumn: "id_user",
  },
  community_post: {
    type: "community_post",
    reportColumn: "community_post_id",
    targetTable: "flix.posts",
    targetIdColumn: "id_post",
    ownerColumn: "id_user",
  },
  community_reply: {
    type: "community_reply",
    reportColumn: "community_comment_id",
    targetTable: "flix.comments",
    targetIdColumn: "id_comment",
    ownerColumn: "id_user",
  },
  user_profile: {
    type: "user_profile",
    reportColumn: "reported_user_id",
    targetTable: "flix.users",
    targetIdColumn: "id_user",
    ownerColumn: "id_user",
    targetNotFoundMessage: "User yang dilaporkan tidak ditemukan",
    selfReportMessage: "Kamu tidak bisa melaporkan akun sendiri",
  },
};

const targetAliases = {
  review_movie: "movie_review",
  movieReview: "movie_review",
  tv_review: "tv_series_review",
  series_review: "tv_series_review",
  tvSeriesReview: "tv_series_review",
  post: "community_post",
  communityPost: "community_post",
  reply: "community_reply",
  comment: "community_reply",
  community_comment: "community_reply",
  communityReply: "community_reply",
  user: "user_profile",
  profile_user: "user_profile",
  userProfile: "user_profile",
  reported_user: "user_profile",
  reportedUser: "user_profile",
};

const categoryValues = new Set(REPORT_CATEGORIES.map((item) => item.value));

const normalizeTargetType = (value) => {
  const rawValue = String(value || "").trim();
  return targetAliases[rawValue] || rawValue;
};

export const getReportCategories = (req, res) => {
  return res.json({
    categories: REPORT_CATEGORIES,
  });
};

export const createReport = async (req, res) => {
  try {
    const targetType = normalizeTargetType(
      req.body.target_type || req.body.targetType,
    );
    const targetId = Number(req.body.target_id || req.body.targetId);
    const category = String(req.body.category || "").trim();
    const reason = String(req.body.reason || "").trim();
    const reporterUserId = req.user?.id_user;
    const targetConfig = reportTargets[targetType];

    if (!targetConfig) {
      return res.status(400).json({
        message: "Jenis report tidak valid",
      });
    }

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        message: "Target report tidak valid",
      });
    }

    if (!categoryValues.has(category)) {
      return res.status(400).json({
        message: "Kategori report tidak valid",
      });
    }

    if (reason.length < 8) {
      return res.status(400).json({
        message: "Alasan report minimal 8 karakter",
      });
    }

    if (reason.length > 500) {
      return res.status(400).json({
        message: "Alasan report maksimal 500 karakter",
      });
    }

    const targetResult = await pool.query(
      `SELECT ${targetConfig.targetIdColumn} AS id, ${targetConfig.ownerColumn} AS id_user
       FROM ${targetConfig.targetTable}
       WHERE ${targetConfig.targetIdColumn} = $1`,
      [targetId],
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({
        message: targetConfig.targetNotFoundMessage || "Konten yang dilaporkan tidak ditemukan",
      });
    }

    if (Number(targetResult.rows[0].id_user) === Number(reporterUserId)) {
      return res.status(400).json({
        message: targetConfig.selfReportMessage || "Kamu tidak bisa melaporkan konten sendiri",
      });
    }

    const result = await pool.query(
      `INSERT INTO flix.reports (
         reporter_user_id,
         report_type,
         category,
         reason,
         ${targetConfig.reportColumn}
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_user_id, ${targetConfig.reportColumn})
       WHERE ${targetConfig.reportColumn} IS NOT NULL
       DO UPDATE SET
         category = EXCLUDED.category,
         reason = EXCLUDED.reason,
         status = 'pending',
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [reporterUserId, targetConfig.type, category, reason, targetId],
    );

    return res.status(201).json({
      message: "Report berhasil dikirim",
      report: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengirim report",
      error: error.message,
    });
  }
};
