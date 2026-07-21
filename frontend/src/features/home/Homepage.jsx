import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBookmark,
  FaChevronLeft,
  FaChevronRight,
  FaFacebookF,
  FaPlay,
  FaRegBookmark,
  FaSlidersH,
  FaStar,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";
import SiteNavbar from "@/components/layout/SiteNavbar";
import FilterPopup from "@/components/ui/FilterPopup";
import WatchlistConfirmModal from "@/components/ui/WatchlistConfirmModal";
import { canAddWatchlistItem, hasPremiumAccess, requireLogin } from "@/utils/authPrompt";
import {
  getMoodHistoryKey,
  getMovieWatchlistKey,
  getSeriesWatchlistKey,
  readWatchlist as readStoredWatchlist,
} from "@/utils/watchlistStorage";
import menegangkanIcon from "@/assets/emoticon/menegangkan-emoticon.png";
import pikiranIcon from "@/assets/emoticon/pikiran-emoticon.png";
import romantisIcon from "@/assets/emoticon/romantis-emoticon.png";
import santaiIcon from "@/assets/emoticon/santai-emoticon.png";
import sedihIcon from "@/assets/emoticon/sedih-emoticon.png";
import seruIcon from "@/assets/emoticon/seru-emoticon.png";
import "./Homepage.css";

const fallbackHeroMovie = {
  id: "space-force",
  media_type: "movie",
  title: "Space Force",
  rating: "4.9",
  year: "2024",
  poster: "https://image.tmdb.org/t/p/w780/zgu3p4NvisS8CI68cUfBKbvAvu8.jpg",
  backdrop: "https://image.tmdb.org/t/p/original/lV6WA95QboTUQDkFWjP3wI9U8xp.jpg",
  overview: "Sekelompok orang menjalankan cabang baru angkatan bersenjata dengan misi besar dan situasi yang tidak selalu berjalan sesuai rencana.",
  genre_ids: [35],
};

const moods = [
  { id: "santai", label: "Santai", icon: santaiIcon, genre: "35|10751|16", tvGenre: "35|10751|16" },
  { id: "seru", label: "Seru", icon: seruIcon, genre: "28|12", tvGenre: "10759" },
  { id: "sedih", label: "Sedih", icon: sedihIcon, genre: "18", tvGenre: "18" },
  { id: "menegangkan", label: "Menegangkan", icon: menegangkanIcon, genre: "53|27", tvGenre: "9648|80" },
  { id: "romantis", label: "Romantis", icon: romantisIcon, genre: "10749", tvGenre: "18|10766" },
  { id: "pikiran", label: "Pikiran", icon: pikiranIcon, genre: "878|9648", tvGenre: "10765|9648" },
];

const fallbackPosterUrl = "https://image.tmdb.org/t/p/w500/cdPSUck4tBRvRu6DFk6XciDrssn.jpg";
const fallbackBackdropUrl = "https://image.tmdb.org/t/p/original/tiIpajUBpLMNWMEzpjRBxo0jCbD.jpg";

const defaultGenreLookup = {
  12: "Petualangan",
  14: "Fantasi",
  16: "Animasi",
  18: "Drama",
  27: "Horor",
  28: "Aksi",
  35: "Komedi",
  53: "Thriller",
  878: "Sci-Fi",
  9648: "Misteri",
  10749: "Romantis",
  10751: "Keluarga",
};

const mediaFilterOptions = [
  { value: "all", label: "Semua" },
  { value: "tv", label: "TV Series" },
  { value: "movie", label: "Film" },
];

const categoryFilterOptions = [
  { value: "all", label: "Semua" },
  { value: "adult", label: "Dewasa" },
  { value: "children", label: "Anak-anak" },
  { value: "teen", label: "Remaja" },
];

const platformFilterOptions = [
  { value: "all", label: "Semua" },
  { value: "netflix", label: "Netflix" },
  { value: "disney", label: "Disney+" },
  { value: "prime", label: "Prime Video" },
  { value: "vidio", label: "Vidio" },
  { value: "viu", label: "Viu" },
  { value: "wetv", label: "WeTV" },
  { value: "hbo", label: "HBO Max" },
  { value: "apple", label: "Apple TV" },
  { value: "catchplay", label: "Catchplay" },
];

