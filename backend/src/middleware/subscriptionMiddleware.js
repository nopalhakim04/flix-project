import pool from "../config/db.js";

export const PREMIUM_FEATURE_MESSAGE =
  "Fitur ini hanya tersedia untuk pengguna Premium atau Eksklusif.";

export const EXCLUSIVE_FEATURE_MESSAGE =
  "Chatbot FLIX hanya tersedia untuk pengguna Eksklusif.";

export const normalizeSubscriptionPlan = (user = {}) => {
  const plan = String(user.subscription_plan || "").toLowerCase();

  if (["free", "premium", "exclusive"].includes(plan)) {
    return plan;
  }

  return user.is_premium ? "premium" : "free";
};

export const isPremiumOrExclusive = (user = {}) =>
  ["premium", "exclusive"].includes(normalizeSubscriptionPlan(user));

export const isExclusive = (user = {}) =>
  normalizeSubscriptionPlan(user) === "exclusive";

export const getUserSubscriptionPlan = async (userId) => {
  const result = await pool.query(
    `SELECT id_user, is_premium, subscription_plan
     FROM flix.users
     WHERE id_user = $1`,
    [userId],
  );

  if (!result.rows.length) {
    return null;
  }

  return normalizeSubscriptionPlan(result.rows[0]);
};

export const requireSubscription = (
  allowedPlans,
  message = PREMIUM_FEATURE_MESSAGE,
) => {
  const allowed = new Set(allowedPlans);

  return async (req, res, next) => {
    try {
      const userId = req.user?.id_user || req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User belum login" });
      }

      const plan = await getUserSubscriptionPlan(userId);

      if (!plan) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      req.user.subscription_plan = plan;
      req.user.is_premium = plan === "premium" || plan === "exclusive";

      if (!allowed.has(plan)) {
        return res.status(403).json({ message });
      }

      return next();
    } catch (error) {
      return res.status(500).json({
        message: "Gagal memeriksa akses langganan",
        error: error.message,
      });
    }
  };
};

export const requirePremiumFeature = requireSubscription(
  ["premium", "exclusive"],
  PREMIUM_FEATURE_MESSAGE,
);

export const requireExclusiveFeature = requireSubscription(
  ["exclusive"],
  EXCLUSIVE_FEATURE_MESSAGE,
);
