import blueDiamondIcon from "@/assets/icon/bluediamond-icon.png";
import { resolveMediaUrl } from "@/utils/media";
import { normalizeSubscriptionPlan } from "@/utils/authPrompt";
import "./PremiumAvatar.css";

const getInitial = (name = "User") =>
  String(name).trim().charAt(0).toUpperCase() || "U";

function PremiumAvatar({
  imageUrl,
  name,
  isPremium = false,
  subscriptionPlan,
  className = "",
  alt,
  ariaHidden = false,
}) {
  const resolvedImageUrl = resolveMediaUrl(imageUrl);
  const plan = normalizeSubscriptionPlan({
    subscription_plan: subscriptionPlan,
    is_premium: isPremium,
  });
  const hasBadge = plan === "premium" || plan === "exclusive";
  const badgeLabel = plan === "exclusive" ? "Eksklusif" : "Premium";
  const classes = [
    "premium-avatar",
    className,
    resolvedImageUrl ? "has-image" : "",
    hasBadge ? "is-premium" : "",
    plan === "exclusive" ? "is-exclusive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-hidden={ariaHidden || undefined}>
      {resolvedImageUrl ? (
        <img
          className="premium-avatar__image"
          src={resolvedImageUrl}
          alt={alt ?? name ?? "Profile"}
        />
      ) : (
        getInitial(name)
      )}

      {hasBadge && (
        <span className="premium-avatar__badge" title={badgeLabel}>
          <img src={blueDiamondIcon} alt={badgeLabel} />
        </span>
      )}
    </span>
  );
}

export default PremiumAvatar;
