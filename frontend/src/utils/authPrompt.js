export const isUserLoggedIn = () => Boolean(localStorage.getItem("token"));

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export const normalizeSubscriptionPlan = (user = getStoredUser()) => {
  const plan = String(user?.subscription_plan || "").toLowerCase();

  if (["free", "premium", "exclusive"].includes(plan)) {
    return plan;
  }

  return user?.is_premium ? "premium" : "free";
};

export const hasPremiumAccess = (user = getStoredUser()) =>
  ["premium", "exclusive"].includes(normalizeSubscriptionPlan(user));

export const hasExclusiveAccess = (user = getStoredUser()) =>
  normalizeSubscriptionPlan(user) === "exclusive";

export const hasPendingPayment = (user = getStoredUser()) => {
  const directStatus = String(
    user?.pending_payment_status ||
      user?.pendingPaymentStatus ||
      user?.payment_status ||
      user?.paymentStatus ||
      "",
  ).toLowerCase();

  const nestedStatus = String(
    user?.pendingPayment?.status ||
      user?.payment?.status ||
      user?.latestPayment?.status ||
      "",
  ).toLowerCase();

  return directStatus === "pending" || nestedStatus === "pending";
};

export const getUpgradeTargetPath = (user = getStoredUser()) =>
  hasPendingPayment(user) ? "/payment" : "/premium";

export const PREMIUM_FEATURE_MESSAGE =
  "Fitur ini hanya tersedia untuk pengguna Premium atau Eksklusif.";

export const EXCLUSIVE_FEATURE_MESSAGE =
  "Chatbot FLIX hanya tersedia untuk pengguna Eksklusif.";

export const FREE_WATCHLIST_LIMIT = 10;

export const WATCHLIST_LIMIT_MESSAGE =
  "Watchlist Free maksimal 10 item. Upgrade ke Premium atau Eksklusif untuk watchlist unlimited.";

export const showLoginRequired = () => {
  window.dispatchEvent(new CustomEvent("flix:require-login"));
};

export const showUpgradeRequired = (message = PREMIUM_FEATURE_MESSAGE) => {
  window.dispatchEvent(
    new CustomEvent("flix:require-upgrade", {
      detail: { message, targetPath: getUpgradeTargetPath() },
    }),
  );
};

export const requireLogin = () => {
  if (isUserLoggedIn()) {
    return true;
  }

  showLoginRequired();
  return false;
};

export const requirePremiumAccess = () => {
  if (!requireLogin()) {
    return false;
  }

  if (hasPremiumAccess()) {
    return true;
  }

  showUpgradeRequired(PREMIUM_FEATURE_MESSAGE);
  return false;
};

export const requireExclusiveAccess = () => {
  if (!requireLogin()) {
    return false;
  }

  if (hasExclusiveAccess()) {
    return true;
  }

  showUpgradeRequired(EXCLUSIVE_FEATURE_MESSAGE);
  return false;
};

export const canAddWatchlistItem = (primaryList = [], secondaryList = []) => {
  if (!requireLogin()) {
    return false;
  }

  if (hasPremiumAccess()) {
    return true;
  }

  const totalItems =
    (Array.isArray(primaryList) ? primaryList.length : 0) +
    (Array.isArray(secondaryList) ? secondaryList.length : 0);

  if (totalItems < FREE_WATCHLIST_LIMIT) {
    return true;
  }

  showUpgradeRequired(WATCHLIST_LIMIT_MESSAGE);
  return false;
};
