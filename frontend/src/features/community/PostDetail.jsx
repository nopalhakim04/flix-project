import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import {
  FiBarChart2,
  FiCornerUpLeft,
  FiSend,
  FiSmile,
  FiThumbsUp,
} from "react-icons/fi";
import AddFriendConfirmModal from "@/components/community/AddFriendConfirmModal";
import CommunityUserPopover from "@/components/community/CommunityUserPopover";
import GifPickerModal from "@/components/editor/GifPickerModal";
import PostInsightModal from "@/components/community/PostInsightModal";
import RichContent from "@/components/editor/RichContent";
import SiteNavbar from "@/components/layout/SiteNavbar";
import PremiumAvatar from "@/components/ui/PremiumAvatar";
import ReportModal from "@/components/ui/ReportModal";
import reportIcon from "@/assets/icon/report-icon.svg";
import shareIcon from "@/assets/icon/share-icon.svg";
import { createChatThreadFromUser, openChatThread } from "@/utils/chat";
import { requireLogin, requirePremiumAccess } from "@/utils/authPrompt";
import { showAlert, showToast } from "@/utils/alerts";
import { submitReport } from "@/utils/report";
import "@/components/community/PostCard.css";
import "./PostDetail.css";

const postReactionOptions = [
  { type: "love", label: "Love", icon: "\u2764\uFE0F" },
  { type: "funny", label: "Funny", icon: "\u{1F602}" },
  { type: "wow", label: "Wow", icon: "\u{1F62E}" },
  { type: "sad", label: "Sad", icon: "\u{1F622}" },
  { type: "angry", label: "Angry", icon: "\u{1F621}" },
];

