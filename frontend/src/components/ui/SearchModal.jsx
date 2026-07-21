import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiX } from "react-icons/fi";
import "@/components/ui/SearchModal.css";

const defaultMovieGenres = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animasi",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Komedi",
  53: "Thriller",
  80: "Crime",
  878: "Sci-Fi",
  10749: "Romance",
};

const defaultTvGenres = {
  16: "Animasi",
  18: "Drama",
  35: "Komedi",
  80: "Crime",
  9648: "Mystery",
  10759: "Action",
  10765: "Fantasy",
};

const getYear = (date) => {
  if (!date) return "-";
  return String(date).slice(0, 4) || "-";
};

const getRating = (rating) => {
  const value = Number(rating);
  return Number.isFinite(value) && value > 0 ? value.toFixed(1) : "-";
};

const mapSearchItem = (item, type, genreLookup) => ({
  id: item.id,
  type,
  title:
    item.title ||
    item.name ||
    item.original_title ||
    item.original_name ||
    "Untitled",
  year: getYear(item.release_date || item.first_air_date),
  rating: getRating(item.vote_average),
  poster: item.poster_url,
  genre:
    (item.genre_ids || [])
      .map((genreId) => genreLookup[genreId])
      .filter(Boolean)[0] || (type === "movie" ? "Film" : "TV Series"),
  popularity: Number(item.popularity || 0),
});

function SearchModal({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [movieGenres, setMovieGenres] = useState(defaultMovieGenres);
  const [tvGenres, setTvGenres] = useState(defaultTvGenres);

  const apiUrl = import.meta.env.VITE_API_URL;

  const searchLabel = useMemo(
    () => (query.trim() ? "Hasil pencarian" : "Populer sekarang"),
    [query],
  );

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

  useEffect(() => {
    if (!open) return;

    const loadGenres = async () => {
      try {
        const [movieRes, tvRes] = await Promise.all([
          fetch(`${apiUrl}/api/movies/genres?language=id-ID`),
          fetch(`${apiUrl}/api/tv-series/genres?language=id-ID`),
        ]);
        const [movieData, tvData] = await Promise.all([
          movieRes.json(),
          tvRes.json(),
        ]);

        setMovieGenres((current) => ({
          ...current,
          ...Object.fromEntries(
            (movieData.genres || []).map((genre) => [genre.id, genre.name]),
          ),
        }));
        setTvGenres((current) => ({
          ...current,
          ...Object.fromEntries(
            (tvData.genres || []).map((genre) => [genre.id, genre.name]),
          ),
        }));
      } catch {
        setMovieGenres(defaultMovieGenres);
        setTvGenres(defaultTvGenres);
      }
    };

    loadGenres();
  }, [apiUrl, open]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const keyword = query.trim();
      setLoading(true);
      setError("");

      try {
        const movieUrl = keyword
          ? `${apiUrl}/api/movies/search?query=${encodeURIComponent(keyword)}&language=id-ID`
          : `${apiUrl}/api/movies/popular?language=id-ID&page=1`;
        const tvUrl = keyword
          ? `${apiUrl}/api/tv-series/search?query=${encodeURIComponent(keyword)}&language=id-ID`
          : `${apiUrl}/api/tv-series/popular?language=id-ID&page=1`;

        const [movieRes, tvRes] = await Promise.all([
          fetch(movieUrl, { signal: controller.signal }),
          fetch(tvUrl, { signal: controller.signal }),
        ]);

        if (!movieRes.ok || !tvRes.ok) {
          throw new Error("Gagal mencari film atau TV series");
        }

        const [movieData, tvData] = await Promise.all([
          movieRes.json(),
          tvRes.json(),
        ]);

        const nextResults = [
          ...(movieData.results || [])
            .map((item) => mapSearchItem(item, "movie", movieGenres)),
          ...(tvData.results || [])
            .map((item) => mapSearchItem(item, "tv", tvGenres)),
        ]
          .filter((item) => item.id && item.poster)
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 7);

        setResults(nextResults);
      } catch (searchError) {
        if (searchError.name !== "AbortError") {
          setResults([]);
          setError("Pencarian belum bisa dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, query.trim() ? 260 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [apiUrl, movieGenres, open, query, tvGenres]);

  if (!open) return null;

  const handleOpenResult = (item) => {
    onClose();
    setQuery("");
    navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv-series/${item.id}`);
  };

  return createPortal(
    <div
      className="flix-search-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Cari film dan TV series"
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
            placeholder="Cari Film disini..."
            aria-label="Cari film dan TV series"
          />
          <button type="button" aria-label="Tutup search" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="flix-search-modal__body">
          <div className="flix-search-modal__header">
            <span>{searchLabel}</span>
            {loading && <small>Memuat...</small>}
          </div>

          {error && <p className="flix-search-modal__status">{error}</p>}

          {!error && !loading && results.length === 0 && (
            <p className="flix-search-modal__status">
              Film atau TV series tidak ditemukan.
            </p>
          )}

          <div className="flix-search-modal__results">
            {results.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                className="flix-search-modal__result"
                onClick={() => handleOpenResult(item)}
              >
                <img src={item.poster} alt={item.title} />
                <span>
                  <strong>
                    {item.title} <em>({item.year})</em>
                  </strong>
                  <small>
                    {item.genre}
                    <i aria-hidden="true" />
                    <b>{item.type === "movie" ? "Film" : "TV Series"}</b>
                    <i aria-hidden="true" />
                    <mark>★ {item.rating}</mark>
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default SearchModal;