const platformMatchers = {
  netflix: ["netflix"],
  disney: ["disney", "hotstar"],
  prime: ["prime video", "amazon"],
  vidio: ["vidio"],
  viu: ["viu"],
  wetv: ["wetv", "we tv"],
  hbo: ["hbo", "max"],
  apple: ["apple tv"],
  catchplay: ["catchplay"],
};

const movieSortOptions = [
  { value: "latest", label: "Terbaru" },
  { value: "za", label: "Z - A" },
  { value: "az", label: "A - Z" },
  { value: "rating", label: "Rating Tertinggi" },
];

const defaultFilterValues = {
  media: "movie",
  category: "all",
  platform: "all",
  year: "all",
  sort: "latest",
};

const getYearFilterOptions = () => {
  const currentYear = new Date().getFullYear();

  return [
    { value: "all", label: "Semua" },
    ...Array.from({ length: 8 }, (_, index) => {
      const year = String(currentYear - index);
      return { value: year, label: year };
    }),
  ];
};

const getMediaType = (mediaType) => (mediaType === "tv" ? "tv" : "movie");

const getFilterMediaTypes = (mediaFilter) =>
  mediaFilter === "all" ? ["movie", "tv"] : [getMediaType(mediaFilter)];

const getProviderCacheKey = (mediaType, mediaId) =>
  `${getMediaType(mediaType)}:${mediaId}`;

const categoryGenreGroups = {
  adult: {
    movie: ["18", "27", "28", "36", "53", "80", "9648", "10752"],
    tv: ["18", "80", "9648", "10768"],
  },
  children: {
    movie: ["16", "10751"],
    tv: ["16", "10751", "10762"],
  },
  teen: {
    movie: ["12", "14", "35", "878", "10749"],
    tv: ["35", "10759", "10765", "10766"],
  },
};

const matchesCategoryFilter = (mediaItem, category) => {
  if (category === "all") {
    return true;
  }

  const mediaType = getMediaType(mediaItem.media_type);
  const categoryGenres = categoryGenreGroups[category]?.[mediaType] || [];
  const itemGenreIds = (mediaItem.genre_ids || []).map((genreId) =>
    String(genreId),
  );

  return categoryGenres.some((genreId) => itemGenreIds.includes(genreId));
};

const fallbackMovies = Array.from({ length: 8 }, (_, index) => ({
  id: `fallback-${index + 1}`,
  media_type: "movie",
  title: "Cargo",
  year: "2023",
  rating: "4.9",
  poster: fallbackPosterUrl,
  backdrop: fallbackBackdropUrl,
  overview: "Seorang ayah berusaha melindungi bayinya dalam perjalanan penuh risiko setelah wabah mengubah dunia menjadi tempat yang berbahaya.",
  genre_ids: [18, 53],
}));

const heroMovieLimit = 4;

const getMovieYear = (date) => date?.slice(0, 4) || "-";

const getMovieRating = (voteAverage) => {
  const numericRating = Number(voteAverage);

  if (!Number.isFinite(numericRating) || numericRating <= 0) {
    return "-";
  }

  return (numericRating / 2).toFixed(1);
};

const getShortOverview = (overview) => {
  const cleanOverview = overview?.trim();

  if (!cleanOverview) {
    return "Deskripsi belum tersedia.";
  }

  if (cleanOverview.length <= 96) {
    return cleanOverview;
  }

  return `${cleanOverview.slice(0, 93).trim()}...`;
};

const getProviderNames = (watchProviders = {}) => {
  const providers = [
    ...(watchProviders.all || []),
    ...(watchProviders.flatrate || []),
    ...(watchProviders.free || []),
    ...(watchProviders.ads || []),
    ...(watchProviders.rent || []),
    ...(watchProviders.buy || []),
  ];

  return [...new Set(providers.map((provider) => provider.provider_name || ""))]
    .map((providerName) => providerName.toLowerCase())
    .filter(Boolean);
};

const matchesPlatformFilter = (watchProviders, selectedPlatform) => {
  if (selectedPlatform === "all") {
    return true;
  }

  const keywords = platformMatchers[selectedPlatform] || [selectedPlatform];
  return getProviderNames(watchProviders).some((providerName) =>
    keywords.some((keyword) => providerName.includes(keyword)),
  );
};

