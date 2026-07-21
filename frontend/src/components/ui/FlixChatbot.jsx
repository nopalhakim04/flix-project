import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMessageCircle, FiMinus, FiSend, FiTrash2 } from "react-icons/fi";
import flixAdminLogo from "@/assets/flixadmin-logo.png";
import { requireExclusiveAccess } from "@/utils/authPrompt";
import "./FlixChatbot.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const navigationLinks = [
  { label: "Movies", to: "/movies" },
  { label: "Genre", to: "/genre" },
  { label: "Watchlist", to: "/watchlist" },
  { label: "Community", to: "/community" }
];

const pageTextLinks = [
  { aliases: ["Home"], to: "/" },
  { aliases: ["/movies", "Movies", "Movie"], to: "/movies" },
  { aliases: ["/tv-series", "TV Series"], to: "/tv-series" },
  { aliases: ["/genre", "Genre"], to: "/genre" },
  { aliases: ["/watchlist", "Watchlist"], to: "/watchlist" },
  { aliases: ["/community", "Community"], to: "/community" },
  { aliases: ["/profile", "Profile"], to: "/profile" },
  { aliases: ["/login", "Login"], to: "/login" },
  { aliases: ["/register", "Register", "Sign Up", "Daftar"], to: "/register" },
];

const normalizeTitle = (value = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stripTitleDecorations = (value = "") =>
  value
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getItemYear = (item = {}) =>
  (item.release_date || item.first_air_date || item.year || "").slice(0, 4);

const extractRecommendationCandidates = (text = "") => {
  const candidates = [];
  const seenTitles = new Set();

  text.split("\n").forEach((line) => {
    const match = line.match(
      /^\s*(?:\d+[.)]|[-*•])\s+(.+?)(?:\s*\((\d{4})\))?(?:\s*[-–—:]\s+|$)/
    );

    if (!match) {
      return;
    }

    const title = stripTitleDecorations(match[1]);
    const normalizedTitle = normalizeTitle(title);

    if (!title || title.length > 90 || seenTitles.has(normalizedTitle)) {
      return;
    }

    seenTitles.add(normalizedTitle);
    candidates.push({
      title,
      year: match[2] || "",
    });
  });

  return candidates.slice(0, 6);
};

const findBestMovieResult = (results = [], candidate) => {
  const candidateTitle = normalizeTitle(candidate.title);
  const candidateYear = candidate.year;

  return [...results]
    .filter((item) => item?.id)
    .sort((a, b) => {
      const titleA = normalizeTitle(a.title || a.original_title || a.name || "");
      const titleB = normalizeTitle(b.title || b.original_title || b.name || "");
      const yearA = getItemYear(a);
      const yearB = getItemYear(b);
      const scoreA =
        (titleA === candidateTitle ? 8 : titleA.includes(candidateTitle) ? 4 : 0) +
        (candidateYear && yearA === candidateYear ? 6 : 0) +
        Number(a.popularity || 0) / 100;
      const scoreB =
        (titleB === candidateTitle ? 8 : titleB.includes(candidateTitle) ? 4 : 0) +
        (candidateYear && yearB === candidateYear ? 6 : 0) +
        Number(b.popularity || 0) / 100;

      return scoreB - scoreA;
    })[0];
};

const resolveRecommendationLinks = async (text = "") => {
  const candidates = extractRecommendationCandidates(text);

  if (!candidates.length) {
    return [];
  }

  const links = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const response = await fetch(
          `${API_URL}/api/movies/search?query=${encodeURIComponent(candidate.title)}&language=id-ID`
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        const result = findBestMovieResult(data.results || [], candidate);

        if (!result?.id) {
          return null;
        }

        return {
          aliases: [candidate.title],
          to: `/movie/${result.id}`,
        };
      } catch {
        return null;
      }
    })
  );

  return links.filter(Boolean);
};

const isTextBoundary = (text, index, length, alias) => {
  if (alias.startsWith("/")) {
    return true;
  }

  const before = text[index - 1] || "";
  const after = text[index + length] || "";
  const isWord = (character) => /[a-zA-Z0-9]/.test(character);

  return !isWord(before) && !isWord(after);
};

const findNextTextLink = (text, startIndex, links) => {
  const lowerText = text.toLowerCase();
  let bestMatch = null;

  links.forEach((link) => {
    link.aliases.forEach((alias) => {
      const lowerAlias = alias.toLowerCase();
      const index = lowerText.indexOf(lowerAlias, startIndex);

      if (index < 0 || !isTextBoundary(text, index, alias.length, alias)) {
        return;
      }

      if (
        !bestMatch ||
        index < bestMatch.index ||
        (index === bestMatch.index && alias.length > bestMatch.alias.length)
      ) {
        bestMatch = {
          ...link,
          alias,
          index,
          length: alias.length,
        };
      }
    });
  });

  return bestMatch;
};

const readJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const getStoredUser = () => readJson("user", null);

const getUserStorageId = (user) => user?.id_user || user?.id || "guest";

const normalizeWatchlistItem = (item) => ({
  id: item.id,
  title: item.title || item.name || item.original_name || "Tanpa judul",
  year: item.year || item.releaseLabel || item.release_date || item.first_air_date || "-",
  rating: item.rating || item.vote_average || "-",
});

