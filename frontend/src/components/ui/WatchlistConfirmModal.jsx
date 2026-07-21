import "./WatchlistConfirmModal.css";

function WatchlistConfirmModal({ open, item, mediaLabel = "Film", onCancel, onConfirm }) {
  if (!open || !item) {
    return null;
  }

  return (
    <div className="watchlist-confirm" role="presentation" onClick={onCancel}>
      <div
        className="watchlist-confirm__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="watchlist-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        {item.poster && (
          <img
            className="watchlist-confirm__poster"
            src={item.poster}
            alt={item.title}
          />
        )}

        <div className="watchlist-confirm__content">
          <h2 id="watchlist-confirm-title">
            Simpan {mediaLabel} <strong>{item.title}</strong> di Watchlist kamu?
          </h2>

          <div className="watchlist-confirm__actions">
            <button
              className="watchlist-confirm__cancel"
              type="button"
              onClick={onCancel}
            >
              Batal
            </button>
            <button
              className="watchlist-confirm__save"
              type="button"
              onClick={onConfirm}
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WatchlistConfirmModal;