const getRatingSortScore = (rating) => {
  const score = Number(rating);
  return Number.isFinite(score) ? score : 0;
};

const sortMovieList = (movies, sortKey) => {
  const sortedMovies = [...movies];

  if (sortKey === "az") {
    return sortedMovies.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (sortKey === "za") {
    return sortedMovies.sort((a, b) => b.title.localeCompare(a.title));
  }

  if (sortKey === "rating") {
    return sortedMovies.sort(
      (a, b) => getRatingSortScore(b.rating) - getRatingSortScore(a.rating),
    );
  }

  return sortedMovies.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
};

const applyMovieFilters = (movies, filters, providersByMovieId) => {
  const filteredMovies = movies.filter((movie) => {
    const mediaType = getMediaType(movie.media_type);
    const providerKey = getProviderCacheKey(mediaType, movie.id);
    const matchesMedia = filters.media === "all" || mediaType === filters.media;
    const matchesCategory = matchesCategoryFilter(movie, filters.category);
    const matchesYear = filters.year === "all" || String(movie.year) === filters.year;
    const hasLoadedProvider = Object.prototype.hasOwnProperty.call(
      providersByMovieId,
      providerKey,
    );
    const matchesPlatform =
      filters.platform === "all" ||
      !hasLoadedProvider ||
      matchesPlatformFilter(providersByMovieId[providerKey], filters.platform);

    return matchesMedia && matchesCategory && matchesYear && matchesPlatform;
  });

  return sortMovieList(filteredMovies, filters.sort);
};

const mapTmdbMovie = (movie) => ({
  id: movie.id,
  media_type: "movie",
  title: movie.title || movie.original_title || "Untitled",
  year: getMovieYear(movie.release_date),
  rating: getMovieRating(movie.vote_average),
  poster: movie.poster_url,
  backdrop: movie.backdrop_url,
  overview: getShortOverview(movie.overview),
  genre_ids: movie.genre_ids || [],
});

const mapTmdbSeries = (series) => ({
  id: series.id,
  media_type: "tv",
  title: series.title || series.name || series.original_name || "Untitled",
  year: getMovieYear(series.first_air_date),
  rating: getMovieRating(series.vote_average),
  poster: series.poster_url,
  backdrop: series.backdrop_url,
  overview: getShortOverview(series.overview),
  genre_ids: series.genre_ids || [],
});

const uniqueById = (movies) => {
  const seen = new Set();

  return movies.filter((movie) => {
    const mediaKey = `${movie.media_type || "movie"}:${movie.id}`;

    if (!movie.id || seen.has(mediaKey) || !movie.poster) {
      return false;
    }

    seen.add(mediaKey);
    return true;
  });
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

function Homepage() {
  const navigate = useNavigate();
  const moodScrollerRef = useRef(null);
  const user = useMemo(() => getStoredUser(), []);
  const watchlistKey = useMemo(() => getMovieWatchlistKey(user), [user]);
  const seriesWatchlistKey = useMemo(() => getSeriesWatchlistKey(user), [user]);

  const [selectedMood, setSelectedMood] = useState(moods[0]);
  const [hitMovies, setHitMovies] = useState([fallbackHeroMovie, ...fallbackMovies]);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [moodMovies, setMoodMovies] = useState(fallbackMovies);
  const [watchlist, setWatchlist] = useState(() => readStoredWatchlist(user, "movie"));
  const [seriesWatchlist, setSeriesWatchlist] = useState(() =>
    readStoredWatchlist(user, "tv"),
  );
  const [pendingWatchlistMovie, setPendingWatchlistMovie] = useState(null);
  const [providersByMovieId, setProvidersByMovieId] = useState({});
  const [filterValues, setFilterValues] = useState(defaultFilterValues);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [moodLoading, setMoodLoading] = useState(true);
  const [moodError, setMoodError] = useState("");
  const [genreLookup, setGenreLookup] = useState(defaultGenreLookup);

  const yearFilterOptions = useMemo(() => getYearFilterOptions(), []);
  const recommendationFilterSections = useMemo(
    () => [
      { key: "media", title: "Tipe", options: mediaFilterOptions },
      { key: "category", title: "Kategori", options: categoryFilterOptions },
      { key: "platform", title: "Platform", options: platformFilterOptions },
      { key: "year", title: "Tahun", options: yearFilterOptions },
      { key: "sort", title: "Urutkan Berdasarkan", options: movieSortOptions },
    ],
    [yearFilterOptions],
  );
  const filteredMoodMovies = applyMovieFilters(
    moodMovies,
    filterValues,
    providersByMovieId,
  );
  const savedMovieIds = useMemo(
    () => new Set(watchlist.map((movie) => String(movie.id))),
    [watchlist],
  );
  const savedSeriesIds = useMemo(
    () => new Set(seriesWatchlist.map((series) => String(series.id))),
    [seriesWatchlist],
  );

  const recordMoodSelection = (mood) => {
    const moodHistoryKey = getMoodHistoryKey(user);

    try {
      const currentHistory = JSON.parse(localStorage.getItem(moodHistoryKey)) || {};
      localStorage.setItem(
        moodHistoryKey,
        JSON.stringify({
          ...currentHistory,
          [mood.id]: Number(currentHistory[mood.id] || 0) + 1,
        }),
      );
    } catch {
      localStorage.setItem(moodHistoryKey, JSON.stringify({ [mood.id]: 1 }));
    }
  };

  const handleSelectMood = (mood) => {
    setSelectedMood(mood);
    recordMoodSelection(mood);
  };

  useEffect(() => {
    localStorage.setItem(watchlistKey, JSON.stringify(watchlist));
  }, [watchlist, watchlistKey]);

  useEffect(() => {
    localStorage.setItem(seriesWatchlistKey, JSON.stringify(seriesWatchlist));
  }, [seriesWatchlist, seriesWatchlistKey]);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const [movieResponse, seriesResponse] = await Promise.all([
          fetch(`${apiUrl}/api/movies/genres?language=id-ID`),
          fetch(`${apiUrl}/api/tv-series/genres?language=id-ID`),
        ]);

        if (!movieResponse.ok && !seriesResponse.ok) {
          throw new Error("Gagal mengambil genre");
        }

        const movieData = movieResponse.ok ? await movieResponse.json() : { genres: [] };
        const seriesData = seriesResponse.ok
          ? await seriesResponse.json()
          : { genres: [] };
        const genres = Object.fromEntries(
          [...(movieData.genres || []), ...(seriesData.genres || [])].map((genre) => [
            genre.id,
            genre.name,
          ])
        );

        setGenreLookup({
          ...defaultGenreLookup,
          ...genres,
        });
      } catch {
        setGenreLookup(defaultGenreLookup);
      }
    };

    fetchGenres();
  }, []);

  useEffect(() => {
    const fetchHitMovies = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const [nowPlayingResponse, trendingResponse] = await Promise.all([
          fetch(`${apiUrl}/api/movies/now-playing?region=ID&language=id-ID`),
          fetch(`${apiUrl}/api/movies/trending?time_window=week&language=id-ID`),
        ]);

        if (!nowPlayingResponse.ok && !trendingResponse.ok) {
          throw new Error("Gagal mengambil film hits");
        }

        const nowPlayingData = nowPlayingResponse.ok
          ? await nowPlayingResponse.json()
          : { results: [] };
        const trendingData = trendingResponse.ok
          ? await trendingResponse.json()
          : { results: [] };

        const movies = uniqueById([
          ...(nowPlayingData.results || []),
          ...(trendingData.results || []),
        ].map(mapTmdbMovie)).slice(0, heroMovieLimit);

        if (movies.length > 0) {
          setHitMovies(movies);
          setActiveHeroIndex(0);
        }
      } catch {
        setHitMovies([fallbackHeroMovie, ...fallbackMovies].slice(0, heroMovieLimit));
      }
    };

    fetchHitMovies();
  }, []);

  useEffect(() => {
    if (hitMovies.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveHeroIndex((currentIndex) => (currentIndex + 1) % hitMovies.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [hitMovies]);

  useEffect(() => {
    const fetchMoodMovies = async () => {
      try {
        setMoodLoading(true);
        setMoodError("");

        const apiUrl = import.meta.env.VITE_API_URL;
        const mediaTypes = getFilterMediaTypes(filterValues.media);
        const yearParam =
          filterValues.year === "all" ? "" : `&year=${encodeURIComponent(filterValues.year)}`;
        const mediaResponses = await Promise.all(
          mediaTypes.map(async (mediaType) => {
            const endpoint = mediaType === "tv" ? "tv-series" : "movies";
            const moodGenre = mediaType === "tv" ? selectedMood.tvGenre : selectedMood.genre;
            const response = await fetch(
              `${apiUrl}/api/${endpoint}/discover?genre=${encodeURIComponent(
                moodGenre
              )}&sort_by=popularity.desc&language=id-ID&page=1${yearParam}`
            );

            if (!response.ok) {
              throw new Error("Gagal mengambil rekomendasi mood");
            }

            const data = await response.json();
            return { data, mediaType };
          }),
        );

        const movies = uniqueById(
          mediaResponses.flatMap(({ data, mediaType }) =>
            (data.results || []).map((item) =>
              mediaType === "tv" ? mapTmdbSeries(item) : mapTmdbMovie(item),
            ),
          ),
        ).slice(0, 16);

        setMoodMovies(movies);
        moodScrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      } catch {
        setMoodError("Rekomendasi mood belum bisa dimuat, menampilkan data contoh.");
        setMoodMovies(
          fallbackMovies.map((movie) => ({
            ...movie,
            media_type: getFilterMediaTypes(filterValues.media)[0] || "movie",
          })),
        );
      } finally {
        setMoodLoading(false);
      }
    };

    fetchMoodMovies();
  }, [filterValues.media, filterValues.year, selectedMood]);

  useEffect(() => {
    const missingMediaItems = moodMovies
      .map((movie) => ({
        id: String(movie.id),
        mediaType: getMediaType(movie.media_type),
      }))
      .filter(
        ({ id, mediaType }) =>
          Number.isInteger(Number(id)) &&
          !Object.prototype.hasOwnProperty.call(
            providersByMovieId,
            getProviderCacheKey(mediaType, id),
          ),
      );

    if (missingMediaItems.length === 0) {
      return undefined;
    }

    let shouldIgnore = false;

    const loadMovieProviders = async () => {
      const providerEntries = await Promise.all(
        missingMediaItems.map(async ({ id, mediaType }) => {
          const endpoint = mediaType === "tv" ? "tv-series" : "movies";
          const providerKey = getProviderCacheKey(mediaType, id);

          try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const response = await fetch(
              `${apiUrl}/api/${endpoint}/${id}/watch-providers`,
            );

            if (!response.ok) {
              throw new Error("Gagal mengambil provider");
            }

            const data = await response.json();
            return [providerKey, data];
          } catch {
            return [providerKey, { all: [] }];
          }
        }),
      );

      if (!shouldIgnore) {
        setProvidersByMovieId((currentProviders) => ({
          ...currentProviders,
          ...Object.fromEntries(providerEntries),
        }));
      }
    };

    loadMovieProviders();

    return () => {
      shouldIgnore = true;
    };
  }, [moodMovies, providersByMovieId]);

  const moveHero = (direction) => {
    setActiveHeroIndex((currentIndex) => {
      const totalMovies = hitMovies.length || 1;
      return (currentIndex + direction + totalMovies) % totalMovies;
    });
  };

  const heroMovies = hitMovies.slice(0, heroMovieLimit);
  const currentHeroMovie = heroMovies[activeHeroIndex] || fallbackHeroMovie;
  const heroBackdrop = currentHeroMovie.backdrop || fallbackHeroMovie.backdrop;
  const openMovieDetail = (movieId, mediaType = "movie") => {
    if (Number.isInteger(Number(movieId))) {
      navigate(getMediaType(mediaType) === "tv" ? `/tv-series/${movieId}` : `/movie/${movieId}`);
    }
  };

  const isMediaSaved = (mediaItem) => {
    const mediaId = String(mediaItem.id);

    return getMediaType(mediaItem.media_type) === "tv"
      ? savedSeriesIds.has(mediaId)
      : savedMovieIds.has(mediaId);
  };

  const saveMediaToWatchlist = (mediaItem) => {
    const mediaType = getMediaType(mediaItem.media_type);
    const listSetter = mediaType === "tv" ? setSeriesWatchlist : setWatchlist;

    listSetter((currentWatchlist) => {
      const mediaId = String(mediaItem.id);

      if (currentWatchlist.some((savedItem) => String(savedItem.id) === mediaId)) {
        return currentWatchlist;
      }

      const nextWatchlist = [{ ...mediaItem, media_type: mediaType }, ...currentWatchlist];
      return hasPremiumAccess() ? nextWatchlist : nextWatchlist.slice(0, 20);
    });
  };

  const toggleWatchlist = (mediaItem) => {
    if (!requireLogin()) {
      return;
    }

    const mediaType = getMediaType(mediaItem.media_type);
    const mediaId = String(mediaItem.id);

    if (isMediaSaved(mediaItem)) {
      const listSetter = mediaType === "tv" ? setSeriesWatchlist : setWatchlist;

      listSetter((currentWatchlist) =>
        currentWatchlist.filter((savedItem) => String(savedItem.id) !== mediaId),
      );
      return;
    }

    if (canAddWatchlistItem(watchlist, seriesWatchlist)) {
      setPendingWatchlistMovie({ ...mediaItem, media_type: mediaType });
    }
  };

  const confirmSaveToWatchlist = () => {
    if (pendingWatchlistMovie) {
      saveMediaToWatchlist(pendingWatchlistMovie);
    }

    setPendingWatchlistMovie(null);
  };

  return (
    <main className="homepage">
      <SiteNavbar mode="absolute" activeKey="home" />

      <section
        className="homepage-hero"
        style={{ "--hero-backdrop": `url(${heroBackdrop})` }}
      >
        <div className="homepage-hero-inner">
          <div className="homepage-copy">
            <div className="homepage-kicker">
              <span />
              WEBSITE REKOMENDASI FILM
            </div>

            <h1>
              Temukan Film
              <br />
              yang <strong>Tepat</strong>
              <br />
              untuk Harimu
            </h1>

            <p>
              Pilih suasana hatimu sekarang! FLIX akan merekomendasikan film &amp;
              series terbaik yang sesuai perasaanmu.
            </p>

            <div className="homepage-hero-buttons">
              <a className="homepage-primary-btn" href="#mood">
                <FaPlay />
                Pilih Mood
              </a>
              <button
                className="homepage-secondary-btn"
                type="button"
                onClick={() => {
                  if (!requireLogin()) {
                    return;
                  }

                  navigate("/watchlist");
                }}
              >
                Lihat Watchlist
              </button>
            </div>
          </div>

          <div className="homepage-feature-wrap">
            <article
              className="homepage-feature-card"
              role="button"
              tabIndex={0}
              onClick={() =>
                openMovieDetail(currentHeroMovie.id, currentHeroMovie.media_type)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  openMovieDetail(currentHeroMovie.id, currentHeroMovie.media_type);
                }
              }}
            >
              <div className="homepage-feature-poster">
                <img src={currentHeroMovie.poster} alt={currentHeroMovie.title} />
              </div>
              <div className="homepage-feature-meta">
                <span>
                  <FaStar />
                  {currentHeroMovie.rating}
                </span>
                <span>{currentHeroMovie.year}</span>
              </div>
              <h2>{currentHeroMovie.title}</h2>
            </article>

            <div className="homepage-feature-controls">
              <button
                className="homepage-hero-arrow"
                type="button"
                onClick={() => moveHero(-1)}
                aria-label="Film hits sebelumnya"
              >
                <FaChevronLeft />
              </button>

              <div className="homepage-dots" aria-label="Pilih film hits">
                {heroMovies.map((movie, index) => (
                  <button
                    className={activeHeroIndex === index ? "is-active" : ""}
                    key={movie.id}
                    type="button"
                    onClick={() => setActiveHeroIndex(index)}
                    aria-label={`Tampilkan ${movie.title}`}
                  />
                ))}
              </div>

              <button
                className="homepage-hero-arrow"
                type="button"
                onClick={() => moveHero(1)}
                aria-label="Film hits berikutnya"
              >
                <FaChevronRight />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="homepage-mood-section" id="mood">
        <div className="homepage-section-header">
          <div className="homepage-section-kicker">
            <span />
            PILIH MOOD
          </div>
          <h2>
            Bagaimana <strong>Mood Mu</strong> Hari Ini?
          </h2>
          <p>Pilih suasana hatimu - kami siapkan tontonan yang pas</p>
        </div>

        <div className="homepage-mood-grid">
          {moods.map((mood) => (
            <button
              className={`homepage-mood-card ${
                selectedMood.id === mood.id ? "is-selected" : ""
              }`}
              key={mood.id}
              type="button"
              onClick={() => handleSelectMood(mood)}
            >
              <span className="homepage-mood-icon">
                <img src={mood.icon} alt="" aria-hidden="true" />
              </span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="homepage-recommendations" id="recommendations">
        <div className="homepage-recommendation-top">
          <div className="homepage-recommendation-label">
            Rekomendasi Film Untuk Mood {selectedMood.label}
          </div>
          <div className="homepage-recommendation-actions">
            <button
              className="homepage-filter"
              type="button"
              onClick={() => setIsFilterOpen(true)}
            >
              <FaSlidersH />
              Filter
            </button>
          </div>
        </div>

        {moodError && <p className="homepage-movie-status">{moodError}</p>}
        {moodLoading && <p className="homepage-movie-status">Memuat rekomendasi mood...</p>}
        {!moodLoading && filteredMoodMovies.length === 0 && (
          <p className="homepage-movie-status">
            Tidak ada film yang cocok dengan filter ini.
          </p>
        )}

        <div className="homepage-movie-carousel" ref={moodScrollerRef}>
          {filteredMoodMovies.map((movie) => {
            const movieGenres = (movie.genre_ids || [])
              .map((genreId) => genreLookup[genreId])
              .filter(Boolean)
              .slice(0, 2);

            return (
              <article
                className="homepage-movie-card"
                key={`${movie.media_type || "movie"}-${movie.id}`}
                role="button"
                tabIndex={0}
                onClick={() => openMovieDetail(movie.id, movie.media_type)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    openMovieDetail(movie.id, movie.media_type);
                  }
                }}
              >
                <div className="homepage-movie-poster">
                  <img src={movie.poster} alt={movie.title} />
                  <button
                    type="button"
                    aria-label={
                      isMediaSaved(movie)
                        ? `Hapus ${movie.title} dari watchlist`
                        : `Simpan ${movie.title}`
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleWatchlist(movie);
                    }}
                  >
                    {isMediaSaved(movie) ? (
                      <FaBookmark />
                    ) : (
                      <FaRegBookmark />
                    )}
                  </button>
                  <div className="homepage-movie-overlay" aria-hidden="true">
                    <div className="homepage-movie-genres">
                      {(movieGenres.length > 0 ? movieGenres : ["Film"]).map((genre) => (
                        <span key={genre}>{genre}</span>
                      ))}
                    </div>
                    <p>{getShortOverview(movie.overview)}</p>
                  </div>
                </div>
                <h3>{movie.title}</h3>
                <p>
                  {movie.year}
                  <span>
                    <FaStar />
                    {movie.rating}
                  </span>
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="homepage-footer">
        <nav aria-label="Footer navigation">
          <Link to="/">Home</Link>
          <Link to="/movies">Movie</Link>
          <Link to="/tv-series">TV Series</Link>
          <Link to="/genre">Genre</Link>
          <Link to="/community">Community</Link>
          <Link to="/contact-us">Contact Us</Link>
        </nav>
        <div className="homepage-socials">
          <FaFacebookF />
          <FaTwitter />
          <FaYoutube />
        </div>
        <p>Copyright 2026 - Kelompok 5</p>
      </footer>

      <FilterPopup
        open={isFilterOpen}
        title="Filter Rekomendasi"
        values={filterValues}
        sections={recommendationFilterSections}
        onChange={setFilterValues}
        onClose={() => setIsFilterOpen(false)}
      />

      <WatchlistConfirmModal
        open={Boolean(pendingWatchlistMovie)}
        item={pendingWatchlistMovie}
        mediaLabel={pendingWatchlistMovie?.media_type === "tv" ? "Series" : "Film"}
        onCancel={() => setPendingWatchlistMovie(null)}
        onConfirm={confirmSaveToWatchlist}
      />
    </main>
  );
}

export default Homepage;
