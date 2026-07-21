import { useEffect, useState } from "react";
import { FaRegStar, FaStar } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import "./ReviewModal.css";

const moodOptions = [
  "Santai",
  "Seru",
  "Sedih",
  "Romantis",
  "Pikiran Tertantang",
  "Menegangkan",
];

function ReviewModal({
  open,
  mediaLabel = "Film",
  itemTitle,
  itemPoster,
  itemYear,
  itemGenres = [],
  rating,
  content,
  placeholder,
  onRatingChange,
  onContentChange,
  onClose,
  onSubmit,
}) {
  const [selectedMood, setSelectedMood] = useState(moodOptions[0]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="review-modal" role="presentation" onClick={onClose}>
      <form
        className="review-modal__dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="review-modal__header">
          <h2 id="review-modal-title">Review {mediaLabel}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup review">
            <FiX />
          </button>
        </div>

        <div className="review-modal__divider" />

        <div className="review-modal__media">
          <img
            src={itemPoster || "https://placehold.co/140x196/242424/ffffff?text=FLIX"}
            alt={itemTitle || mediaLabel}
          />
          <div>
            <h3>{itemTitle}</h3>
            <p>
              <span>{itemYear || "-"}</span>
              {itemGenres.length > 0 && (
                <>
                  <span className="review-modal__separator" />
                  <span>{itemGenres.slice(0, 2).join(", ")}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="review-modal__divider" />

        <div className="review-modal__field">
          <h4>Rating Kamu</h4>
          <div className="review-modal__rating">
            <div className="review-modal__stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  className={star <= rating ? "is-active" : ""}
                  key={star}
                  type="button"
                  onClick={() => onRatingChange(star)}
                  aria-label={`Beri rating ${star}`}
                >
                  {star <= rating ? <FaStar /> : <FaRegStar />}
                </button>
              ))}
            </div>
            <strong>{Number(rating || 0).toFixed(1)}</strong>
          </div>
        </div>

        <div className="review-modal__divider" />

        <label className="review-modal__field">
          <h4>Review</h4>
          <textarea
            maxLength={500}
            placeholder={placeholder}
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            required
          />
          <span>{content.length}/500 karakter</span>
        </label>

        <div className="review-modal__divider" />

        <div className="review-modal__field">
          <h4>Mood saat Nonton</h4>
          <div className="review-modal__moods">
            {moodOptions.map((mood) => (
              <button
                className={selectedMood === mood ? "is-active" : ""}
                key={mood}
                type="button"
                onClick={() => setSelectedMood(mood)}
              >
                {mood}
              </button>
            ))}
          </div>
        </div>

        <button className="review-modal__submit" type="submit">
          Submit Review
        </button>
      </form>
    </div>
  );
}

export default ReviewModal;