function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [pollData, setPollData] = useState(null);

  const [replyInputs, setReplyInputs] = useState({});
  const [showChildReplies, setShowChildReplies] = useState({});
  const [activeReplyBox, setActiveReplyBox] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [showGifPicker, setShowGifPicker] = useState({});
  const [selectedGifs, setSelectedGifs] = useState({});

  const [insight, setInsight] = useState(null);
  const [showInsight, setShowInsight] = useState(false);
  const [showPostReactionPicker, setShowPostReactionPicker] = useState(false);
  const [selectedPostReaction, setSelectedPostReaction] = useState(null);
  const [friendTarget, setFriendTarget] = useState(null);
  const [friendRequestSaving, setFriendRequestSaving] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportError, setReportError] = useState("");

  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const fetchPost = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/posts/${id}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        },
      );
      setPost(res.data);
      setSelectedPostReaction(res.data.user_reaction || null);
    } catch (error) {
      console.error(error);
      setPost(null);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/comments/${id}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        },
      );
      setComments(res.data);
    } catch (error) {
      console.error(error);
      setComments([]);
    }
  };

  const fetchPoll = async (postId) => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/polls/post/${postId}`,
      );
      setPollData(res.data);
    } catch (error) {
      setPollData(null);
    }
  };

  const fetchInsight = async () => {
    if (!requireLogin()) {
      return;
    }

    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/post-insights/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setInsight(res.data);
      setShowInsight(true);
    } catch (error) {
      showAlert({ title: "Insight Tidak Tersedia", text: error.response?.data?.message || "Gagal mengambil insight.", icon: "error" });
    }
  };

  const recordPostView = async () => {
    if (!token) return;

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/post-views/${id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const loadPost = async () => {
      await recordPostView();
      fetchPost();
      fetchComments();
    };

    loadPost();
  }, [id]);

  useEffect(() => {
    if (post?.post_type === "poll") {
      fetchPoll(post.id_post);
    } else {
      setPollData(null);
    }
  }, [post]);

  const toggleChildReplies = (commentId) => {
    setShowChildReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const toggleReplyBox = (key) => {
    setActiveReplyBox((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleEmojiPicker = (key) => {
    setShowEmojiPicker((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleGifPicker = (key) => {
    setShowGifPicker((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleReplyChange = (key, value) => {
    setReplyInputs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSelectGif = (key, gif) => {
    setSelectedGifs((prev) => ({
      ...prev,
      [key]: gif,
    }));

    setShowGifPicker((prev) => ({
      ...prev,
      [key]: false,
    }));
  };

  const removeSelectedGif = (key) => {
    setSelectedGifs((prev) => ({
      ...prev,
      [key]: null,
    }));
  };

  const handleTagClick = (tag) => {
    navigate(`/community?tag=${encodeURIComponent(tag)}`);
  };

  const renderContentWithGif = (text) => {
    if (!text) return null;

    const gifMatch = text.match(/\[GIF\](.*?)\[\/GIF\]/);
    const cleanText = text.replace(/\[GIF\](.*?)\[\/GIF\]/, "").trim();

    return (
      <div>
        {cleanText && <p style={{ margin: "6px 0 10px 0" }}>{cleanText}</p>}
        {gifMatch?.[1] && (
          <img
            src={gifMatch[1]}
            alt="GIF"
            style={{
              maxWidth: "220px",
              borderRadius: "10px",
              display: "block",
            }}
          />
        )}
      </div>
    );
  };

  const handleLike = async (postId) => {
    if (!requirePremiumAccess()) {
      return;
    }

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/post-likes/${postId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      fetchPost();
    } catch (error) {
      showAlert({ title: "Gagal Memberi Like", text: error.response?.data?.message || "Gagal memberi like.", icon: "error" });
    }
  };

  const handleReaction = async (postId, reactionType) => {
    if (!requirePremiumAccess()) {
      return false;
    }

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/post-reactions/${postId}`,
        { reaction_type: reactionType },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      fetchPost();
      return true;
    } catch (error) {
      showAlert({ title: "Gagal Memberi Reaction", text: error.response?.data?.message || "Gagal memberi reaction.", icon: "error" });
      return false;
    }
  };

  const handlePostReactionSelect = async (reactionType) => {
    const success = await handleReaction(post.id_post, reactionType);

    if (!success) return;

    setSelectedPostReaction((current) =>
      current === reactionType ? null : reactionType,
    );
    setShowPostReactionPicker(false);
  };

  const handleShare = async (postId) => {
    if (!requirePremiumAccess()) {
      return;
    }

    const shareLink = `${window.location.origin}/post/${postId}`;

    try {
      if (token) {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/post-shares/${postId}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }

      await navigator.clipboard.writeText(shareLink);
      fetchPost();
      showToast({ title: "Link post berhasil disalin." });
    } catch (error) {
      showAlert({ title: "Gagal Menyalin Link", text: "Link post belum bisa disalin.", icon: "error" });
    }
  };

  const handleVotePoll = async (pollId, optionId) => {
    if (!requirePremiumAccess()) {
      return;
    }

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/polls/${pollId}/vote`,
        { option_id: optionId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      fetchPoll(post.id_post);
      fetchPost();
    } catch (error) {
      showAlert({ title: "Gagal Vote Polling", text: error.response?.data?.message || "Gagal vote polling.", icon: "error" });
    }
  };

  const handleCreateReply = async (
    postId,
    parentCommentId = null,
    inputKey,
  ) => {
    if (!requirePremiumAccess()) {
      return;
    }

    try {
      const replyText = replyInputs[inputKey];

      if (
        (!replyText || replyText.trim() === "") &&
        !selectedGifs[inputKey]?.url
      ) {
        showAlert({ title: "Reply Kosong", text: "Reply tidak boleh kosong.", icon: "warning" });
        return;
      }

      const finalContent = selectedGifs[inputKey]?.url
        ? `${replyText || ""}<p><img src="${selectedGifs[inputKey].url}" alt="GIF" class="embedded-gif" /></p>`
        : replyText;

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/comments/${postId}`,
        {
          content: finalContent,
          parent_comment_id: parentCommentId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setReplyInputs((prev) => ({
        ...prev,
        [inputKey]: "",
      }));

      setSelectedGifs((prev) => ({
        ...prev,
        [inputKey]: null,
      }));

      if (parentCommentId) {
        setShowChildReplies((prev) => ({
          ...prev,
          [parentCommentId]: true,
        }));
      }

      fetchComments();
      fetchPost();
    } catch (error) {
      showAlert({ title: "Gagal Membuat Reply", text: error.response?.data?.message || "Gagal membuat reply.", icon: "error" });
    }
  };

  const getChildComments = (allComments, parentId) => {
    return allComments.filter(
      (comment) => Number(comment.parent_comment_id) === Number(parentId),
    );
  };

  const formatReplyDate = (date) => {
    return new Date(date).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleReportClick = (targetType, targetId) => {
    if (!requireLogin()) {
      return;
    }

    const isReply = targetType === "reply";

    setReportError("");
    setReportTarget({
      targetType: isReply ? "community_reply" : "community_post",
      targetId,
      targetLabel: isReply ? "reply" : "post",
    });
  };

  const handleSubmitReport = async ({ category, reason }) => {
    if (!reportTarget) return;

    try {
      setReportSaving(true);
      setReportError("");
      await submitReport({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        category,
        reason,
      });
      setReportTarget(null);
      showToast({ title: "Report berhasil dikirim." });
    } catch (error) {
      setReportError(error.response?.data?.message || "Gagal mengirim report");
    } finally {
      setReportSaving(false);
    }
  };

  const handleAddFriend = (targetUser) => {
    if (!requirePremiumAccess()) {
      return;
    }

    setFriendTarget(targetUser);
  };

  const handleConfirmAddFriend = async () => {
    if (!friendTarget) return;

    try {
      setFriendRequestSaving(true);
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/friends/${friendTarget.id_user}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setPost((current) =>
        current && Number(current.id_user) === Number(friendTarget.id_user)
          ? { ...current, friendship_status: "pending_sent" }
          : current,
      );
      setComments((currentComments) =>
        currentComments.map((comment) =>
          Number(comment.id_user) === Number(friendTarget.id_user)
            ? { ...comment, friendship_status: "pending_sent" }
            : comment,
        ),
      );
      setFriendTarget(null);
    } catch (error) {
      showAlert({ title: "Gagal Menambahkan Teman", text: error.response?.data?.message || "Gagal menambahkan teman.", icon: "error" });
    } finally {
      setFriendRequestSaving(false);
    }
  };

  const handleMessageUser = (targetUser) => {
    if (!requirePremiumAccess()) {
      return;
    }

    openChatThread(
      createChatThreadFromUser({
        id_user: targetUser.id_user,
        username: targetUser.username,
        profile_image_url: targetUser.profile_image_url,
        is_premium: targetUser.is_premium,
        subscription_plan: targetUser.subscription_plan,
        lastMessage: "Mulai obrolan tentang film",
      }),
    );
  };

  const handleReportUser = (targetUser) => {
    if (!requireLogin()) {
      return;
    }

    const normalizedUser =
      typeof targetUser === "object" && targetUser !== null
        ? targetUser
        : { id_user: targetUser };

    if (!normalizedUser.id_user) {
      return;
    }

    setReportError("");
    setReportTarget({
      targetType: "user_profile",
      targetId: normalizedUser.id_user,
      targetLabel: `user ${normalizedUser.username || `#${normalizedUser.id_user}`}`,
    });
  };

  const renderCommentTree = (allComments, items, postId, level = 0) => {
    return items.map((comment) => {
      const childComments = getChildComments(allComments, comment.id_comment);
      const inputKey = `comment-${comment.id_comment}`;
      const replyNumber =
        allComments.findIndex(
          (item) => item.id_comment === comment.id_comment,
        ) + 1;

      return (
        <div
          key={comment.id_comment}
          className={`post-reply-item ${
            level > 0 ? "post-reply-item--nested" : ""
          }`}>
          <article className="post-reply-card">
            <header className="post-reply-header">
              <div className="post-reply-author">
                <PremiumAvatar
                  className="post-reply-avatar"
                  imageUrl={comment.profile_image_url}
                  name={comment.username}
                  isPremium={Boolean(comment.is_premium)}
                  subscriptionPlan={comment.subscription_plan}
                  alt=""
                  ariaHidden
                />
                <div className="post-reply-meta">
                  <CommunityUserPopover
                    user={{
                      id_user: comment.id_user,
                      username: comment.username,
                      profile_image_url: comment.profile_image_url,
                      is_premium: comment.is_premium,
                      subscription_plan: comment.subscription_plan,
                    }}
                    currentUser={user}
                    isFriend={Boolean(comment.is_friend)}
                    friendshipStatus={comment.friendship_status}
                    onAddFriend={() =>
                      handleAddFriend({
                        id_user: comment.id_user,
                        username: comment.username,
                        profile_image_url: comment.profile_image_url,
                        is_premium: comment.is_premium,
                        subscription_plan: comment.subscription_plan,
                      })
                    }
                    onMessage={() => handleMessageUser(comment)}
                    onReportUser={() =>
                      handleReportUser({
                        id_user: comment.id_user,
                        username: comment.username,
                        profile_image_url: comment.profile_image_url,
                        is_premium: comment.is_premium,
                        subscription_plan: comment.subscription_plan,
                      })
                    }
                  />
                  <time dateTime={comment.created_at}>
                    {formatReplyDate(comment.created_at)}
                  </time>
                </div>
              </div>

              <div className="post-reply-tools">
                <span className="post-reply-number">#{replyNumber}</span>
                <button
                  type="button"
                  className="post-report-button"
                  aria-label={`Report reply dari ${comment.username}`}
                  title="Report reply"
                  onClick={() =>
                    handleReportClick("reply", comment.id_comment)
                  }>
                  <img src={reportIcon} alt="" aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="post-reply-content">
              <RichContent html={comment.content} />
            </div>

            <div className="post-reply-actions">
              <span
                className="post-reply-like-pill"
                aria-label="Reply like count">
                <FiThumbsUp />
                <span>{comment.like_count || 0}</span>
              </span>

              {childComments.length > 0 && (
                <button
                  type="button"
                  className="post-reply-text-action"
                  onClick={() => toggleChildReplies(comment.id_comment)}>
                  {showChildReplies[comment.id_comment]
                    ? "Tutup"
                    : `${childComments.length} balasan`}
                </button>
              )}

              {token && (
                <button
                  type="button"
                  className="post-reply-text-action post-reply-text-action--reply"
                  onClick={() => toggleReplyBox(inputKey)}>
                  <FiCornerUpLeft />
                  {activeReplyBox[inputKey] ? "Batal" : "Balas"}
                </button>
              )}
            </div>

            {activeReplyBox[inputKey] && token && (
              <div className="post-reply-form">
                <div className="post-reply-input-row">
                  <input
                    className="post-reply-input"
                    type="text"
                    placeholder="Tulis balasan..."
                    value={replyInputs[inputKey] || ""}
                    onChange={(e) =>
                      handleReplyChange(inputKey, e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="post-reply-icon-button"
                    onClick={() => toggleEmojiPicker(inputKey)}>
                    <FiSmile />
                  </button>
                  <button
                    type="button"
                    className="post-reply-gif-button"
                    onClick={() => toggleGifPicker(inputKey)}>
                    GIF
                  </button>
                  <button
                    type="button"
                    className="post-reply-submit"
                    onClick={() =>
                      handleCreateReply(postId, comment.id_comment, inputKey)
                    }>
                    Kirim
                  </button>
                </div>

                {selectedGifs[inputKey]?.preview && (
                  <div className="post-reply-gif-preview">
                    <img
                      src={selectedGifs[inputKey].preview}
                      alt="GIF preview"
                    />
                    <button
                      type="button"
                      onClick={() => removeSelectedGif(inputKey)}>
                      Hapus GIF
                    </button>
                  </div>
                )}

                {showEmojiPicker[inputKey] && (
                  <div className="post-detail-emoji-picker">
                    <EmojiPicker
                      theme={Theme.DARK}
                      emojiStyle={EmojiStyle.NATIVE}
                      width="100%"
                      height={360}
                      lazyLoadEmojis
                      skinTonesDisabled
                      searchPlaceholder="Cari emote"
                      previewConfig={{ showPreview: false }}
                      onEmojiClick={(emojiData) =>
                        handleReplyChange(
                          inputKey,
                          (replyInputs[inputKey] || "") + emojiData.emoji,
                        )
                      }
                    />
                  </div>
                )}

                <GifPickerModal
                  isOpen={!!showGifPicker[inputKey]}
                  onClose={() => toggleGifPicker(inputKey)}
                  onSelectGif={(gif) => handleSelectGif(inputKey, gif)}
                />
              </div>
            )}
          </article>

          {showChildReplies[comment.id_comment] && (
            <div className="post-reply-children">
              {renderCommentTree(
                allComments,
                childComments,
                postId,
                level + 1,
              )}
            </div>
          )}
        </div>
      );
    });
  };

  if (!post) {
    return (
      <main className="post-detail-page">
        <SiteNavbar mode="fixed" activeKey="community" />
        <div className="post-detail-shell">
          <div className="post-detail-empty">Post tidak ditemukan.</div>
        </div>
      </main>
    );
  }

  const rootComments = comments.filter((comment) => !comment.parent_comment_id);
  const postReplyKey = `post-${post.id_post}`;
  const viewCount = Number(post.view_count || 0);
  const totalInsight = Number(post.total_insight || viewCount);
  const pollOptions = pollData?.options || [];
  const totalPollVotes = pollOptions.reduce(
    (total, option) => total + Number(option.vote_count || 0),
    0,
  );
  const selectedPostReactionOption = postReactionOptions.find(
    (item) => item.type === selectedPostReaction,
  );

  return (
    <main className="post-detail-page">
      <SiteNavbar mode="fixed" activeKey="community" />
      <div className="post-detail-shell">
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ marginBottom: "16px" }}>
        &lt; Kembali
      </button>

      <div className="post-detail-card community-post-card">
        <div className="community-post-card__header">
          <div className="community-post-card__author">
            <PremiumAvatar
              className="community-post-card__avatar"
              imageUrl={post.profile_image_url}
              name={post.username || "F"}
              isPremium={Boolean(post.is_premium)}
              subscriptionPlan={post.subscription_plan}
              alt={post.username || "Profile"}
            />
            <div>
              <h3>{post.title || "Untitled Post"}</h3>
              <p>
                by{" "}
                <CommunityUserPopover
                  user={{
                    id_user: post.id_user,
                    username: post.username,
                    profile_image_url: post.profile_image_url,
                    is_premium: post.is_premium,
                    subscription_plan: post.subscription_plan,
                  }}
                  currentUser={user}
                  isFriend={Boolean(post.is_friend)}
                  friendshipStatus={post.friendship_status}
                  onAddFriend={() =>
                    handleAddFriend({
                        id_user: post.id_user,
                        username: post.username,
                        profile_image_url: post.profile_image_url,
                        is_premium: post.is_premium,
                        subscription_plan: post.subscription_plan,
                      })
                  }
                  onMessage={() => handleMessageUser(post)}
                  onReportUser={() =>
                    handleReportUser({
                        id_user: post.id_user,
                        username: post.username,
                        profile_image_url: post.profile_image_url,
                        is_premium: post.is_premium,
                        subscription_plan: post.subscription_plan,
                      })
                  }
                />
                <span aria-hidden="true" />
                {new Date(post.created_at).toLocaleString()}
                <span aria-hidden="true" />
                <em className="post-detail-view-count">
                  <FiBarChart2 size={14} />
                  {viewCount} views
                </em>
              </p>
            </div>
          </div>

          <div className="community-post-card__tools">
            <button
              type="button"
              className="community-post-card__report post-report-button"
              aria-label="Report post"
              title="Report post"
              onClick={() => handleReportClick("post", post.id_post)}>
              <img src={reportIcon} alt="" aria-hidden="true" />
            </button>
          </div>
        </div>

        {post.tags?.length > 0 && (
          <div className="community-post-card__tags">
            {post.tags.map((tag, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleTagClick(tag)}
                title={`Lihat post dengan hashtag #${tag}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        <div className="community-post-card__content">
          <RichContent html={post.content} />
        </div>

        {post.image_url && (
          <img
            className="community-post-card__image"
            src={`${import.meta.env.VITE_API_URL}${post.image_url}`}
            alt="Post"
          />
        )}

        {post.post_type === "poll" && pollOptions.length > 0 && (
          <div className="community-post-card__poll">
            <div className="community-post-card__poll-title">Polling</div>

            <div className="community-post-card__poll-options">
              {pollOptions.map((option) => {
                const voteCount = Number(option.vote_count || 0);
                const percent =
                  totalPollVotes > 0
                    ? Math.round((voteCount / totalPollVotes) * 100)
                    : 0;

                return (
                  <button
                    className="community-post-card__poll-option"
                    key={option.id_option}
                    type="button"
                    onClick={() =>
                      handleVotePoll(pollData.poll.id_poll, option.id_option)
                    }>
                    <span
                      className="community-post-card__poll-fill"
                      style={{ width: `${percent}%` }}
                    />
                    <span className="community-post-card__poll-label">
                      <span>{option.option_text || "Opsi polling kosong"}</span>
                      <small>
                        {voteCount} vote
                        {totalPollVotes > 0 ? ` (${percent}%)` : ""}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="community-post-card__actions post-detail-action-row">
          <button type="button" onClick={() => handleLike(post.id_post)}>
            <FiThumbsUp size={15} />
            <span>Like</span>
            <small>{post.like_count || 0}</small>
          </button>

          <div className="community-post-card__reaction post-detail-reaction">
            <button
              type="button"
              className="community-post-card__reaction-button"
              onClick={() =>
                setShowPostReactionPicker((current) => !current)
              }>
              <span aria-hidden="true">
                {selectedPostReactionOption?.icon || "\u{1F60A}"}
              </span>
              <span>{selectedPostReactionOption?.label || "Reaction"}</span>
              <small>{post.total_reactions || 0}</small>
            </button>

            {showPostReactionPicker && (
              <div className="community-post-card__reaction-picker post-detail-reaction-picker">
                {postReactionOptions.map((reaction) => (
                  <button
                    key={reaction.type}
                    type="button"
                    className={
                      selectedPostReaction === reaction.type
                        ? "is-selected"
                        : ""
                    }
                    onClick={() => handlePostReactionSelect(reaction.type)}>
                    <span aria-hidden="true">{reaction.icon}</span>
                    <span>{reaction.label}</span>
                    <small>{post[`${reaction.type}_count`] || 0}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={() => handleShare(post.id_post)}>
            <img src={shareIcon} alt="" aria-hidden="true" />
            <span>Share</span>
          </button>

          <button
            type="button"
            className="community-post-card__insight"
            onClick={fetchInsight}
            aria-label={`Total insight ${totalInsight}`}
            title="Total insight">
            <FiBarChart2 size={16} />
            <span>{totalInsight}</span>
          </button>
        </div>

        <div className="community-post-card__reply-count">
          <FiSend />
          <span>Total Replies: {comments.length}</span>
        </div>

        <section className="post-replies-section">
          <div className="post-replies-header">
            <h4>Replies</h4>
            <span>{comments.length}</span>
          </div>

          {token ? (
            <div className="post-reply-composer">
              <div className="post-reply-input-row">
                <input
                  className="post-reply-input"
                  type="text"
                  placeholder="Tulis reply ke post..."
                  value={replyInputs[postReplyKey] || ""}
                  onChange={(e) =>
                    handleReplyChange(postReplyKey, e.target.value)
                  }
                />
                <button
                  type="button"
                  className="post-reply-icon-button"
                  onClick={() => toggleEmojiPicker(postReplyKey)}>
                  <FiSmile />
                </button>
                <button
                  type="button"
                  className="post-reply-gif-button"
                  onClick={() => toggleGifPicker(postReplyKey)}>
                  GIF
                </button>
                <button
                  type="button"
                  className="post-reply-submit"
                  onClick={() =>
                    handleCreateReply(post.id_post, null, postReplyKey)
                  }>
                  Reply
                </button>
              </div>

              {selectedGifs[postReplyKey]?.preview && (
                <div className="post-reply-gif-preview">
                  <img
                    src={selectedGifs[postReplyKey].preview}
                    alt="GIF preview"
                  />
                  <button
                    type="button"
                    onClick={() => removeSelectedGif(postReplyKey)}>
                    Hapus GIF
                  </button>
                </div>
              )}

              {showEmojiPicker[postReplyKey] && (
                <div className="post-detail-emoji-picker">
                  <EmojiPicker
                    theme={Theme.DARK}
                    emojiStyle={EmojiStyle.NATIVE}
                    width="100%"
                    height={360}
                    lazyLoadEmojis
                    skinTonesDisabled
                    searchPlaceholder="Cari emote"
                    previewConfig={{ showPreview: false }}
                    onEmojiClick={(emojiData) =>
                      handleReplyChange(
                        postReplyKey,
                        (replyInputs[postReplyKey] || "") + emojiData.emoji,
                      )
                    }
                  />
                </div>
              )}

              <GifPickerModal
                isOpen={!!showGifPicker[postReplyKey]}
                onClose={() => toggleGifPicker(postReplyKey)}
                onSelectGif={(gif) => handleSelectGif(postReplyKey, gif)}
              />
            </div>
          ) : (
            <small className="post-reply-login-note">
              Login untuk membalas post.
            </small>
          )}

          {rootComments.length > 0 ? (
            <div className="post-reply-list">
              {renderCommentTree(comments, rootComments, post.id_post, 0)}
            </div>
          ) : (
            <p className="post-reply-empty">Belum ada reply.</p>
          )}
        </section>
      </div>

      </div>

      <PostInsightModal
        isOpen={showInsight}
        onClose={() => setShowInsight(false)}
        insight={insight}
      />
      <AddFriendConfirmModal
        open={Boolean(friendTarget)}
        user={friendTarget}
        saving={friendRequestSaving}
        onCancel={() => setFriendTarget(null)}
        onConfirm={handleConfirmAddFriend}
      />
      <ReportModal
        open={Boolean(reportTarget)}
        targetLabel={reportTarget?.targetLabel}
        isSubmitting={reportSaving}
        errorMessage={reportError}
        onClose={() => setReportTarget(null)}
        onSubmit={handleSubmitReport}
      />
    </main>
  );
}

export default PostDetail;