const getWatchlistContext = (user) => {
  const storageId = getUserStorageId(user);
  const movies = readJson(`flix_movie_watchlist_${storageId}`, []);
  const series = readJson(`flix_tv_watchlist_${storageId}`, []);

  return {
    movies: Array.isArray(movies) ? movies.slice(0, 10).map(normalizeWatchlistItem) : [],
    series: Array.isArray(series) ? series.slice(0, 10).map(normalizeWatchlistItem) : []
  };
};

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Halo, saya Chatbot FLIX. Saya bisa bantu soal film dan fitur FLIX, tapi kamu juga boleh tanya hal umum."
  }
];

function FlixChatbot() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const user = getStoredUser();

  const visibleMessages = messages.slice(-8);

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  const sendMessage = async (text) => {
    const messageText = text.trim();

    if (!messageText || isLoading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsLoading(true);
    scrollToBottom();

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: messageText,
          history: messages.slice(-6),
          context: {
            currentPath: location.pathname,
            user: user
              ? {
                  username: user.username,
                  role: user.role
                }
              : null,
            watchlist: getWatchlistContext(user)
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Gagal memakai Chatbot FLIX");
      }

      const assistantContent =
        data.reply ||
        data.message ||
        "Maaf, saya belum bisa menjawab pertanyaan itu sekarang.";
      const assistantLinks = await resolveRecommendationLinks(assistantContent);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: assistantContent,
          links: assistantLinks
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            "Maaf, Chatbot FLIX belum bisa tersambung ke server. Pastikan backend sedang berjalan."
        }
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  const handleClearChat = () => {
    setMessages(initialMessages);
    setInput("");
    setIsClearConfirmOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        className="flix-chatbot-toggle"
        type="button"
        onClick={() => {
          if (requireExclusiveAccess()) {
            setIsOpen(true);
          }
        }}
        aria-label="Buka Chatbot FLIX"
      >
        <FiMessageCircle aria-hidden="true" />
        <span>Tanya FLIX</span>
      </button>
    );
  }

  return (
    <section className="flix-chatbot">
      <header className="flix-chatbot__header">
        <div className="flix-chatbot__identity">
          <span className="flix-chatbot__logo">
            <img src={flixAdminLogo} alt="" />
          </span>
          <div>
            <p className="flix-chatbot__title">Chatbot FLIX</p>
            <p className="flix-chatbot__subtitle">
              <span aria-hidden="true" />
              {isLoading ? "Sedang mengetik..." : "Siap membantu"}
            </p>
          </div>
        </div>

        <div className="flix-chatbot__actions">
          <button
            className="flix-chatbot__icon-btn flix-chatbot__icon-btn--clear"
            type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            aria-label="Bersihkan chat"
            title="Bersihkan chat"
          >
            <FiTrash2 aria-hidden="true" />
          </button>
          <button
            className="flix-chatbot__icon-btn"
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Tutup chatbot"
          >
            <FiMinus aria-hidden="true" />
          </button>
        </div>
      </header>

      <>
        <div className="flix-chatbot__messages">
          {visibleMessages.map((message) => (
            <div
              className={`flix-chatbot__message-row flix-chatbot__message-row--${message.role}`}
              key={message.id}
            >
              {message.role === "assistant" && (
                <span className="flix-chatbot__message-avatar" aria-hidden="true">
                  <img src={flixAdminLogo} alt="" />
                </span>
              )}
              <div className={`flix-chatbot__message flix-chatbot__message--${message.role}`}>
                <p>{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flix-chatbot__message-row flix-chatbot__message-row--assistant">
              <span className="flix-chatbot__message-avatar" aria-hidden="true">
                <img src={flixAdminLogo} alt="" />
              </span>
              <div className="flix-chatbot__message flix-chatbot__message--assistant flix-chatbot__message--typing">
                <span className="flix-chatbot__typing" aria-label="Chatbot sedang mengetik">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <nav className="flix-chatbot__links" aria-label="Navigasi cepat Chatbot FLIX">
          {navigationLinks.map((link) => (
            <Link key={link.to} to={link.to} onClick={() => setIsOpen(false)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <form className="flix-chatbot__form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tanya FLIX..."
            maxLength={500}
          />
          <button
            className="flix-chatbot__send"
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Kirim pesan"
          >
            <FiSend aria-hidden="true" />
          </button>
        </form>

        {isClearConfirmOpen && (
          <div className="flix-chatbot__confirm" role="dialog" aria-modal="true" aria-labelledby="flix-chatbot-clear-title">
            <div className="flix-chatbot__confirm-dialog">
              <h3 id="flix-chatbot-clear-title">Bersihkan chat?</h3>
              <p>Semua percakapan di panel ini akan dihapus dan kembali ke pesan awal.</p>
              <div className="flix-chatbot__confirm-actions">
                <button type="button" className="flix-chatbot__confirm-cancel" onClick={() => setIsClearConfirmOpen(false)}>
                  Batal
                </button>
                <button type="button" className="flix-chatbot__confirm-delete" onClick={handleClearChat}>
                  Bersihkan
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </section>
  );
}

export default FlixChatbot;
