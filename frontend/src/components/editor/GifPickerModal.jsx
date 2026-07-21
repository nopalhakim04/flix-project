import { useEffect, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import "./GifPickerModal.css";

function GifPickerModal({ isOpen, onClose, onSelectGif }) {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState([]);
  const apiKey = import.meta.env.VITE_GIPHY_API_KEY;

  const fetchTrending = async () => {
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=12&rating=g`,
      );
      const data = await res.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error("Gagal mengambil GIF trending:", error);
    }
  };

  const searchGifs = async (query) => {
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=12&rating=g`,
      );
      const data = await res.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error("Gagal mencari GIF:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrending();
    }
  }, [isOpen]);

  const handleSearch = (e) => {
    e.preventDefault();

    if (!search.trim()) {
      fetchTrending();
      return;
    }

    searchGifs(search);
  };

  if (!isOpen) return null;

  return (
    <div
      className="gif-picker-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="gif-picker-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gif-picker-title"
      >
        <div className="gif-picker-modal__header">
          <h3 id="gif-picker-title">Pilih GIF</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup GIF picker"
          >
            <FiX />
          </button>
        </div>

        <form
          onSubmit={handleSearch}
          className="gif-picker-modal__search"
        >
          <input
            type="text"
            placeholder="Cari GIF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" aria-label="Cari GIF">
            <FiSearch />
          </button>
        </form>

        {gifs.length > 0 ? (
          <div className="gif-picker-modal__grid">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() =>
                  onSelectGif({
                    id: gif.id,
                    url: gif.images.fixed_height.url,
                    preview: gif.images.fixed_height_small.url,
                  })
                }
              >
                <img src={gif.images.fixed_height_small.url} alt={gif.title} />
              </button>
            ))}
          </div>
        ) : (
          <div className="gif-picker-modal__empty">
            GIF belum tersedia. Coba kata kunci lain.
          </div>
        )}
      </div>
    </div>
  );
}

export default GifPickerModal;
