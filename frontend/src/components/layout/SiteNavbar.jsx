import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { FiMaximize2, FiMinimize2 } from "react-icons/fi";
import flixLogo from "@/assets/flix-logo.png";
import arrowLeftIcon from "@/assets/icon/arrow-left-icon.svg";
import searchIcon from "@/assets/icon/search-icon.png";
import chatIcon from "@/assets/icon/chat-icon.png";
import notificationIcon from "@/assets/icon/notification-icon.png";
import profileIcon from "@/assets/icon/profile-icon.png";
import myWatchlistIcon from "@/assets/icon/mywatchlist-icon.png";
import communityIcon from "@/assets/icon/community-icon.png";
import settingIcon from "@/assets/icon/setting-icon.png";
import adminIcon from "@/assets/icon/admin-icon.png";
import logoutIcon from "@/assets/icon/logout-icon.png";
import messageCircleIcon from "@/assets/icon/message-circle-icon.svg";
import sendIcon from "@/assets/icon/send-icon.svg";
import smileIcon from "@/assets/icon/smile-icon.svg";
import blueDiamondIcon from "@/assets/icon/bluediamond-icon.png";
import PremiumAvatar from "@/components/ui/PremiumAvatar";
import SearchModal from "@/components/ui/SearchModal";
import { requireLogin, requirePremiumAccess } from "@/utils/authPrompt";
import { resolveMediaUrl } from "@/utils/media";
import "./SiteNavbar.css";

const navItems = [
  { key: "home", label: "Home", to: "/" },
  { key: "movies", label: "Movie", to: "/movies" },
  { key: "tv", label: "TV Series", to: "/tv-series" },
  { key: "genre", label: "Genre", to: "/genre" },
  { key: "community", label: "Community", to: "/community" },
];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

const getActiveKey = (pathname, activeKey) => {
  if (activeKey) return activeKey;
  if (pathname === "/") return "home";
  if (pathname.startsWith("/genre")) return "genre";
  if (pathname.startsWith("/tv-series")) return "tv";
  if (pathname.startsWith("/movie") || pathname.startsWith("/movies")) return "movies";
  if (pathname.startsWith("/community") || pathname.startsWith("/post")) return "community";
  if (pathname.startsWith("/watchlist")) return "";
  return "";
};

const getNotificationCopy = (notification) => {
  const actor = notification.actor_username || "Seseorang";
  const type = notification.notification_type;

  const actionText = {
    post_like: "Menyukai Post Anda",
    post_reaction: "Memberi Reaction ke Post Anda",
    post_share: "Membagikan Post Anda",
    post_comment: "Mengomentari Post Anda",
    comment_reply: "Membalas Komentar Anda",
    poll_vote: "Vote Polling Anda",
    friend_request: "Mengirim Permintaan Pertemanan",
  }[type] || "Berinteraksi dengan Anda";

  return { actor, actionText };
};

