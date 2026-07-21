import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  FaBookmark,
  FaCalendarAlt,
  FaCheck,
  FaClock,
  FaEdit,
  FaFacebookF,
  FaEnvelope,
  FaRegCommentDots,
  FaSearch,
  FaStar,
  FaTimes,
  FaTrash,
  FaTwitter,
  FaUserPlus,
  FaYoutube,
} from "react-icons/fa";
import SiteNavbar from "@/components/layout/SiteNavbar";
import PremiumAvatar from "@/components/ui/PremiumAvatar";
import diamondIcon from "@/assets/icon/bluediamond-icon.png";
import galleryAddIcon from "@/assets/icon/gallery-add.svg";
import santaiIcon from "@/assets/emoticon/santai-emoticon.png";
import seruIcon from "@/assets/emoticon/seru-emoticon.png";
import sedihIcon from "@/assets/emoticon/sedih-emoticon.png";
import menegangkanIcon from "@/assets/emoticon/menegangkan-emoticon.png";
import romantisIcon from "@/assets/emoticon/romantis-emoticon.png";
import pikiranIcon from "@/assets/emoticon/pikiran-emoticon.png";
import { createChatThreadFromUser, openChatThread } from "@/utils/chat";
import {
  getUpgradeTargetPath,
  hasPendingPayment,
  normalizeSubscriptionPlan,
  requirePremiumAccess,
} from "@/utils/authPrompt";
import { resolveMediaUrl } from "@/utils/media";
import {
  readMoodHistory,
  readWatchlist as readStoredWatchlist,
  readWatchStatus,
} from "@/utils/watchlistStorage";
import { confirmAction } from "@/utils/alerts";
import "./ProfilePage.css";

const apiUrl = import.meta.env.VITE_API_URL;

const fallbackPoster =
  "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg";

const cropConfig = {
  profile_image_url: {
    title: "Crop Foto Profile",
    outputWidth: 512,
    outputHeight: 512,
  },
  banner_image_url: {
    title: "Crop Banner",
    outputWidth: 1116,
    outputHeight: 300,
  },
};

const loadImage = (source) =>
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
  type,
}) => {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const stageWidth = stageSize.width || outputWidth || 1;
  const stageHeight = stageSize.height || outputHeight || 1;
  const baseScale = Math.max(
    stageWidth / image.naturalWidth,
    stageHeight / image.naturalHeight,
  );
  const renderedWidth = image.naturalWidth * baseScale * zoom;
  const renderedHeight = image.naturalHeight * baseScale * zoom;
  const sourceScale = 1 / (baseScale * zoom);
  const sourceWidth = Math.min(stageWidth * sourceScale, image.naturalWidth);
  const sourceHeight = Math.min(stageHeight * sourceScale, image.naturalHeight);
  const sourceX = Math.min(
    Math.max(0, ((renderedWidth - stageWidth) / 2 - pan.x) * sourceScale),
    image.naturalWidth - sourceWidth,
  );
  const sourceY = Math.min(
    Math.max(0, ((renderedHeight - stageHeight) / 2 - pan.y) * sourceScale),
    image.naturalHeight - sourceHeight,
  );

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
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
      0.92,
    );
  });
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca gambar"));
    reader.readAsDataURL(blob);
  });

const movieGenreLookup = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animasi",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Komedi",
  53: "Thriller",
  80: "Crime",
  878: "Sci-Fi",
  9648: "Mystery",
  10749: "Romantis",
  10751: "Family",
};

const tvGenreLookup = {
  16: "Animasi",
  18: "Drama",
  35: "Komedi",
  80: "Crime",
  9648: "Mystery",
  10751: "Family",
  10759: "Adventure",
  10765: "Fantasy",
};

const moodDefinitions = [
  {
    key: "santai",
    label: "Santai",
    icon: santaiIcon,
    genreIds: [35, 10751, 16],
  },
  { key: "seru", label: "Seru", icon: seruIcon, genreIds: [28, 12, 10759] },
  { key: "sedih", label: "Sedih", icon: sedihIcon, genreIds: [18] },
  {
    key: "menegangkan",
    label: "Menegangkan",
    icon: menegangkanIcon,
    genreIds: [53, 27, 80, 9648],
  },
  { key: "romantis", label: "Romantis", icon: romantisIcon, genreIds: [10749] },
  {
    key: "pikiran",
    label: "Pikiran",
    icon: pikiranIcon,
    genreIds: [878, 10765, 9648],
  },
];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

const getItemKey = (item) => `${item.mediaType}:${item.id}`;
const getReviewKey = (review) => `${review.media_type}:${review.id_review}`;
const getReviewApiUrl = (review) =>
  review.media_type === "tv"
    ? `${apiUrl}/api/tv-series-reviews/${review.id_review}`
    : `${apiUrl}/api/movie-reviews/${review.id_review}`;

const getFriendSearchButtonLabel = (status) => {
  if (status === "accepted") return "Teman";
  if (status === "pending_sent") return "Terkirim";
  if (status === "pending_received") return "Menunggu kamu";
  return "Add";
};

const getInitial = (name = "User") =>
  name.trim().slice(0, 1).toUpperCase() || "U";

const getYear = (date) => date?.slice?.(0, 4) || "-";

const formatRating = (rating) => {
  const value = Number(rating);
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
};

const formatDate = (dateValue) => {
  if (!dateValue) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateValue));
};

const formatJoinDate = (dateValue) => {
  if (!dateValue) {
    return "Bergabung sejak -";
  }

  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(dateValue));

  return `Bergabung sejak ${formattedDate}`;
};

