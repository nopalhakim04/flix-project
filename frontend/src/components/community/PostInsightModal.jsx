import { FiX } from "react-icons/fi";
import "./PostInsightModal.css";

function PostInsightModal({ isOpen, onClose, insight }) {
  if (!isOpen || !insight) return null;

  return (
    <div
      className="post-insight-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="post-insight-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-insight-title"
      >
        <div className="post-insight-modal__header">
          <h2 id="post-insight-title">Post Insight</h2>
          <button type="button" onClick={onClose} aria-label="Tutup insight">
            <FiX />
          </button>
        </div>

        <div className="post-insight-modal__grid">
          <div><strong>Title:</strong> {insight.title}</div>
          <div><strong>Total Insight:</strong> {insight.total_insight || 0}</div>
          <div><strong>Views:</strong> {insight.view_count || 0}</div>
          <div><strong>Like:</strong> {insight.total_likes}</div>
          <div><strong>Replies:</strong> {insight.total_replies}</div>
          <div><strong>Shares:</strong> {insight.total_shares}</div>
          <div><strong>Total Reactions:</strong> {insight.reactions.total_reactions}</div>
          <div><strong>Love:</strong> {insight.reactions.love_count}</div>
          <div><strong>Funny:</strong> {insight.reactions.funny_count}</div>
          <div><strong>Wow:</strong> {insight.reactions.wow_count}</div>
          <div><strong>Sad:</strong> {insight.reactions.sad_count}</div>
          <div><strong>Angry:</strong> {insight.reactions.angry_count}</div>
        </div>

        {insight.post_type === "poll" && insight.poll && (
          <div className="post-insight-modal__poll">
            <h3>Polling Insight</h3>
            <div><strong>Total Vote:</strong> {insight.poll.total_poll_votes}</div>

            <div className="post-insight-modal__poll-options">
              {insight.poll.options.map((option) => (
                <div key={option.id_option}>
                  {option.option_text} - {option.vote_count} vote
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PostInsightModal;
