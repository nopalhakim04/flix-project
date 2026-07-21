import "./rich-content.css";

function RichContent({ html }) {
  const normalizeContent = (raw) => {
    if (!raw) return "";

    return raw.replace(
      /\[GIF\](.*?)\[\/GIF\]/g,
      (_, url) =>
        `<img src="${url}" alt="GIF" class="embedded-gif" />`
    );
  };

  const handleClick = (e) => {
    const anchor = e.target.closest("a");
    if (!anchor) return;

    e.stopPropagation();

    const href = anchor.getAttribute("href");
    if (!href) return;

    const finalHref = /^https?:\/\//i.test(href) ? href : `https://${href}`;
    window.open(finalHref, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="rich-content-output"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: normalizeContent(html) }}
    />
  );
}

export default RichContent;