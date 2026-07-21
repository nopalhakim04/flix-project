import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiSend,
  FiThumbsUp,
  FiTrash2,
} from "react-icons/fi";
import CommunityUserPopover from "@/components/community/CommunityUserPopover";
import RichContent from "@/components/editor/RichContent";
import PremiumAvatar from "@/components/ui/PremiumAvatar";
import reportIcon from "@/assets/icon/report-icon.svg";
import shareIcon from "@/assets/icon/share-icon.svg";
import "./PostCard.css";

const reactionOptions = [
  { type: "love", label: "Love", icon: "\u2764\uFE0F" },
  { type: "funny", label: "Funny", icon: "\u{1F602}" },
  { type: "wow", label: "Wow", icon: "\u{1F62E}" },
  { type: "sad", label: "Sad", icon: "\u{1F622}" },
  { type: "angry", label: "Angry", icon: "\u{1F621}" },
];

function PostCard({
  post,
  user,
  comments,
  handleDeletePost,
  handleLike,
  handleReaction,
  handleShare,
  handleInsight,
  handleReportPost,
  handleVotePoll,
  handleTagClick,
  handleAddFriend,
  handleMessageUser,
  handleReportUser,
}) {
  const navigate = useNavigate();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState(
    post.user_reaction || null
  );

  const canDelete =
    user &&
    (user.role === "admin" ||
      user.role === "moderator" ||
      Number(user.id_user) === Number(post.id_user));

  const replyCount = Number(
    post.reply_count ?? (comments[post.id_post] || []).length
  );
  const viewCount = Number(post.view_count || 0);
  const pollOptions = post.poll?.options || [];
  const totalPollVotes = pollOptions.reduce(
    (total, option) => total + Number(option.vote_count || 0),
    0
  );
  const fallbackTotalInsight =
    viewCount +
    Number(post.like_count || 0) +
    replyCount +
    Number(post.share_count || 0) +
    Number(post.total_reactions || 0) +
    totalPollVotes;
  const totalInsight = Number(post.total_insight ?? fallbackTotalInsight);

  const handleCardAction = (event, action) => {
    event.stopPropagation();
    action();
  };

  const selectedReactionOption = reactionOptions.find(
    (item) => item.type === selectedReaction
  );

  const handleReactionSelect = async (reactionType) => {
    const success = await handleReaction(post.id_post, reactionType);

    if (!success) return;

    setSelectedReaction((current) =>
      current === reactionType ? null : reactionType
    );
    setShowReactionPicker(false);
  };

  return (
    <article
      className="community-post-card"
      onClick={() => navigate(`/post/${post.id_post}`)}
    >
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
                  handleAddFriend?.({
                    id_user: post.id_user,
                    username: post.username,
                    profile_image_url: post.profile_image_url,
                    is_premium: post.is_premium,
                    subscription_plan: post.subscription_plan,
                  })
                }
                onMessage={() => handleMessageUser?.(post)}
                onReportUser={() =>
                  handleReportUser?.({
                        id_user: post.id_user,
                        username: post.username,
                        profile_image_url: post.profile_image_url,
                        is_premium: post.is_premium,
                        subscription_plan: post.subscription_plan,
                      })
                }
              />
              <span />{" "}
              {new Date(post.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="community-post-card__tools">
          <button
            className="community-post-card__report"
            type="button"
            onClick={(event) =>
              handleCardAction(event, () => handleReportPost?.(post.id_post))
            }
            aria-label="Report post"
            title="Report post"
          >
            <img src={reportIcon} alt="" aria-hidden="true" />
          </button>

          {canDelete && (
          <button
            className="community-post-card__delete"
            type="button"
            onClick={(event) =>
              handleCardAction(event, () => handleDeletePost(post.id_post))
            }
            aria-label="Hapus post"
          >
            <FiTrash2 />
          </button>
          )}
        </div>
      </div>

      {post.tags?.length > 0 && (
        <div className="community-post-card__tags">
          {post.tags.map((tag, index) => (
            <button
              key={index}
              type="button"
              onClick={(event) =>
                handleCardAction(event, () => handleTagClick?.(tag))
              }
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
          <div className="community-post-card__poll-title">
            Polling
          </div>

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
                  onClick={(event) =>
                    handleCardAction(event, () =>
                      handleVotePoll(
                        post.id_post,
                        post.poll.id_poll,
                        option.id_option
                      )
                    )
                  }
                >
                  <span
                    className="community-post-card__poll-fill"
                    style={{
                      width: `${percent}%`,
                    }}
                  />
                  <span className="community-post-card__poll-label">
                    <span>{option.option_text || "Opsi polling kosong"}</span>
                    <small>
                      {voteCount} vote{totalPollVotes > 0 ? ` (${percent}%)` : ""}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="community-post-card__actions">
        <button
          type="button"
          onClick={(event) =>
            handleCardAction(event, () => handleLike(post.id_post))
          }
        >
          <FiThumbsUp />
          <span>Like</span>
          <small>{post.like_count || 0}</small>
        </button>

        <div className="community-post-card__reaction">
          <button
            type="button"
            className="community-post-card__reaction-button"
            onClick={(event) =>
              handleCardAction(event, () =>
                setShowReactionPicker((current) => !current)
              )
            }
          >
            <span aria-hidden="true">
              {selectedReactionOption?.icon || "\u{1F60A}"}
            </span>
            <span>{selectedReactionOption?.label || "Reaction"}</span>
            <small>{post.total_reactions || 0}</small>
          </button>

          {showReactionPicker && (
            <div
              className="community-post-card__reaction-picker"
              onClick={(event) => event.stopPropagation()}
            >
              {reactionOptions.map((reaction) => (
                <button
                  key={reaction.type}
                  type="button"
                  className={
                    selectedReaction === reaction.type ? "is-selected" : ""
                  }
                  onClick={(event) =>
                    handleCardAction(event, () =>
                      handleReactionSelect(reaction.type)
                    )
                  }
                >
                  <span aria-hidden="true">{reaction.icon}</span>
                  <span>{reaction.label}</span>
                  <small>{post[`${reaction.type}_count`] || 0}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(event) =>
            handleCardAction(event, () => handleShare(post.id_post))
          }
        >
          <img src={shareIcon} alt="" aria-hidden="true" />
          <span>Share</span>
        </button>

        <button
          className="community-post-card__insight"
          type="button"
          onClick={(event) =>
            handleCardAction(event, () => handleInsight(post.id_post))
          }
          aria-label={`Total insight ${totalInsight}`}
          title="Total insight"
        >
          <FiBarChart2 />
          <span>{totalInsight}</span>
        </button>
      </div>

      <div className="community-post-card__reply-count">
        <FiSend />
        <span>Total Replies: {replyCount}</span>
      </div>
    </article>
  );
}

export default PostCard;
