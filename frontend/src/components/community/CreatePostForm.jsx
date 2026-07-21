import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { showAlert, showToast } from "@/utils/alerts";

function CreatePostPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [postType, setPostType] = useState("post");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showAlert({ title: "Gambar Terlalu Besar", text: "Ukuran gambar maksimal 2 MB.", icon: "error" });
      e.target.value = "";
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showAlert({ title: "Title Wajib Diisi", text: "Isi title sebelum membuat post.", icon: "warning" });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);
      formData.append("post_type", postType);
      formData.append("tags", JSON.stringify(tags));

      if (selectedImage) {
        formData.append("image", selectedImage);
      }

      if (postType === "poll") {
        formData.append("poll_options", JSON.stringify(pollOptions));
      }

      await axios.post(`${import.meta.env.VITE_API_URL}/api/posts`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      showToast({ title: "Post berhasil dibuat." });
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
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ marginBottom: "16px" }}
      >
        ← Kembali
      </button>

      <h1 style={{ marginBottom: "20px" }}>Create Post</h1>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setPostType("post")}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: postType === "post" ? "2px solid #ff4500" : "1px solid #ccc",
            background: "#fff"
          }}
        >
          Post
        </button>

        <button
          type="button"
          onClick={() => setPostType("poll")}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: postType === "poll" ? "2px solid #ff4500" : "1px solid #ccc",
            background: "#fff"
          }}
        >
          Polling
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "18px" }}>
          <input
            type="text"
            placeholder="Title*"
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "18px 20px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              fontSize: "18px"
            }}
          />
          <div style={{ textAlign: "right", marginTop: "8px", color: "#666" }}>
            {title.length}/300
          </div>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="Add tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc"
              }}
            />
            <button type="button" onClick={addTag}>
              Add Tag
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {tags.map((tag, index) => (
              <div
                key={index}
                style={{
                  background: "#f3f4f6",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center"
                }}
              >
                <span>#{tag}</span>
                <button type="button" onClick={() => removeTag(tag)}>
                  x
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <textarea
            placeholder="Body text (optional)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: "100%",
              minHeight: "180px",
              padding: "20px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              fontSize: "16px",
              resize: "vertical"
            }}
          />
        </div>

        {postType === "post" && (
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Upload Image (max 2 MB)
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleImageChange}
            />

            {imagePreview && (
              <div style={{ marginTop: "12px" }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    maxWidth: "250px",
                    borderRadius: "12px",
                    display: "block"
                  }}
                />
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  style={{ marginTop: "8px" }}
                >
                  Hapus Gambar
                </button>
              </div>
            )}
          </div>
        )}

        {postType === "poll" && (
          <div style={{ marginBottom: "18px" }}>
            <h3>Polling Options</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {pollOptions.map((option, index) => (
                <div key={index} style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) =>
                      handlePollOptionChange(index, e.target.value)
                    }
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #ccc"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removePollOption(index)}
                  >
                    Hapus
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addPollOption}
              style={{ marginTop: "12px" }}
            >
              + Add Option
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px"
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              padding: "12px 18px",
              borderRadius: "999px",
              border: "1px solid #ccc",
              background: "#f5f5f5"
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            style={{
              padding: "12px 18px",
              borderRadius: "999px",
              border: "none",
              background: "#ff4500",
              color: "#fff",
              fontWeight: "bold"
            }}
          >
            Post
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreatePostPage;
