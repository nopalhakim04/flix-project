import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiSearch, FiX } from "react-icons/fi";
import PremiumAvatar from "@/components/ui/PremiumAvatar";
import "@/components/ui/SearchModal.css";

const stripHtml = (html = "") =>
  String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatDate = (date) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function PostSearchModal({ open, posts = [], comments = {}, onClose, onOpenPost }) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => inputRef.current?.focus(), 60);
    const handleKeydown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.classList.add("search-modal-open");
    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.clearTimeout(timeout);
      document.body.classList.remove("search-modal-open");
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [open, onClose]);

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const normalizedPosts = posts.map((post) => {
      const replyCount = Number(
        post.reply_count ?? (comments[post.id_post] || []).length ?? 0,
      );
      const contentText = stripHtml(post.content);
      const tags = Array.isArray(post.tags) ? post.tags : [];
      const searchableText = [
        post.title,
        contentText,
        post.username,
        ...tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return {
        ...post,
        contentText,
        replyCount,
        searchableText,
      };
    });

    return normalizedPosts
      .filter((post) => !keyword || post.searchableText.includes(keyword))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
  }, [comments, posts, query]);

  if (!open) return null;

  const handleOpenPost = (postId) => {
    setQuery("");
    onClose();
    onOpenPost(postId);
  };

  return createPortal(
    <div
      className="flix-search-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Cari post community"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="flix-search-modal__panel">
        <div className="flix-search-modal__searchbar">
          <FiSearch aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Telusuri judul, hashtag, atau isi diskusi..."
            aria-label="Cari post community"
          />
          <button type="button" aria-label="Tutup search post" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="flix-search-modal__body">
          <div className="flix-search-modal__header">
            <span>{query.trim() ? "Hasil pencarian post" : "Post terbaru"}</span>
            <small>{results.length} post</small>
          </div>

          {results.length === 0 ? (
            <p className="flix-search-modal__status">Post tidak ditemukan.</p>
          ) : (
            <div className="flix-search-modal__results">
              {results.map((post) => {
                return (
                  <button
                    key={post.id_post}
                    type="button"
                    className="flix-search-modal__result flix-search-modal__result--post"
                    onClick={() => handleOpenPost(post.id_post)}
                  >
                    <PremiumAvatar
                      className="flix-search-modal__avatar"
                      imageUrl={post.profile_image_url}
                      name={post.username || "F"}
                      isPremium={Boolean(post.is_premium)}
                      alt=""
                      ariaHidden
                    />
                    <span>
                      <strong>
                        {post.title || "Untitled Post"}{" "}
                        <em>({formatDate(post.created_at)})</em>
                      </strong>
                      <small>
                        {post.username || "FLIX User"}
                        <i aria-hidden="true" />
                        <b>{post.replyCount} replies</b>
                        <i aria-hidden="true" />
                        <mark>{Number(post.total_insight || post.view_count || 0)} insight</mark>
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default PostSearchModal;
