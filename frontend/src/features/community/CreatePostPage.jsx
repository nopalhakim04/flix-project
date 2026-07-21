import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FiArrowLeft, FiHash, FiPlus, FiSend, FiTrash2, FiX } from "react-icons/fi";
import SiteNavbar from "@/components/layout/SiteNavbar";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { requireLogin, requirePremiumAccess } from "@/utils/authPrompt";
import { showAlert, showToast } from "@/utils/alerts";
import "./CreatePostPage.css";

function CreatePostPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [postType, setPostType] = useState("post");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [pollOptions, setPollOptions] = useState(["", ""]);

  useEffect(() => {
    if (!token) {
      requireLogin();
      return;
    }

    requirePremiumAccess();
  }, [token]);

  const addTag = () => {
    const cleanTag = tagInput.trim();

    if (!cleanTag) return;
    if (tags.includes(cleanTag)) return;

    setTags((prev) => [...prev, cleanTag]);
    setTagInput("");
  };

  const removeTag = (tag) => {
    setTags((prev) => prev.filter((item) => item !== tag));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  const handlePollOptionChange = (index, value) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const addPollOption = () => {
    setPollOptions((prev) => [...prev, ""]);
  };

  const removePollOption = (index) => {
    if (pollOptions.length <= 2) {
      showAlert({ title: "Polling Belum Lengkap", text: "Minimal polling harus memiliki 2 opsi.", icon: "warning" });
      return;
    }

    const updated = pollOptions.filter((_, i) => i !== index);
    setPollOptions(updated);
  };

  const resetForm = () => {
    setPostType("post");
    setTitle("");
    setContent("");
    setTagInput("");
    setTags([]);
    setPollOptions(["", ""]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!requirePremiumAccess()) {
      return;
    }

    if (!title.trim()) {
      showAlert({ title: "Title Wajib Diisi", text: "Isi title sebelum membuat post.", icon: "warning" });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("content", content);
      formData.append("post_type", postType);
      formData.append("tags", JSON.stringify(tags));

      if (postType === "poll") {
        const cleanedOptions = pollOptions
          .map((item) => item.trim())
          .filter((item) => item !== "");

        if (cleanedOptions.length < 2) {
          showAlert({ title: "Polling Belum Lengkap", text: "Polling minimal harus memiliki 2 opsi.", icon: "warning" });
          return;
        }

        formData.append("poll_options", JSON.stringify(cleanedOptions));
      }

      await axios.post(`${import.meta.env.VITE_API_URL}/api/posts`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      showToast({ title: "Post berhasil dibuat." });
      resetForm();
      navigate("/");
    } catch (error) {
      showAlert({
        title: "Gagal Membuat Post",
        text: error.response?.data?.message || "Gagal membuat post.",
        icon: "error",
      });
    }
  };

  return (
    <main className="create-post-page">
      <SiteNavbar mode="fixed" activeKey="community" />

      <section className="create-post-hero">
        <button className="create-post-back" type="button" onClick={() => navigate(-1)}>
          <FiArrowLeft />
          Kembali
        </button>

        <h1>
          Buat <strong>Post</strong> Baru
        </h1>
        <p>
          Bagikan opini, rekomendasi, spoiler warning, atau polling untuk komunitas FLIX.
        </p>
      </section>

      <section className="create-post-shell">
        <form className="create-post-form" onSubmit={handleSubmit}>
          <div className="create-post-type-tabs" aria-label="Pilih tipe post">
            <button
              className={postType === "post" ? "is-active" : ""}
              type="button"
              onClick={() => setPostType("post")}
            >
              Post
            </button>

            <button
              className={postType === "poll" ? "is-active" : ""}
              type="button"
              onClick={() => setPostType("poll")}
            >
              Polling
            </button>
          </div>

          <label className="create-post-field">
            <span>Title</span>
            <input
              type="text"
              placeholder="Title*"
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <small>{title.length}/300</small>
          </label>

          <div className="create-post-field">
            <span>Hashtag</span>
            <div className="create-post-tag-input">
              <FiHash />
              <input
                type="text"
                placeholder="Add tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
              <button type="button" onClick={addTag}>
                Add Tag
              </button>
            </div>

            {tags.length > 0 && (
              <div className="create-post-tags">
                {tags.map((tag, index) => (
                  <div key={index}>
                    <span>#{tag}</span>
                    <button type="button" onClick={() => removeTag(tag)} aria-label={`Hapus tag ${tag}`}>
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="create-post-editor">
            <span>Content</span>
            <RichTextEditor value={content} onChange={setContent} />
          </div>

          {postType === "poll" && (
            <div className="create-post-poll">
              <div className="create-post-section-title">
                <h2>Polling Options</h2>
                <p>Minimal dua opsi agar polling bisa dibuat.</p>
              </div>

              <div className="create-post-poll-options">
                {pollOptions.map((option, index) => (
                  <div key={index} className="create-post-poll-option">
                    <input
                      type="text"
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => handlePollOptionChange(index, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removePollOption(index)}
                      aria-label={`Hapus option ${index + 1}`}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>

              <button className="create-post-add-option" type="button" onClick={addPollOption}>
                <FiPlus />
                Add Option
              </button>
            </div>
          )}

          <div className="create-post-actions">
            <button className="create-post-submit" type="submit">
              <FiSend />
              Post
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreatePostPage;
