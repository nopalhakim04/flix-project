import PremiumAvatar from "@/components/ui/PremiumAvatar";
import "./AddFriendConfirmModal.css";

function AddFriendConfirmModal({ open, user, saving, onCancel, onConfirm }) {
  if (!open || !user) {
    return null;
  }

  return (
    <div className="add-friend-modal" role="presentation" onClick={onCancel}>
      <div
        className="add-friend-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-friend-title"
        onClick={(event) => event.stopPropagation()}
      >
        <PremiumAvatar
          className="add-friend-modal__avatar"
          imageUrl={user.profile_image_url}
          name={user.username || "F"}
          isPremium={Boolean(user.is_premium)}
          alt={user.username || "User FLIX"}
        />

        <div className="add-friend-modal__content">
          <h2 id="add-friend-title">
            Tambahkan <strong>{user.username || "User FLIX"}</strong> sebagai teman?
          </h2>
          <p>Permintaan pertemanan akan dikirim ke profile user ini.</p>

          <div className="add-friend-modal__actions">
            <button type="button" onClick={onCancel} disabled={saving}>
              Batal
            </button>
            <button type="button" onClick={onConfirm} disabled={saving}>
              {saving ? "Mengirim..." : "Tambah"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddFriendConfirmModal;