const stripHtml = (value = "") =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const truncateText = (value = "", maxLength = 140) => {
  const text = stripHtml(value);

  if (text.length <= maxLength) {
    return text || "-";
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
};

const normalizeWatchlistItem = (item, mediaType) => ({
  ...item,
  mediaType,
  title: item.title || item.name || item.original_name || "Untitled",
  poster: item.poster || item.poster_url || fallbackPoster,
  genre_ids: item.genre_ids || [],
});

const getGenreName = (genreId, mediaType = "movie") => {
  const lookup = mediaType === "tv" ? tvGenreLookup : movieGenreLookup;
  return lookup[Number(genreId)] || movieGenreLookup[Number(genreId)] || "Film";
};

function ProfileStatCard({ value, label, icon }) {
  return (
    <div className="profile-stat-card">
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
      <span className="profile-stat-card__icon">{icon}</span>
    </div>
  );
}

function ProfileReviewItem({ item, disabled, onEdit, onDelete }) {
  const genres = item.genres?.length
    ? item.genres.slice(0, 2)
    : (item.genre_ids || [])
        .slice(0, 2)
        .map((genreId) => getGenreName(genreId, item.media_type));

  return (
    <article className="profile-review-item">
      <img src={item.poster || fallbackPoster} alt={item.title} />
      <div className="profile-review-item__body">
        <div className="profile-review-item__header">
          <div>
            <h3>{item.title}</h3>
            <div
              className="profile-review-rating"
              aria-label={`Rating ${item.rating} dari 5`}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar
                  key={star}
                  className={
                    star <= Number(item.rating || 0) ? "is-active" : ""
                  }
                />
              ))}
              <span>{formatRating(Number(item.rating || 0))}</span>
            </div>
          </div>
          <div className="profile-review-actions">
            <button
              type="button"
              aria-label={`Edit review ${item.title}`}
              disabled={disabled}
              onClick={() => onEdit(item)}
            >
              <FaEdit />
            </button>
            <button
              type="button"
              aria-label={`Hapus review ${item.title}`}
              disabled={disabled}
              onClick={() => onDelete(item)}
            >
              <FaTrash />
            </button>
          </div>
        </div>
        <p>{truncateText(item.content)}</p>
        <div className="profile-review-meta">
          <span>{formatDate(item.created_at)}</span>
          {genres.map((genre) => (
            <span key={`${item.id_review}-${genre}`}>{genre}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function ProfilePostItem({ post }) {
  return (
    <article className="profile-post-item">
      <div className="profile-post-item__header">
        <div>
          <h3>{post.title || "Community Post"}</h3>
          <span>{formatDate(post.created_at)}</span>
        </div>
        <Link to={`/post/${post.id_post}`}>Buka Post</Link>
      </div>
      <p>{truncateText(post.content, 180)}</p>
      <div className="profile-post-item__meta">
        <span>{post.reply_count || 0} reply</span>
        <span>{post.like_count || 0} like</span>
        <span>{post.reaction_count || 0} reaction</span>
      </div>
    </article>
  );
}

function ProfileFriendItem({ friend, disabled, onMessage, onRemove }) {
  return (
    <article className="profile-friend-item">
      <PremiumAvatar
        className="profile-friend-avatar"
        imageUrl={friend.profile_image_url}
        name={friend.username || friend.email}
        isPremium={Boolean(friend.is_premium)}
        alt={friend.username || "Friend"}
      />

      <div>
        <h3>{friend.username || "User FLIX"}</h3>
        <p>{friend.email || "Teman FLIX"}</p>
        <small>Berteman sejak {formatDate(friend.friend_since)}</small>
      </div>

      <div className="profile-friend-actions">
        <button
          className="profile-friend-remove-button"
          type="button"
          onClick={() => onRemove(friend)}
          disabled={disabled}
        >
          <FaTrash />
          Remove
        </button>
        <button
          type="button"
          onClick={() => onMessage(friend)}
          disabled={disabled}
        >
          <FaEnvelope />
          Message
        </button>
      </div>
    </article>
  );
}

function ProfileFriendRequestItem({ request, disabled, onAccept, onDecline }) {
  return (
    <article className="profile-friend-request-item">
      <PremiumAvatar
        className="profile-friend-avatar"
        imageUrl={request.profile_image_url}
        name={request.username || request.email}
        isPremium={Boolean(request.is_premium)}
        alt={request.username || "Friend request"}
      />

      <div>
        <h3>{request.username || "User FLIX"}</h3>
        <p>{request.email || "Mengirim permintaan pertemanan"}</p>
        <small>Meminta berteman pada {formatDate(request.requested_at)}</small>
      </div>

      <div className="profile-friend-request-actions">
        <button
          type="button"
          onClick={() => onAccept(request)}
          disabled={disabled}
        >
          <FaCheck />
          Accept
        </button>
        <button
          type="button"
          onClick={() => onDecline(request)}
          disabled={disabled}
        >
          <FaTimes />
          Decline
        </button>
      </div>
    </article>
  );
}

function ProfileFriendSearchResult({ user, disabled, onAdd }) {
  const status = user.friendship_status;
  const canAdd = !status;

  return (
    <article className="profile-friend-search-result">
      <PremiumAvatar
        className="profile-friend-avatar"
        imageUrl={user.profile_image_url}
        name={user.username || user.email}
        isPremium={Boolean(user.is_premium)}
        alt={user.username || "User FLIX"}
      />

      <div>
        <h3>{user.username || "User FLIX"}</h3>
        <p>{user.email || "User FLIX"}</p>
      </div>

      <button
        type="button"
        className={canAdd ? "" : "is-disabled-state"}
        onClick={() => onAdd(user)}
        disabled={disabled || !canAdd}
      >
        {canAdd && <FaUserPlus />}
        {getFriendSearchButtonLabel(status)}
      </button>
    </article>
  );
}

function EditProfileModal({
  open,
  form,
  saving,
  profileImageUrl,
  bannerImageUrl,
  uploadingTarget,
  onClose,
  onChange,
  onSubmit,
  onPickAvatar,
  onPickBanner,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="profile-edit-modal" role="presentation" onClick={onClose}>
      <form
        className="profile-edit-modal__dialog"
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profile-edit-modal__header">
          <button
            type="button"
            className="profile-edit-modal__close"
            onClick={onClose}
            aria-label="Tutup edit profil"
          >
            <FaTimes />
          </button>
          <h2>Edit Profile</h2>
          <button type="submit" className="profile-edit-modal__save" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>

        <section
          className={`profile-edit-modal__banner${bannerImageUrl ? " has-image" : ""}`}
          style={
            bannerImageUrl
              ? { "--profile-edit-banner": `url(${bannerImageUrl})` }
              : undefined
          }
        >
          <button
            type="button"
            className="profile-edit-modal__media-button profile-edit-modal__media-button--banner"
            onClick={onPickBanner}
            disabled={uploadingTarget === "banner_image_url"}
            aria-label="Ganti banner profile"
          >
            <img src={galleryAddIcon} alt="" />
            <span>
              {uploadingTarget === "banner_image_url" ? "Mengupload..." : "Ganti banner"}
            </span>
          </button>
        </section>

        <div className="profile-edit-modal__avatar-row">
          <div className="profile-edit-modal__avatar">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt={form.username || "Foto profile"} />
            ) : (
              <span>{getInitial(form.username || "U")}</span>
            )}
          </div>
          <button
            type="button"
            className="profile-edit-modal__media-button profile-edit-modal__media-button--avatar"
            onClick={onPickAvatar}
            disabled={uploadingTarget === "profile_image_url"}
            aria-label="Ganti foto profile"
          >
            <img src={galleryAddIcon} alt="" />
            <span>
              {uploadingTarget === "profile_image_url" ? "Mengupload..." : "Ganti foto"}
            </span>
          </button>
        </div>

        <label className="profile-edit-modal__field">
          Username
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={onChange}
          />
        </label>
      </form>
    </div>
  );
}

function CropImageModal({
  cropData,
  saving,
  onClose,
  onZoomChange,
  onPanChange,
  onStageSizeChange,
  onImageLoad,
  onUseImage,
}) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  if (!cropData) {
    return null;
  }

  const config = cropConfig[cropData.field] || cropConfig.profile_image_url;
  const isBanner = cropData.field === "banner_image_url";
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
    ? Math.max(stageSize.width / naturalSize.width, stageSize.height / naturalSize.height)
    : 1;
  const imageStyle = canCalculatePreview
    ? {
        width: `${naturalSize.width * baseScale}px`,
        height: `${naturalSize.height * baseScale}px`,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${cropData.zoom})`,
      }
    : {
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${cropData.zoom})`,
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
        y: fallbackLimit,
      };
    }

    const scale = Math.max(width / size.width, height / size.height) * cropData.zoom;
    const renderedWidth = size.width * scale;
    const renderedHeight = size.height * scale;

    return {
      x: Math.max(0, (renderedWidth - width) / 2),
      y: Math.max(0, (renderedHeight - height) / 2),
    };
  };

  const clampPan = (nextPan) => {
    const limit = getPanLimit();

    return {
      x: Math.min(Math.max(nextPan.x, -limit.x), limit.x),
      y: Math.min(Math.max(nextPan.y, -limit.y), limit.y),
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
      pan,
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
        height: event.currentTarget.naturalHeight,
      },
      stageSize: {
        width: rect?.width || 1,
        height: rect?.height || 1,
      },
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
        y: drag.pan.y + event.clientY - drag.startY,
      }),
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
    <div className="profile-crop-modal" role="presentation" onClick={onClose}>
      <section
        className={`profile-crop-modal__dialog${
          isBanner ? " profile-crop-modal__dialog--banner" : " profile-crop-modal__dialog--profile"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-crop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="profile-crop-modal__header">
          <h2 id="profile-crop-title">{config.title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup crop gambar">
            <FaTimes />
          </button>
        </header>

        <div
          ref={stageRef}
          className={`profile-crop-modal__stage${
            isBanner ? " profile-crop-modal__stage--banner" : " profile-crop-modal__stage--profile"
          }`}
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
          {!isBanner && <span className="profile-crop-modal__circle-mask" aria-hidden="true" />}
        </div>

        <div className="profile-crop-modal__zoom" aria-label="Zoom gambar">
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

        <footer className="profile-crop-modal__actions">
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

function EditReviewModal({
  open,
  review,
  form,
  saving,
  onClose,
  onChange,
  onRatingChange,
  onSubmit,
}) {
  if (!open || !review) {
    return null;
  }

  return (
    <div className="profile-edit-modal" role="presentation" onClick={onClose}>
      <form
        className="profile-edit-modal__dialog profile-review-modal__dialog"
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profile-edit-modal__header">
          <h2>Edit Review</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup edit review"
          >
            <FaTimes />
          </button>
        </div>

        <div className="profile-review-modal__movie">
          <img src={review.poster || fallbackPoster} alt="" />
          <div>
            <strong>{review.title}</strong>
            <span>{review.media_type === "tv" ? "TV Series" : "Film"}</span>
          </div>
        </div>

        <label>
          Rating
          <div className="profile-review-rating-input">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={star <= Number(form.rating) ? "is-active" : ""}
                onClick={() => onRatingChange(star)}
                aria-label={`Rating ${star}`}
              >
                <FaStar />
              </button>
            ))}
          </div>
        </label>

        <label>
          Isi Review
          <textarea
            name="content"
            value={form.content}
            onChange={onChange}
            rows={5}
            maxLength={500}
            placeholder="Tulis review kamu..."
          />
        </label>

        <div className="profile-modal-actions">
          <button
            type="button"
            className="profile-cancel-button"
            onClick={onClose}
          >
            Batal
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Review"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteReviewConfirmModal({ review, saving, onCancel, onConfirm }) {
  if (!review) {
    return null;
  }

  return (
    <div className="profile-edit-modal" role="presentation" onClick={onCancel}>
      <section
        className="profile-edit-modal__dialog profile-delete-modal__dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profile-edit-modal__header">
          <h2>Hapus Review?</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup konfirmasi hapus"
          >
            <FaTimes />
          </button>
        </div>

        <p>
          Review untuk <strong>{review.title}</strong> akan dihapus permanen.
        </p>

        <div className="profile-modal-actions">
          <button
            type="button"
            className="profile-cancel-button"
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            type="button"
            className="profile-danger-button"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const [profileSearchParams] = useSearchParams();
  const token = localStorage.getItem("token");
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const storedUser = useMemo(() => getStoredUser(), []);
  const [profile, setProfile] = useState(storedUser);
  const [activity, setActivity] = useState({
    stats: { review_count: 0, post_count: 0 },
    reviews: [],
    posts: [],
  });
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [reviewDetails, setReviewDetails] = useState({});
  const [activeTab, setActiveTab] = useState(() => {
    const tab = profileSearchParams.get("tab");
    return ["reviews", "posts", "friends"].includes(tab) ? tab : "reviews";
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState("");
  const [cropData, setCropData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [friendActionSaving, setFriendActionSaving] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchMessage, setFriendSearchMessage] = useState("");
  const [friendSearchSavingId, setFriendSearchSavingId] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [reviewForm, setReviewForm] = useState({
    content: "",
    rating: 5,
  });

  const userForStorage = profile || storedUser;
  const movieWatchlist = useMemo(
    () => readStoredWatchlist(userForStorage, "movie"),
    [userForStorage],
  );
  const seriesWatchlist = useMemo(
    () => readStoredWatchlist(userForStorage, "tv"),
    [userForStorage],
  );
  const watchStatus = useMemo(
    () => readWatchStatus(userForStorage),
    [userForStorage],
  );
  const moodHistory = useMemo(
    () => readMoodHistory(userForStorage),
    [userForStorage],
  );

  const watchlistItems = useMemo(
    () => [
      ...movieWatchlist.map((item) => normalizeWatchlistItem(item, "movie")),
      ...seriesWatchlist.map((item) => normalizeWatchlistItem(item, "tv")),
    ],
    [movieWatchlist, seriesWatchlist],
  );

  const watchedCount = watchlistItems.filter(
    (item) => watchStatus[getItemKey(item)],
  ).length;
  const unwatchedCount = watchlistItems.length - watchedCount;

  const visibleReviews = useMemo(
    () =>
      activity.reviews.map((review) => ({
        title:
          review.media_type === "tv"
            ? `TV Series #${review.tmdb_id}`
            : `Film #${review.tmdb_id}`,
        poster: fallbackPoster,
        genres: [],
        genre_ids: [],
        ...review,
        ...(reviewDetails[`${review.media_type}:${review.tmdb_id}`] || {}),
      })),
    [activity.reviews, reviewDetails],
  );

  const genreCounts = useMemo(() => {
    const counts = new Map();

    const addGenre = (genreName) => {
      if (!genreName) {
        return;
      }

      counts.set(genreName, (counts.get(genreName) || 0) + 1);
    };

    watchlistItems.forEach((item) => {
      (item.genre_ids || []).forEach((genreId) =>
        addGenre(getGenreName(genreId, item.mediaType)),
      );
    });

    visibleReviews.forEach((review) => {
      (review.genres || []).forEach(addGenre);
      (review.genre_ids || []).forEach((genreId) =>
        addGenre(getGenreName(genreId, review.media_type)),
      );
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 7);
  }, [visibleReviews, watchlistItems]);

  const favoriteGenres =
    genreCounts.length > 0
      ? genreCounts
      : [
          "Drama",
          "Thriller",
          "Animasi",
          "Komedi",
          "Adventure",
          "Fantasy",
          "Horror",
        ];

  const moodStats = useMemo(() => {
    const derivedCounts = Object.fromEntries(
      moodDefinitions.map((mood) => [mood.key, 0]),
    );

    watchlistItems.forEach((item) => {
      moodDefinitions.forEach((mood) => {
        if (
          (item.genre_ids || []).some((genreId) =>
            mood.genreIds.includes(Number(genreId)),
          )
        ) {
          derivedCounts[mood.key] += 1;
        }
      });
    });

    visibleReviews.forEach((review) => {
      moodDefinitions.forEach((mood) => {
        if (
          (review.genre_ids || []).some((genreId) =>
            mood.genreIds.includes(Number(genreId)),
          )
        ) {
          derivedCounts[mood.key] += 1;
        }
      });
    });

    const counts = moodDefinitions.map((mood) => ({
      ...mood,
      count: Number(moodHistory[mood.key] || 0) + derivedCounts[mood.key],
    }));
    const maxCount = Math.max(...counts.map((mood) => mood.count), 1);

    return counts.map((mood) => ({
      ...mood,
      percent: Math.max((mood.count / maxCount) * 100, mood.count > 0 ? 8 : 0),
    }));
  }, [moodHistory, visibleReviews, watchlistItems]);

  const initial = getInitial(profile?.username || storedUser?.username);
  const profileImageUrl = resolveMediaUrl(profile?.profile_image_url);
  const bannerImageUrl = resolveMediaUrl(profile?.banner_image_url);
  const getProfileUpgradeTarget = () => {
    const stored = getStoredUser() || {};

    if (hasPendingPayment(stored) || hasPendingPayment(profile)) {
      return "/payment";
    }

    return getUpgradeTargetPath(profile || stored);
  };

  const handleProfileUpgradeClick = async () => {
    const stored = getStoredUser() || {};

    if (pendingPayment || hasPendingPayment(stored) || hasPendingPayment(profile)) {
      navigate("/payment");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      navigate(getProfileUpgradeTarget());
      return;
    }

    try {
      const response = await axios.get(`${apiUrl}/api/payment/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const pendingPayment = response.data?.pendingPayment;

      if (response.data?.hasPendingPayment && pendingPayment) {
        setPendingPayment(pendingPayment);
        const nextUser = {
          ...stored,
          pending_payment_status: "pending",
          pending_payment_package_code: pendingPayment.packageCode,
          pending_payment_package_name: pendingPayment.packageName,
          pending_payment_duration_months: pendingPayment.durationMonths,
          pending_payment_total_amount: pendingPayment.totalAmount,
          pending_payment_created_at: pendingPayment.createdAt,
        };

        localStorage.setItem("user", JSON.stringify(nextUser));
        navigate("/payment");
        return;
      }
    } catch (error) {
      console.error("Gagal mengecek status pembayaran:", error);
    }

    navigate("/premium");
  };

  useEffect(
    () => () => {
      if (cropData?.previewUrl) {
        URL.revokeObjectURL(cropData.previewUrl);
      }
    },
    [cropData?.previewUrl],
  );

  useEffect(() => {
    const tab = profileSearchParams.get("tab");

    if (["reviews", "posts", "friends"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [profileSearchParams]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");
        const [
          profileResult,
          activityResult,
          friendsResult,
          friendRequestsResult,
          paymentResult,
        ] = await Promise.allSettled([
          axios.get(`${apiUrl}/api/profile/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${apiUrl}/api/profile/activity`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${apiUrl}/api/friends`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${apiUrl}/api/friends/requests`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${apiUrl}/api/payment/current`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (profileResult.status !== "fulfilled") {
          throw profileResult.reason;
        }

        const profileResponse = profileResult.value;
        const pendingPaymentData =
          paymentResult.status === "fulfilled" &&
          paymentResult.value.data?.hasPendingPayment
            ? paymentResult.value.data.pendingPayment
            : null;

        setPendingPayment(pendingPaymentData);
        setProfile(profileResponse.data);
        const currentStoredUser = getStoredUser() || {};
        const nextStoredUser = {
          ...currentStoredUser,
          ...profileResponse.data,
          role: profileResponse.data.role_name || currentStoredUser.role,
        };

        if (pendingPaymentData) {
          Object.assign(nextStoredUser, {
            pending_payment_status: "pending",
            pending_payment_package_code: pendingPaymentData.packageCode,
            pending_payment_package_name: pendingPaymentData.packageName,
            pending_payment_duration_months: pendingPaymentData.durationMonths,
            pending_payment_total_amount: pendingPaymentData.totalAmount,
            pending_payment_created_at: pendingPaymentData.createdAt,
          });
        } else {
          delete nextStoredUser.pending_payment_status;
          delete nextStoredUser.pending_payment_package_code;
          delete nextStoredUser.pending_payment_package_name;
          delete nextStoredUser.pending_payment_duration_months;
          delete nextStoredUser.pending_payment_total_amount;
          delete nextStoredUser.pending_payment_created_at;
        }

        localStorage.setItem(
          "user",
          JSON.stringify(nextStoredUser),
        );
        setForm({
          username: profileResponse.data.username || "",
          email: profileResponse.data.email || "",
          password: "",
        });
        setActivity(
          activityResult.status === "fulfilled"
            ? activityResult.value.data
            : { stats: {}, reviews: [], posts: [] },
        );
        setFriends(
          friendsResult.status === "fulfilled" ? friendsResult.value.data || [] : [],
        );
        setFriendRequests(
          friendRequestsResult.status === "fulfilled"
            ? friendRequestsResult.value.data || []
            : [],
        );
      } catch (error) {
        setErrorMessage(
          error.response?.data?.message || "Gagal mengambil profile",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [token]);

  useEffect(() => {
    const missingReviews = activity.reviews
      .slice(0, 12)
      .filter(
        (review) => !reviewDetails[`${review.media_type}:${review.tmdb_id}`],
      );

    if (missingReviews.length === 0) {
      return undefined;
    }

    let shouldIgnore = false;

    const loadReviewDetails = async () => {
      const entries = await Promise.all(
        missingReviews.map(async (review) => {
          const detailKey = `${review.media_type}:${review.tmdb_id}`;
          const endpoint = review.media_type === "tv" ? "tv-series" : "movies";

          try {
            const response = await axios.get(
              `${apiUrl}/api/${endpoint}/${review.tmdb_id}`,
              {
                params: { language: "id-ID" },
              },
            );
            const media = response.data;
            const title =
              media.title ||
              media.name ||
              media.original_title ||
              media.original_name ||
              "Untitled";

            return [
              detailKey,
              {
                title,
                poster: media.poster_url || fallbackPoster,
                genres: (media.genres || []).map((genre) => genre.name),
                genre_ids:
                  media.genre_ids ||
                  (media.genres || []).map((genre) => genre.id),
              },
            ];
          } catch {
            return [
              detailKey,
              {
                title:
                  review.media_type === "tv"
                    ? `TV Series #${review.tmdb_id}`
                    : `Film #${review.tmdb_id}`,
                poster: fallbackPoster,
                genres: [],
                genre_ids: [],
              },
            ];
          }
        }),
      );

      if (!shouldIgnore) {
        setReviewDetails((currentDetails) => ({
          ...currentDetails,
          ...Object.fromEntries(entries),
        }));
      }
    };

    loadReviewDetails();

    return () => {
      shouldIgnore = true;
    };
  }, [activity.reviews, reviewDetails]);

  useEffect(() => {
    const query = friendSearchQuery.trim();

    if (!token || activeTab !== "friends" || query.length < 2) {
      setFriendSearchResults([]);
      setFriendSearchLoading(false);
      setFriendSearchMessage("");
      return undefined;
    }

    if (!requirePremiumAccess()) {
      setFriendSearchResults([]);
      setFriendSearchLoading(false);
      setFriendSearchMessage("Fitur ini hanya tersedia untuk pengguna Premium atau Eksklusif.");
      return undefined;
    }

    let shouldIgnore = false;
    const timer = window.setTimeout(async () => {
      try {
        setFriendSearchLoading(true);
        setFriendSearchMessage("");
        const response = await axios.get(`${apiUrl}/api/friends/search`, {
          params: { query },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!shouldIgnore) {
          const results = response.data || [];
          setFriendSearchResults(results);
          setFriendSearchMessage(
            results.length === 0 ? "User tidak ditemukan." : "",
          );
        }
      } catch (error) {
        if (!shouldIgnore) {
          setFriendSearchResults([]);
          setFriendSearchMessage(
            error.response?.data?.message || "Gagal mencari teman",
          );
        }
      } finally {
        if (!shouldIgnore) {
          setFriendSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      shouldIgnore = true;
      window.clearTimeout(timer);
    };
  }, [activeTab, friendSearchQuery, token]);

  const handleFormChange = (event) => {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmitProfile = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const response = await axios.put(`${apiUrl}/api/profile/me`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const updatedUser = {
        ...(storedUser || {}),
        ...response.data.user,
        role: profile?.role_name || storedUser?.role,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setProfile((currentProfile) => ({
        ...currentProfile,
        ...response.data.user,
      }));
      setForm((currentForm) => ({ ...currentForm, password: "" }));
      setIsEditOpen(false);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal update profile");
    } finally {
      setSaving(false);
    }
  };

  const updateStoredUser = (nextUser) => {
    const currentUser = getStoredUser() || {};

    localStorage.setItem(
      "user",
      JSON.stringify({
        ...currentUser,
        ...nextUser,
        role: profile?.role_name || currentUser.role,
      }),
    );
  };

  const handleMediaUpload = async (event, field) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCropData((currentCropData) => {
      if (currentCropData?.previewUrl) {
        URL.revokeObjectURL(currentCropData.previewUrl);
      }

      return {
        field,
        file,
        previewUrl,
        naturalSize: null,
        pan: { x: 0, y: 0 },
        stageSize: { width: 1, height: 1 },
        zoom: 1,
      };
    });
  };

  const closeCropModal = () => {
    setCropData((currentCropData) => {
      if (currentCropData?.previewUrl) {
        URL.revokeObjectURL(currentCropData.previewUrl);
      }

      return null;
    });
  };

  const handleUseCroppedImage = async () => {
    if (!cropData) {
      return;
    }

    const config = cropConfig[cropData.field] || cropConfig.profile_image_url;

    try {
      setUploadingTarget(cropData.field);
      setErrorMessage("");

      const croppedBlob = await cropImageToBlob({
        source: cropData.previewUrl,
        zoom: cropData.zoom,
        pan: cropData.pan,
        stageSize: cropData.stageSize,
        outputWidth: config.outputWidth,
        outputHeight: config.outputHeight,
        type: "image/jpeg",
      });
      const imageDataUrl = await blobToDataUrl(croppedBlob);

      const mediaResponse = await axios.put(
        `${apiUrl}/api/profile/media`,
        {
          field: cropData.field,
          image_url: imageDataUrl,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setProfile((currentProfile) => ({
        ...currentProfile,
        ...mediaResponse.data.user,
      }));
      updateStoredUser(mediaResponse.data.user);
      closeCropModal();
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          (cropData.field === "profile_image_url"
            ? "Gagal upload foto profile"
            : "Gagal upload banner profile"),
      );
    } finally {
      setUploadingTarget("");
    }
  };

  const handleOpenEditReview = (review) => {
    setEditingReview(review);
    setReviewForm({
      content: review.content || "",
      rating: Number(review.rating || 5),
    });
    setErrorMessage("");
  };

  const handleReviewFormChange = (event) => {
    setReviewForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmitReviewEdit = async (event) => {
    event.preventDefault();

    if (!editingReview) {
      return;
    }

    if (!reviewForm.content.trim()) {
      setErrorMessage("Isi review tidak boleh kosong");
      return;
    }

    try {
      setReviewSaving(true);
      setErrorMessage("");

      const response = await axios.put(
        getReviewApiUrl(editingReview),
        {
          content: reviewForm.content,
          rating: reviewForm.rating,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const updatedReview = response.data.review;
      const editingReviewKey = getReviewKey(editingReview);

      setActivity((currentActivity) => ({
        ...currentActivity,
        reviews: currentActivity.reviews.map((review) =>
          getReviewKey(review) === editingReviewKey
            ? {
                ...review,
                content: updatedReview.content,
                rating: updatedReview.rating,
                updated_at: updatedReview.updated_at,
              }
            : review,
        ),
      }));

      setEditingReview(null);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal mengubah review");
    } finally {
      setReviewSaving(false);
    }
  };

  const handleConfirmDeleteReview = async () => {
    if (!reviewToDelete) {
      return;
    }

    try {
      setReviewSaving(true);
      setErrorMessage("");

      await axios.delete(getReviewApiUrl(reviewToDelete), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const deletedReviewKey = getReviewKey(reviewToDelete);
      const mediaStatKey =
        reviewToDelete.media_type === "tv"
          ? "tv_review_count"
          : "movie_review_count";

      setActivity((currentActivity) => ({
        ...currentActivity,
        stats: {
          ...currentActivity.stats,
          review_count: Math.max(
            0,
            Number(
              currentActivity.stats?.review_count ||
                currentActivity.reviews.length,
            ) - 1,
          ),
          [mediaStatKey]: Math.max(
            0,
            Number(currentActivity.stats?.[mediaStatKey] || 0) - 1,
          ),
        },
        reviews: currentActivity.reviews.filter(
          (review) => getReviewKey(review) !== deletedReviewKey,
        ),
      }));

      setReviewToDelete(null);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Gagal menghapus review",
      );
    } finally {
      setReviewSaving(false);
    }
  };

  const handleAcceptFriendRequest = async (request) => {
    if (!requirePremiumAccess()) {
      return;
    }

    try {
      setFriendActionSaving(true);
      const response = await axios.put(
        `${apiUrl}/api/friends/requests/${request.id_friend}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setFriendRequests((currentRequests) =>
        currentRequests.filter((item) => item.id_friend !== request.id_friend),
      );
      setFriends((currentFriends) => [response.data.friend, ...currentFriends]);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Gagal menerima pertemanan",
      );
    } finally {
      setFriendActionSaving(false);
    }
  };

  const handleDeclineFriendRequest = async (request) => {
    if (!requirePremiumAccess()) {
      return;
    }

    try {
      setFriendActionSaving(true);
      await axios.delete(
        `${apiUrl}/api/friends/requests/${request.id_friend}/decline`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setFriendRequests((currentRequests) =>
        currentRequests.filter((item) => item.id_friend !== request.id_friend),
      );
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Gagal menolak pertemanan",
      );
    } finally {
      setFriendActionSaving(false);
    }
  };

  const handleAddFriendFromSearch = async (user) => {
    if (!requirePremiumAccess()) {
      return;
    }

    if (!user?.id_user) {
      return;
    }

    try {
      setFriendSearchSavingId(user.id_user);
      setFriendSearchMessage("");
      const response = await axios.post(
        `${apiUrl}/api/friends/${user.id_user}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const nextStatus = response.data?.status || "pending_sent";
      setFriendSearchResults((currentResults) =>
        currentResults.map((result) =>
          Number(result.id_user) === Number(user.id_user)
            ? { ...result, friendship_status: nextStatus }
            : result,
        ),
      );
      setFriendSearchMessage(
        response.data?.message || "Permintaan pertemanan dikirim.",
      );
    } catch (error) {
      setFriendSearchMessage(
        error.response?.data?.message || "Gagal menambahkan teman",
      );
    } finally {
      setFriendSearchSavingId(null);
    }
  };

  const handleMessageFriend = (friend) => {
    if (!requirePremiumAccess()) {
      return;
    }

    openChatThread(
      createChatThreadFromUser({
        id_user: friend.id_user,
        username: friend.username,
        email: friend.email,
        profile_image_url: friend.profile_image_url,
        is_premium: friend.is_premium,
        subscription_plan: friend.subscription_plan,
        lastMessage: "Mulai obrolan tentang film",
      }),
    );
  };

  const handleRemoveFriend = async (friend) => {
    if (!requirePremiumAccess()) {
      return;
    }

    const shouldRemove = await confirmAction({
      title: "Hapus Teman?",
      text: `Hapus ${friend.username || "teman ini"} dari friendlist?`,
      icon: "warning",
      confirmButtonText: "Hapus",
    });

    if (!shouldRemove) {
      return;
    }

    try {
      setFriendActionSaving(true);
      await axios.delete(`${apiUrl}/api/friends/${friend.id_user}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setFriends((currentFriends) =>
        currentFriends.filter(
          (item) => Number(item.id_user) !== Number(friend.id_user),
        ),
      );
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal menghapus teman");
    } finally {
      setFriendActionSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="profile-page profile-page--state">
        <SiteNavbar mode="fixed" />
        <p>Loading profile...</p>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <SiteNavbar mode="fixed" />

      <section
        className="profile-banner"
        style={
          bannerImageUrl
            ? { "--profile-banner-image": `url(${bannerImageUrl})` }
            : undefined
        }
      >
        <input
          ref={bannerInputRef}
          className="profile-media-input"
          type="file"
          accept="image/jpeg,image/png,image/jpg,image/webp"
          onChange={(event) => handleMediaUpload(event, "banner_image_url")}
        />
        <button
          type="button"
          className="profile-banner__edit"
          onClick={() => bannerInputRef.current?.click()}
          disabled={uploadingTarget === "banner_image_url"}
        >
          <FaEdit />
          {uploadingTarget === "banner_image_url"
            ? "Mengupload..."
            : "Edit Banner"}
        </button>
      </section>

      <section className="profile-header">
        <div className="profile-avatar-wrap">
          <input
            ref={avatarInputRef}
            className="profile-media-input"
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp"
            onChange={(event) => handleMediaUpload(event, "profile_image_url")}
          />
          <PremiumAvatar
            className="profile-avatar"
            imageUrl={profileImageUrl}
            name={profile?.username || initial}
            isPremium={Boolean(profile?.is_premium)}
            subscriptionPlan={profile?.subscription_plan}
            alt={profile?.username || "Foto profile"}
          />
          <button
            type="button"
            aria-label="Edit avatar"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingTarget === "profile_image_url"}
          >
            <FaEdit />
          </button>
        </div>

        <div className="profile-identity">
          <h1>{profile?.username || "User FLIX"}</h1>
          <p>{profile?.email || "-"}</p>
          <div className="profile-join-row">
            <FaCalendarAlt />
            <span>{formatJoinDate(profile?.created_at)}</span>

            {["premium", "exclusive"].includes(normalizeSubscriptionPlan(profile)) ? (
              <button
                type="button"
                className="profile-premium-badge"
                onClick={() => setIsSubscriptionOpen(true)}
              >
                <img src={diamondIcon} alt="" />
                {normalizeSubscriptionPlan(profile) === "exclusive" ? "Eksklusif" : "Premium"}
              </button>
            ) : (
              <button
                type="button"
                className="profile-upgrade-btn"
                onClick={handleProfileUpgradeClick}
              >
                💎 Upgrade Premium
              </button>
            )}
          </div>
        </div>

        <button
          className="profile-edit-button"
          type="button"
          onClick={() => setIsEditOpen(true)}
        >
          Edit Profil
        </button>
      </section>

      {isSubscriptionOpen && (
        <div
          className="profile-subscription-modal"
          role="presentation"
          onClick={() => setIsSubscriptionOpen(false)}
        >
          <section
            className="profile-subscription-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-subscription-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="profile-subscription-modal__close"
              onClick={() => setIsSubscriptionOpen(false)}
              aria-label="Tutup detail langganan"
            >
              <FaTimes />
            </button>

            <div className="profile-subscription-modal__badge" aria-hidden="true">
              <img src={diamondIcon} alt="" />
            </div>

            <div className="profile-subscription-modal__head">
              <span>Langganan aktif</span>
              <h2 id="profile-subscription-title">
                {normalizeSubscriptionPlan(profile) === "exclusive"
                  ? "FLIX Eksklusif"
                  : "FLIX Premium"}
              </h2>
              <p>
                {normalizeSubscriptionPlan(profile) === "exclusive"
                  ? "Semua fitur Premium aktif, termasuk Chatbot FLIX."
                  : "Watchlist unlimited, Community, chat, friendlist, dan bebas iklan aktif."}
              </p>
            </div>

            <div className="profile-subscription-modal__details">
              <div>
                <span>Paket</span>
                <strong>
                  {profile?.current_package_name ||
                    (normalizeSubscriptionPlan(profile) === "exclusive"
                      ? "Eksklusif"
                      : "Premium Bulanan")}
                </strong>
              </div>
              <div>
                <span>Status</span>
                <strong>Aktif</strong>
              </div>
              <div>
                <span>Mulai</span>
                <strong>{formatDate(profile?.premium_started_at)}</strong>
              </div>
              <div>
                <span>Berakhir</span>
                <strong>{formatDate(profile?.premium_expired_at)}</strong>
              </div>
            </div>

            <button
              type="button"
              className="profile-subscription-modal__action"
              onClick={() => {
                setIsSubscriptionOpen(false);
                navigate("/premium");
              }}
            >
              Lihat Paket
            </button>
          </section>
        </div>
      )}

      <section className="profile-stats" aria-label="Statistik profil">
        <ProfileStatCard
          value={watchlistItems.length}
          label="Film Tersimpan"
          icon={<FaBookmark />}
        />
        <ProfileStatCard
          value={activity.stats?.review_count || visibleReviews.length}
          label="Review Film"
          icon={<FaRegCommentDots />}
        />
        <ProfileStatCard
          value={watchedCount}
          label="Sudah Ditonton"
          icon={<FaCheck />}
        />
        <ProfileStatCard
          value={unwatchedCount}
          label="Belum Ditonton"
          icon={<FaClock />}
        />
      </section>

      <div className="profile-divider" aria-hidden="true" />

      {errorMessage && <p className="profile-error">{errorMessage}</p>}

      <section className="profile-content">
        <div className="profile-main-column">
          {(() => {
            const profileTabs = [
              {
                key: "reviews",
                label: "Review Saya",
                count: activity.stats?.review_count || visibleReviews.length,
              },
              {
                key: "posts",
                label: "Postingan Saya",
                count: activity.stats?.post_count || activity.posts.length,
              },
              {
                key: "friends",
                label: "Friendlist",
                count: friends.length + friendRequests.length,
              },
            ];

            return (
              <div className="profile-tabs">
                <div
                  className="profile-tabs__list"
                  role="tablist"
                  aria-label="Menu profil"
                >
                  {profileTabs.map((tab) => (
                    <button
                      className={activeTab === tab.key ? "is-active" : ""}
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.key}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                      <span>{tab.count}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="profile-tabs__watchlist"
                  type="button"
                  onClick={() => navigate("/watchlist")}
                >
                  Lihat Watchlist
                </button>
              </div>
            );
          })()}

          {activeTab === "reviews" ? (
            <div className="profile-review-list">
              {visibleReviews.length > 0 ? (
                visibleReviews.map((review) => (
                  <ProfileReviewItem
                    key={`${review.media_type}-${review.id_review}`}
                    item={review}
                    disabled={reviewSaving}
                    onEdit={handleOpenEditReview}
                    onDelete={setReviewToDelete}
                  />
                ))
              ) : (
                <div className="profile-empty-state">
                  <h2>Belum ada review</h2>
                  <p>Review film atau series akan muncul di halaman ini.</p>
                  <Link to="/movies">Cari Film</Link>
                </div>
              )}
            </div>
          ) : activeTab === "posts" ? (
            <div className="profile-post-list">
              {activity.posts.length > 0 ? (
                activity.posts.map((post) => (
                  <ProfilePostItem key={post.id_post} post={post} />
                ))
              ) : (
                <div className="profile-empty-state">
                  <h2>Belum ada postingan</h2>
                  <p>Postingan community kamu akan muncul di sini.</p>
                  <Link to="/create-post">Buat Post</Link>
                </div>
              )}
            </div>
          ) : (
            <div className="profile-friend-list">
              <section className="profile-friend-search">
                <div className="profile-friend-section-header">
                  <h2>Cari Teman Baru</h2>
                </div>

                <label className="profile-friend-search-bar">
                  <FaSearch aria-hidden="true" />
                  <input
                    type="search"
                    value={friendSearchQuery}
                    onChange={(event) =>
                      setFriendSearchQuery(event.target.value)
                    }
                    placeholder="Cari nama atau email teman..."
                  />
                </label>

                {(friendSearchQuery.trim().length >= 2 ||
                  friendSearchResults.length > 0 ||
                  friendSearchLoading ||
                  friendSearchMessage) && (
                  <div className="profile-friend-search-panel">
                    {friendSearchLoading ? (
                      <p className="profile-friend-muted">Mencari teman...</p>
                    ) : friendSearchResults.length > 0 ? (
                      friendSearchResults.map((user) => (
                        <ProfileFriendSearchResult
                          key={user.id_user}
                          user={user}
                          disabled={friendSearchSavingId === user.id_user}
                          onAdd={handleAddFriendFromSearch}
                        />
                      ))
                    ) : (
                      friendSearchMessage && (
                        <p className="profile-friend-muted">
                          {friendSearchMessage}
                        </p>
                      )
                    )}
                    {friendSearchMessage && friendSearchResults.length > 0 && (
                      <p className="profile-friend-search-message">
                        {friendSearchMessage}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {friendRequests.length > 0 && (
                <section className="profile-friend-requests">
                  <div className="profile-friend-section-header">
                    <h2>Permintaan Pertemanan</h2>
                    <span>{friendRequests.length}</span>
                  </div>

                  {friendRequests.map((request) => (
                    <ProfileFriendRequestItem
                      key={request.id_friend}
                      request={request}
                      disabled={friendActionSaving}
                      onAccept={handleAcceptFriendRequest}
                      onDecline={handleDeclineFriendRequest}
                    />
                  ))}
                </section>
              )}

              <section className="profile-friends-section">
                <div className="profile-friend-section-header">
                  <h2>Teman</h2>
                  <span>{friends.length}</span>
                </div>

                {friends.length > 0 ? (
                  friends.map((friend) => (
                    <ProfileFriendItem
                      key={friend.id_user}
                      friend={friend}
                      disabled={friendActionSaving}
                      onMessage={handleMessageFriend}
                      onRemove={handleRemoveFriend}
                    />
                  ))
                ) : (
                  <div className="profile-empty-state">
                    <h2>Belum ada teman</h2>
                    <p>
                      Tambahkan teman dari Community untuk mulai ngobrol tentang
                      film.
                    </p>
                    <Link to="/community">Cari Teman</Link>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <aside className="profile-side-column">
          <section className="profile-side-card">
            <h2>Riwayat Mood</h2>
            <div className="profile-mood-list">
              {moodStats.map((mood) => (
                <div className="profile-mood-item" key={mood.key}>
                  <div>
                    <span>
                      <img src={mood.icon} alt="" />
                      {mood.label}
                    </span>
                    <small>{mood.count}x</small>
                  </div>
                  <div className="profile-mood-track">
                    <span style={{ width: `${mood.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-side-card">
            <h2>Genre Favorit</h2>
            <div className="profile-genre-list">
              {favoriteGenres.map((genre, index) => (
                <span
                  className={index === 0 || index === 5 ? "is-active" : ""}
                  key={genre}
                >
                  {genre}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <footer className="profile-footer">
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

      <EditProfileModal
        open={isEditOpen}
        form={form}
        saving={saving}
        profileImageUrl={profileImageUrl}
        bannerImageUrl={bannerImageUrl}
        uploadingTarget={uploadingTarget}
        onClose={() => setIsEditOpen(false)}
        onChange={handleFormChange}
        onSubmit={handleSubmitProfile}
        onPickAvatar={() => avatarInputRef.current?.click()}
        onPickBanner={() => bannerInputRef.current?.click()}
      />

      <CropImageModal
        cropData={cropData}
        saving={Boolean(uploadingTarget)}
        onClose={closeCropModal}
        onZoomChange={(zoom) =>
          setCropData((currentCropData) =>
            currentCropData ? { ...currentCropData, zoom } : currentCropData,
          )
        }
        onPanChange={(pan) =>
          setCropData((currentCropData) =>
            currentCropData ? { ...currentCropData, pan } : currentCropData,
          )
        }
        onStageSizeChange={(stageSize) =>
          setCropData((currentCropData) =>
            currentCropData ? { ...currentCropData, stageSize } : currentCropData,
          )
        }
        onImageLoad={({ naturalSize, stageSize }) =>
          setCropData((currentCropData) =>
            currentCropData
              ? {
                  ...currentCropData,
                  naturalSize,
                  stageSize,
                  pan: { x: 0, y: 0 },
                  zoom: 1,
                }
              : currentCropData,
          )
        }
        onUseImage={handleUseCroppedImage}
      />

      <EditReviewModal
        open={Boolean(editingReview)}
        review={editingReview}
        form={reviewForm}
        saving={reviewSaving}
        onClose={() => setEditingReview(null)}
        onChange={handleReviewFormChange}
        onRatingChange={(rating) =>
          setReviewForm((currentForm) => ({ ...currentForm, rating }))
        }
        onSubmit={handleSubmitReviewEdit}
      />

      <DeleteReviewConfirmModal
        review={reviewToDelete}
        saving={reviewSaving}
        onCancel={() => setReviewToDelete(null)}
        onConfirm={handleConfirmDeleteReview}
      />
    </main>
  );
}

export default ProfilePage;
