import { useRef, useState, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Mark } from "@tiptap/core";
import {
  FiBold,
  FiItalic,
  FiLink,
  FiImage,
  FiList,
  FiCode,
  FiEyeOff,
} from "react-icons/fi";
import { promptInput, showAlert } from "@/utils/alerts";
import "./rich-content.css";

const Spoiler = Mark.create({
  name: "spoiler",

  parseHTML() {
    return [{ tag: "span[data-spoiler]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-spoiler": "true",
        class: "spoiler-text",
      },
      0,
    ];
  },

  addCommands() {
    return {
      toggleSpoiler:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },
});

function RichTextEditor({ value, onChange }) {
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [, forceUpdate] = useState(0);

  const token = localStorage.getItem("token");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Spoiler,
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "editor-area",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const rerender = () => {
      forceUpdate((prev) => prev + 1);
    };

    editor.on("transaction", rerender);
    editor.on("selectionUpdate", rerender);
    editor.on("update", rerender);

    return () => {
      editor.off("transaction", rerender);
      editor.off("selectionUpdate", rerender);
      editor.off("update", rerender);
    };
  }, [editor]);

  if (!editor) return null;

  const normalizeUrl = (url) => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handleAddLink = async () => {
    const previousUrl = editor.getAttributes("link").href || "";
    const input = await promptInput({
      title: "Tambahkan Link",
      text: "Masukkan URL yang ingin dipasang.",
      inputValue: previousUrl,
      inputPlaceholder: "https://contoh.com",
      confirmButtonText: "Pasang Link",
    });

    if (input === null) return;

    if (input.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const finalUrl = normalizeUrl(input);

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href: finalUrl,
        target: "_blank",
        rel: "noopener noreferrer",
      })
      .run();
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showAlert({ title: "File Tidak Valid", text: "File harus berupa gambar.", icon: "error" });
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showAlert({ title: "Gambar Terlalu Besar", text: "Ukuran gambar maksimal 2 MB.", icon: "error" });
      e.target.value = "";
      return;
    }

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/uploads/editor-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal upload gambar");
      }

      const fullImageUrl = `${import.meta.env.VITE_API_URL}${data.imageUrl}`;

      editor
        .chain()
        .focus()
        .setImage({
          src: fullImageUrl,
          alt: file.name,
          title: file.name,
        })
        .createParagraphNear()
        .focus()
        .run();
    } catch (error) {
      showAlert({
        title: "Upload Gagal",
        text: error.message || "Gagal upload gambar.",
        icon: "error",
      });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const buttonStyle = {
    border: "none",
    background: "transparent",
    color: "#607b8b",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 8px",
    fontSize: "18px",
    borderRadius: "8px",
    minWidth: "34px",
    fontWeight: 600,
  };

  const activeButtonStyle = {
    ...buttonStyle,
    background: "#e9f2ff",
    color: "#111",
    outline: "1px solid #bcd6ff",
  };

  const getButtonStyle = (active) => (active ? activeButtonStyle : buttonStyle);

  const dividerStyle = {
    width: "1px",
    height: "22px",
    background: "#ddd",
    margin: "0 4px",
  };

  return (
    <div
      className="rich-content"
      style={{
        border: "1px solid #cfcfcf",
        borderRadius: "22px",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleImageFileChange}
        style={{ display: "none" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "4px",
          padding: "10px 14px",
          borderBottom: "1px solid #ececec",
          background: "#fff",
        }}
      >
        <button
          type="button"
          style={getButtonStyle(editor.isActive("heading", { level: 1 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </button>

        <button
          type="button"
          style={getButtonStyle(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>

        <button
          type="button"
          style={getButtonStyle(editor.isActive("heading", { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>

        <div style={dividerStyle} />

        <button
          type="button"
          style={getButtonStyle(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <FiBold />
        </button>

        <button
          type="button"
          style={getButtonStyle(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <FiItalic />
        </button>

        <button
          type="button"
          style={getButtonStyle(editor.isActive("strike"))}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strike"
        >
          S
        </button>

        <div style={dividerStyle} />

        <button
          type="button"
          style={getButtonStyle(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <FiList />
        </button>

        <button
          type="button"
          style={getButtonStyle(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered list"
        >
          1.
        </button>

        <button
          type="button"
          style={getButtonStyle(editor.isActive("blockquote"))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote block"
        >
          "
        </button>

        <button
          type="button"
          style={getButtonStyle(editor.isActive("codeBlock"))}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
        >
          <FiCode />
        </button>

        <button
          type="button"
          style={getButtonStyle(editor.isActive("spoiler"))}
          onClick={() => editor.chain().focus().toggleSpoiler().run()}
          title="Spoiler"
        >
          <FiEyeOff />
        </button>

        <div style={dividerStyle} />

        <button
          type="button"
          style={getButtonStyle(editor.isActive("link"))}
          onClick={handleAddLink}
          title="Link"
        >
          <FiLink />
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={handleImageUploadClick}
          title="Upload gambar"
          disabled={uploadingImage}
        >
          <FiImage />
        </button>

        <div style={{ marginLeft: "auto", color: "#111", fontSize: "14px" }}>
          {uploadingImage ? "Uploading image..." : "Editor"}
        </div>
      </div>

      <div
        style={{
          minHeight: "170px",
          padding: "18px 20px",
          color: "#111",
          position: "relative",
        }}
      >
        {!value && (
          <div
            style={{
              color: "#6b7280",
              pointerEvents: "none",
              position: "absolute",
            }}
          >
            Body text (optional)
          </div>
        )}

        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default RichTextEditor;