const formatNotificationTime = (dateValue) => {
  const timestamp = new Date(dateValue).getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} d ago`;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(new Date(dateValue));
};

const formatChatTime = (dateValue) => {
  if (!dateValue) return "Baru";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Baru";
  }

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
};

const normalizeConversation = (conversation) => {
  const friend = conversation.friend || {};
  const conversationId = conversation.id_conversation || conversation.conversationId;
  const lastMessageAt = conversation.last_message_at || conversation.updated_at;

  return {
    id: `conversation-${conversationId}`,
    conversationId,
    userId: friend.id_user || conversation.userId,
    name: friend.username || friend.email || conversation.name || "User FLIX",
    lastMessage: conversation.last_message || conversation.lastMessage || "Belum ada pesan",
    time: formatChatTime(lastMessageAt),
    lastMessageAt,
    unreadCount: Number(conversation.unread_count || conversation.unreadCount || 0),
    isOnline: Boolean(conversation.isOnline),
    avatarUrl:
      resolveMediaUrl(friend.profile_image_url) ||
      conversation.avatarUrl ||
      "",
    isPremium: Boolean(friend.is_premium || conversation.isPremium),
  };
};

function SiteNavbar({ mode = "absolute", activeKey }) {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  const chatRef = useRef(null);
  const notificationRef = useRef(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatThreads, setChatThreads] = useState([]);
  const [activeChatThread, setActiveChatThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingChatMessages, setIsLoadingChatMessages] = useState(false);
  const [isSendingChatMessage, setIsSendingChatMessage] = useState(false);
  const [showChatEmojiPicker, setShowChatEmojiPicker] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [chatError, setChatError] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const currentActiveKey = getActiveKey(location.pathname, activeKey);
  const userProfileImageUrl = resolveMediaUrl(user?.profile_image_url);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
    window.location.reload();
  };

  const handleSearch = () => {
    setShowSearchModal(true);
  };

  const fetchChatThreads = useCallback(async () => {
    if (!token) {
      setChatThreads([]);
      return [];
    }

    try {
      setIsLoadingChats(true);
      setChatError("");

      const response = await fetch(`${API_URL}/api/chats/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal mengambil chat");
      }

      const data = await response.json();
      const nextThreads = Array.isArray(data)
        ? data.map(normalizeConversation)
        : [];

      setChatThreads(nextThreads);
      return nextThreads;
    } catch (error) {
      setChatError(error.message || "Gagal mengambil chat");
      setChatThreads([]);
      return [];
    } finally {
      setIsLoadingChats(false);
    }
  }, [token]);

  const fetchChatMessages = useCallback(
    async (conversationId) => {
      if (!token || !conversationId) {
        setChatMessages([]);
        return;
      }

      try {
        setIsLoadingChatMessages(true);
        setChatError("");

        const response = await fetch(
          `${API_URL}/api/chats/conversations/${conversationId}/messages`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Gagal mengambil pesan");
        }

        const data = await response.json();
        setChatMessages(data.messages || []);
        setChatThreads((currentThreads) =>
          currentThreads.map((thread) =>
            Number(thread.conversationId) === Number(conversationId)
              ? { ...thread, unreadCount: 0 }
              : thread,
          ),
        );
      } catch (error) {
        setChatError(error.message || "Gagal mengambil pesan");
        setChatMessages([]);
      } finally {
        setIsLoadingChatMessages(false);
      }
    },
    [token],
  );

  const startChatWithUser = useCallback(
    async (thread) => {
      if (!requirePremiumAccess()) {
        return null;
      }

      const targetUserId = thread?.userId || thread?.id_user;

      if (!targetUserId) {
        return null;
      }

      try {
        setChatError("");
        const response = await fetch(
          `${API_URL}/api/chats/conversations/${targetUserId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Gagal membuka chat");
        }

        const data = await response.json();
        const nextThread = normalizeConversation(data);

        setChatThreads((currentThreads) => [
          nextThread,
          ...currentThreads.filter(
            (item) =>
              String(item.conversationId) !== String(nextThread.conversationId),
          ),
        ]);
        setActiveChatThread(nextThread);
        setShowChatPanel(true);
        await fetchChatMessages(nextThread.conversationId);

        return nextThread;
      } catch (error) {
        setChatError(error.message || "Gagal membuka chat");
        setShowChatPanel(true);
        return null;
      }
    },
    [fetchChatMessages, navigate, token],
  );

  const handleToggleChat = () => {
    if (!requirePremiumAccess()) {
      return;
    }

    setShowChatPanel((currentValue) => {
      const nextValue = !currentValue;

      if (nextValue) {
        fetchChatThreads();
        setActiveChatThread(null);
        setChatMessages([]);
      }

      return nextValue;
    });
    setShowNotifications(false);
  };

  const handleFindFriends = () => {
    setShowChatPanel(false);
    setActiveChatThread(null);
    navigate("/community");
  };

  const handleOpenChatThread = (thread) => {
    if (!thread.conversationId && thread.userId) {
      startChatWithUser(thread);
      return;
    }

    setActiveChatThread(thread);
    setShowChatEmojiPicker(false);
    fetchChatMessages(thread.conversationId);
  };

  const handleCloseChatPanel = () => {
    setShowChatPanel(false);
    setActiveChatThread(null);
    setChatMessage("");
    setChatMessages([]);
    setShowChatEmojiPicker(false);
    setIsChatExpanded(false);
    setChatError("");
  };

  const handleSendChatMessage = async () => {
    const content = chatMessage.trim();

    if (!content || !activeChatThread?.conversationId || isSendingChatMessage) {
      return;
    }

    try {
      setIsSendingChatMessage(true);
      setChatError("");

      const response = await fetch(
        `${API_URL}/api/chats/conversations/${activeChatThread.conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal mengirim pesan");
      }

      const data = await response.json();
      const sentMessage = data.message;
      const sentAt = sentMessage?.created_at || new Date().toISOString();

      setChatMessages((currentMessages) => [
        ...currentMessages,
        {
          ...sentMessage,
          sender_username: user?.username,
          sender_profile_image_url: user?.profile_image_url,
          sender_is_premium: user?.is_premium,
        },
      ]);
      setChatMessage("");
      setActiveChatThread((currentThread) =>
        currentThread
          ? {
              ...currentThread,
              lastMessage: content,
              lastMessageAt: sentAt,
              time: formatChatTime(sentAt),
            }
          : currentThread,
      );
      setChatThreads((currentThreads) => {
        const nextThread = {
          ...activeChatThread,
          lastMessage: content,
          lastMessageAt: sentAt,
          time: formatChatTime(sentAt),
          unreadCount: 0,
        };

        return [
          nextThread,
          ...currentThreads.filter(
            (thread) =>
              Number(thread.conversationId) !==
              Number(activeChatThread.conversationId),
          ),
        ];
      });
    } catch (error) {
      setChatError(error.message || "Gagal mengirim pesan");
    } finally {
      setIsSendingChatMessage(false);
    }
  };

  const handleChatEmojiSelect = (emojiData) => {
    setChatMessage((currentMessage) => `${currentMessage}${emojiData.emoji}`);
  };

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setIsLoadingNotifications(true);

      const response = await fetch(`${API_URL}/api/notifications?limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Gagal mengambil notifikasi");
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unread_count || 0));
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [token]);

  const handleToggleNotifications = () => {
    if (!requireLogin()) {
      return;
    }

    setShowChatPanel(false);
    setShowNotifications((currentValue) => {
      const nextValue = !currentValue;

      if (nextValue) {
        fetchNotifications();
      }

      return nextValue;
    });
  };

  const handleNotificationClick = async (notification) => {
    if (!requireLogin()) return;

    try {
      if (!notification.is_read) {
        await fetch(`${API_URL}/api/notifications/${notification.id_notification}/read`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Navigation still matters more than read-state if this request fails.
    }

    setShowNotifications(false);

    if (notification.id_post) {
      navigate(`/post/${notification.id_post}`);
    } else if (notification.notification_type === "friend_request") {
      navigate("/profile?tab=friends");
    }
  };

  const handleMarkAllRead = async () => {
    if (!token || unreadCount === 0) return;

    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          is_read: true,
        })),
      );
      setUnreadCount(0);
    } catch {
      // Keep the current state if the backend request fails.
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
    }
  }, [fetchNotifications, token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        chatRef.current &&
        !chatRef.current.contains(event.target)
      ) {
        setShowChatPanel(false);
        setActiveChatThread(null);
        setShowChatEmojiPicker(false);
        setIsChatExpanded(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleOpenChat = (event) => {
      const thread = event.detail?.thread;

      if (!thread) {
        return;
      }

      setShowNotifications(false);
      startChatWithUser(thread);
    };

    window.addEventListener("flix:open-chat", handleOpenChat);

    return () => {
      window.removeEventListener("flix:open-chat", handleOpenChat);
    };
  }, [startChatWithUser]);

  return (
    <>
      <header className={`site-navbar site-navbar--${mode}`}>
        <Link className="site-navbar__logo-link" to="/" aria-label="FLIX Home">
          <img className="site-navbar__logo" src={flixLogo} alt="FLIX" />
        </Link>

        <nav className="site-navbar__menu" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              className={currentActiveKey === item.key ? "is-active" : undefined}
              key={item.key}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-navbar__actions">
          <button
            className="site-navbar__icon-button"
            type="button"
            aria-label="Search"
            onClick={handleSearch}
          >
            <img src={searchIcon} alt="" />
          </button>

          {token ? (
            <>
              <div className="site-navbar__chat" ref={chatRef}>
                <button
                  className="site-navbar__icon-button site-navbar__icon-button--plain"
                  type="button"
                  aria-label="Messages"
                  aria-expanded={showChatPanel}
                  onClick={handleToggleChat}
                >
                  <img src={chatIcon} alt="" />
                </button>

                {showChatPanel && (
                  <section
                    className={
                      activeChatThread
                        ? `site-navbar__chat-panel site-navbar__chat-panel--private${
                            isChatExpanded ? " site-navbar__chat-panel--expanded" : ""
                          }`
                        : "site-navbar__chat-panel"
                    }
                    aria-label={activeChatThread ? "Private chat" : "Chat"}
                  >
                    {activeChatThread ? (
                      <>
                        <div className="site-navbar__private-chat-header">
                          <button
                            className="site-navbar__private-chat-back"
                            type="button"
                            aria-label="Kembali ke daftar chat"
                            onClick={() => {
                              setActiveChatThread(null);
                              setShowChatEmojiPicker(false);
                              setIsChatExpanded(false);
                            }}
                          >
                            <img src={arrowLeftIcon} alt="" />
                          </button>

                          <PremiumAvatar
                            className="site-navbar__private-chat-avatar"
                            imageUrl={activeChatThread.avatarUrl}
                            name={activeChatThread.name || "U"}
                            isPremium={Boolean(activeChatThread.isPremium)}
                            alt=""
                            ariaHidden
                          />

                          <h2>{activeChatThread.name}</h2>

                          <button
                            className={
                              isChatExpanded
                                ? "site-navbar__private-chat-expand is-expanded"
                                : "site-navbar__private-chat-expand"
                            }
                            type="button"
                            aria-label={isChatExpanded ? "Perkecil chat" : "Perbesar chat"}
                            aria-pressed={isChatExpanded}
                            onClick={() => setIsChatExpanded((currentValue) => !currentValue)}
                          >
                            {isChatExpanded ? (
                              <FiMinimize2 aria-hidden="true" />
                            ) : (
                              <FiMaximize2 aria-hidden="true" />
                            )}
                          </button>

                          <button
                            className="site-navbar__private-chat-close"
                            type="button"
                            aria-label="Tutup chat"
                            onClick={handleCloseChatPanel}
                          >
                            x
                          </button>
                        </div>

                        <div className="site-navbar__private-chat-body">
                          {isLoadingChatMessages ? (
                            <p className="site-navbar__private-chat-state">
                              Memuat pesan...
                            </p>
                          ) : chatMessages.length > 0 ? (
                            <div className="site-navbar__private-chat-messages">
                              {chatMessages.map((message) => {
                                const currentUserId = user?.id_user || user?.id || "";
                                const isMine =
                                  String(message.sender_user_id) ===
                                  String(currentUserId);
                                const senderAvatarUrl = isMine
                                  ? userProfileImageUrl
                                  : activeChatThread.avatarUrl ||
                                    resolveMediaUrl(message.sender_profile_image_url);
                                const senderIsPremium = isMine
                                  ? Boolean(user?.is_premium)
                                  : Boolean(
                                      activeChatThread.isPremium ||
                                        message.sender_is_premium,
                                    );

                                return (
                                  <div
                                    className={
                                      isMine
                                        ? "site-navbar__private-chat-message is-mine"
                                        : "site-navbar__private-chat-message is-theirs"
                                    }
                                    key={message.id_message}
                                  >
                                    {!isMine && (
                                      <PremiumAvatar
                                        className="site-navbar__private-chat-message-avatar"
                                        imageUrl={senderAvatarUrl}
                                        name={activeChatThread.name || "U"}
                                        isPremium={senderIsPremium}
                                        alt=""
                                        ariaHidden
                                      />
                                    )}
                                    <span className="site-navbar__private-chat-message-content">
                                      <span className="site-navbar__private-chat-message-bubble">
                                        {message.content}
                                      </span>
                                      <time>{formatChatTime(message.created_at)}</time>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="site-navbar__private-chat-state">
                              Belum ada pesan. Mulai obrolan tentang film.
                            </p>
                          )}

                          {chatError && (
                            <p className="site-navbar__chat-error">{chatError}</p>
                          )}
                        </div>

                        <form
                          className="site-navbar__private-chat-input"
                          onSubmit={(event) => {
                            event.preventDefault();
                            handleSendChatMessage();
                          }}
                        >
                          <button
                            type="button"
                            aria-label="Pilih emoji"
                            aria-expanded={showChatEmojiPicker}
                            onClick={() =>
                              setShowChatEmojiPicker((currentValue) => !currentValue)
                            }
                          >
                            <img src={smileIcon} alt="" />
                          </button>
                          <input
                            type="text"
                            placeholder="Message"
                            value={chatMessage}
                            onChange={(event) => setChatMessage(event.target.value)}
                            disabled={isSendingChatMessage}
                          />
                          <button
                            type="submit"
                            aria-label="Kirim pesan"
                            disabled={isSendingChatMessage || !chatMessage.trim()}
                          >
                            <img src={sendIcon} alt="" />
                          </button>

                          {showChatEmojiPicker && (
                            <div className="site-navbar__chat-emoji-picker">
                              <EmojiPicker
                                theme={Theme.DARK}
                                emojiStyle={EmojiStyle.NATIVE}
                                width="100%"
                                height={320}
                                lazyLoadEmojis
                                skinTonesDisabled
                                searchPlaceholder="Cari emote"
                                previewConfig={{ showPreview: false }}
                                onEmojiClick={handleChatEmojiSelect}
                              />
                            </div>
                          )}
                        </form>
                      </>
                    ) : (
                      <>
                        <div className="site-navbar__chat-header">
                          <h2>Chat</h2>
                          <button
                            type="button"
                            aria-label="Tutup chat"
                            onClick={handleCloseChatPanel}
                          >
                            x
                          </button>
                        </div>

                        {isLoadingChats ? (
                          <div className="site-navbar__chat-empty">
                            <p>Memuat chat...</p>
                          </div>
                        ) : chatThreads.length > 0 ? (
                          <div className="site-navbar__chat-list">
                            {chatThreads.slice(0, 4).map((thread) => (
                              <button
                                className="site-navbar__chat-item"
                                type="button"
                                key={thread.id}
                                onClick={() => handleOpenChatThread(thread)}
                              >
                                <span className="site-navbar__chat-avatar-wrap">
                                  <PremiumAvatar
                                    className="site-navbar__chat-avatar"
                                    imageUrl={thread.avatarUrl}
                                    name={thread.name || "U"}
                                    isPremium={Boolean(thread.isPremium)}
                                    alt=""
                                    ariaHidden
                                  />
                                  {thread.isOnline && (
                                    <span
                                      className="site-navbar__chat-online"
                                      aria-label="Online"
                                    />
                                  )}
                                </span>

                                <span className="site-navbar__chat-copy">
                                  <strong>{thread.name}</strong>
                                  <small>{thread.lastMessage}</small>
                                </span>

                                <span className="site-navbar__chat-meta">
                                  <time>{thread.time}</time>
                                  {Number(thread.unreadCount || 0) > 0 && (
                                    <span>{thread.unreadCount}</span>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="site-navbar__chat-empty">
                            <p>
                              {chatError ||
                                "Tambah teman untuk ngobrol tentang film."}
                            </p>
                            <button type="button" onClick={handleFindFriends}>
                              Cari Teman
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
              </div>

              <div className="site-navbar__notification" ref={notificationRef}>
                <button
                  className="site-navbar__icon-button site-navbar__icon-button--plain"
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={showNotifications}
                  onClick={handleToggleNotifications}
                >
                  <img src={notificationIcon} alt="" />
                  {unreadCount > 0 && (
                    <span
                      className="site-navbar__notification-badge"
                      aria-label={`${unreadCount} notifikasi belum dibaca`}
                    />
                  )}
                </button>

                {showNotifications && (
                  <section
                    className="site-navbar__notification-panel"
                    aria-label="Notifikasi"
                  >
                    <div className="site-navbar__notification-header">
                      <h2>Notifikasi</h2>
                      <button
                        type="button"
                        aria-label="Tutup notifikasi"
                        onClick={() => setShowNotifications(false)}
                      >
                        x
                      </button>
                    </div>

                    {unreadCount > 0 && (
                      <button
                        className="site-navbar__notification-read-all"
                        type="button"
                        onClick={handleMarkAllRead}
                      >
                        Tandai semua dibaca
                      </button>
                    )}

                    <div className="site-navbar__notification-list">
                      {isLoadingNotifications ? (
                        <p className="site-navbar__notification-empty">
                          Memuat notifikasi...
                        </p>
                      ) : notifications.length === 0 ? (
                        <p className="site-navbar__notification-empty">
                          Belum ada notifikasi.
                        </p>
                      ) : (
                        notifications.map((notification) => {
                          const { actor, actionText } =
                            getNotificationCopy(notification);

                          return (
                            <button
                              className={
                                notification.is_read
                                  ? "site-navbar__notification-item is-read"
                                  : "site-navbar__notification-item"
                              }
                              type="button"
                              key={notification.id_notification}
                              onClick={() => handleNotificationClick(notification)}
                            >
                              <span
                                className="site-navbar__notification-dot"
                                aria-hidden="true"
                              />
                              <span className="site-navbar__notification-icon">
                                <img src={messageCircleIcon} alt="" />
                              </span>
                              <span className="site-navbar__notification-text">
                                <span>
                                  <strong>{actor}</strong> {actionText}
                                </span>
                                {notification.post_title && (
                                  <small>{notification.post_title}</small>
                                )}
                              </span>
                              <time dateTime={notification.created_at}>
                                {formatNotificationTime(notification.created_at)}
                              </time>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>
                )}
              </div>

              <details className="site-navbar__user-menu">
                <summary aria-label="User menu">
                  <PremiumAvatar
                    className="site-navbar__avatar"
                    imageUrl={userProfileImageUrl}
                    name={user?.username || user?.email || "M"}
                    isPremium={Boolean(user?.is_premium)}
                    alt={user?.username || "Profile"}
                  />
                </summary>
                <div className="site-navbar__user-popover">
                  <Link className="site-navbar__profile-item" to="/profile">
                    <img src={profileIcon} alt="" />
                    <span>Profile</span>
                  </Link>

                  <Link className="site-navbar__profile-item" to="/watchlist">
                    <img src={myWatchlistIcon} alt="" />
                    <span>Watchlist</span>
                  </Link>

                  <Link className="site-navbar__profile-item" to="/community">
                    <img src={communityIcon} alt="" />
                    <span>Community</span>
                    <span className="site-navbar__pro-badge">
                      <img src={blueDiamondIcon} alt="" />
                      Pro
                    </span>
                  </Link>

                  <Link className="site-navbar__profile-item" to="/settings">
                    <img src={settingIcon} alt="" />
                    <span>Settings</span>
                  </Link>

                  {user?.role === "moderator" && (
                    <Link className="site-navbar__profile-item" to="/admin">
                      <img src={settingIcon} alt="" />
                      <span>Panel Moderator</span>
                    </Link>
                  )}

                  {user?.role === "admin" && (
                    <Link className="site-navbar__profile-item" to="/admin">
                      <img src={adminIcon} alt="" />
                      <span>Admin</span>
                    </Link>
                  )}

                  <div className="site-navbar__profile-divider" aria-hidden="true" />

                  <button
                    className="site-navbar__profile-item site-navbar__profile-item--logout"
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)}
                  >
                    <img src={logoutIcon} alt="" />
                    <span>Logout</span>
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link className="site-navbar__login" to="/login">
                Login
              </Link>
              <Link className="site-navbar__signin" to="/register">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      <SearchModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />

      {showLogoutConfirm && (
        <div
          className="logout-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowLogoutConfirm(false);
            }
          }}
        >
          <section className="logout-confirm__panel">
            <h2 id="logout-confirm-title">Apakah Anda yakin ingin keluar?</h2>
            <div className="logout-confirm__actions">
              <button
                type="button"
                className="logout-confirm__logout"
                onClick={handleLogout}
              >
                Logout
              </button>
              <button
                type="button"
                className="logout-confirm__cancel"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Batal
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default SiteNavbar;
