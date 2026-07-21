import { useEffect, useRef, useState } from "react";
import { FiFlag, FiMessageCircle, FiUserPlus } from "react-icons/fi";

function CommunityUserPopover({
  user,
  currentUser,
  isFriend = false,
  friendshipStatus = null,
  onAddFriend,
  onMessage,
  onReportUser,
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const isSelf =
    currentUser?.id_user && Number(currentUser.id_user) === Number(user?.id_user);
  const isPendingSent = friendshipStatus === "pending_sent";
  const isPendingReceived = friendshipStatus === "pending_received";

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  if (!user?.id_user) {
    return <span>{user?.username || "User FLIX"}</span>;
  }

  const handleTrigger = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen((current) => !current);
  };

  const handleAction = (event, action) => {
    event.preventDefault();
    event.stopPropagation();
    action?.();
    setOpen(false);
  };

  return (
    <span className="community-user-popover" ref={popoverRef}>
      <button
        className="community-user-popover__trigger"
        type="button"
        onClick={handleTrigger}
      >
        {user.username || "User FLIX"}
      </button>

      {open && (
        <span className="community-user-popover__menu">
          <strong>{user.username || "User FLIX"}</strong>

          {isSelf ? (
            <span className="community-user-popover__note">Ini akun kamu</span>
          ) : (
            <>
              {isFriend || friendshipStatus === "accepted" ? (
                <button type="button" onClick={(event) => handleAction(event, onMessage)}>
                  <FiMessageCircle />
                  Message
                </button>
              ) : isPendingSent || isPendingReceived ? (
                <button type="button" disabled>
                  <FiUserPlus />
                  {isPendingReceived ? "Cek di Profil" : "Pending"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(event) => handleAction(event, onAddFriend)}
                >
                  <FiUserPlus />
                  Add Friend
                </button>
              )}

              <button
                className="community-user-popover__report"
                type="button"
                onClick={(event) => handleAction(event, onReportUser)}
              >
                <FiFlag />
                Report User
              </button>
            </>
          )}
        </span>
      )}
    </span>
  );
}

export default CommunityUserPopover;
