import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBookmark,
  FaChevronLeft,
  FaChevronRight,
  FaFacebookF,
  FaFilter,
  FaPlay,
  FaRegBookmark,
  FaSearch,
  FaShareAlt,
  FaStar,
  FaTimes,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";
import SiteNavbar from "@/components/layout/SiteNavbar";
import FilterPopup from "@/components/ui/FilterPopup";
import WatchlistConfirmModal from "@/components/ui/WatchlistConfirmModal";
import { canAddWatchlistItem, hasPremiumAccess, requireLogin } from "@/utils/authPrompt";
import {
  getMovieWatchlistKey,
  getSeriesWatchlistKey,
  readWatchlist as readStoredWatchlist,
} from "@/utils/watchlistStorage";
import { promptInput, showAlert } from "@/utils/alerts";
import amazonPrimeVideoIcon from "@/assets/platformstream-logo/amazonprimevideo-icon.png";
import appleTvIcon from "@/assets/platformstream-logo/appletv-icon.png";
import catchplayIcon from "@/assets/platformstream-logo/catchplay-icon.png";
import disneyHotstarIcon from "@/assets/platformstream-logo/disneyhotstar-icon.png";
import hboMaxIcon from "@/assets/platformstream-logo/HBOmax-icon.png";
import netflixIcon from "@/assets/platformstream-logo/netflix-icon.png";
import "./MoviesPage.css";

const apiUrl = import.meta.env.VITE_API_URL;

const fallbackPosterUrl =
  "https://image.tmdb.org/t/p/w500/cdPSUck4tBRvRu6DFk6XciDrssn.jpg";
const fallbackBackdropUrl =
  "https://image.tmdb.org/t/p/original/tiIpajUBpLMNWMEzpjRBxo0jCbD.jpg";

const fallbackMovies = Array.from({ length: 10 }, (_, index) => ({
  id: `fallback-${index + 1}`,
  media_type: "movie",
  title: "Cargo",
  year: "2023",
  rating: "4.9",
  poster: fallbackPosterUrl,
  backdrop: fallbackBackdropUrl,
  overview:
    "Seorang ayah berusaha melindungi bayinya dalam perjalanan penuh risiko setelah wabah mengubah dunia.",
  releaseLabel: "15 February 2024",
  genre_ids: [18, 53],
}));

const defaultGenreLookup = {
  12: "Petualangan",
  14: "Fantasi",
  16: "Animasi",
  18: "Drama",
  27: "Horor",
  28: "Aksi",
  35: "Komedi",
  53: "Thriller",
  80: "Kriminal",
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

const providerIconMatchers = [
  {
    icon: netflixIcon,
    matches: ["netflix"],
  },
  {
    icon: disneyHotstarIcon,
    matches: ["disney", "hotstar"],
  },
  {
    icon: hboMaxIcon,
    matches: ["hbo", "max"],
  },
  {
    icon: catchplayIcon,
    matches: ["catchplay"],
  },
  {
    icon: appleTvIcon,
    matches: ["apple tv"],
  },
  {
    icon: amazonPrimeVideoIcon,
    matches: ["amazon", "prime video"],
  },
];

const getLocalProviderIcon = (providerName = "") => {
  const normalizedName = providerName.toLowerCase();
  const match = providerIconMatchers.find(({ matches }) =>
    matches.some((keyword) => normalizedName.includes(keyword)),
  );

  return match?.icon || null;
};

const getMovieYear = (date) => date?.slice(0, 4) || "-";

const formatReleaseDate = (date) => {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
};

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
    return "Deskripsi film belum tersedia.";
  }

  if (cleanOverview.length <= 160) {
    return cleanOverview;
  }

  return `${cleanOverview.slice(0, 157).trim()}...`;
};

const getProviderLogos = (watchProviders) => {
  const preferredProviders =
    watchProviders?.flatrate?.length > 0
      ? watchProviders.flatrate
      : watchProviders?.all || [];
  const seenProviderKeys = new Set();

  return preferredProviders
    .map((provider) => {
      const localIcon = getLocalProviderIcon(provider.provider_name);
      const icon = localIcon || provider.logo_url;
      const providerKey = localIcon || provider.provider_id || provider.provider_name;

      return {
        id: provider.provider_id,
        name: provider.provider_name,
        icon,
        providerKey,
      };
    })
    .filter((provider) => {
      if (!provider.icon || seenProviderKeys.has(provider.providerKey)) {
        return false;
      }

      seenProviderKeys.add(provider.providerKey);
      return true;
    })
    .slice(0, 4);
};

const getTrailerUrl = (videos = []) => {
  const youtubeVideos = videos.filter((video) => video.youtube_url);
  const trailer =
    youtubeVideos.find(
      (video) => video.official && video.type?.toLowerCase() === "trailer",
    ) ||
    youtubeVideos.find((video) => video.type?.toLowerCase() === "trailer") ||
    youtubeVideos.find((video) => video.type?.toLowerCase() === "teaser") ||
    youtubeVideos[0];

  return trailer?.youtube_url || null;
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
  backdrop: movie.backdrop_url || movie.poster_url,
  overview: getShortOverview(movie.overview),
  releaseLabel: formatReleaseDate(movie.release_date),
  providers: [],
  genre_ids: movie.genre_ids || [],
});

const mapTmdbSeries = (series) => ({
  id: series.id,
  media_type: "tv",
  title: series.title || series.name || series.original_name || "Untitled",
  year: getMovieYear(series.first_air_date),
  rating: getMovieRating(series.vote_average),
  poster: series.poster_url,
  backdrop: series.backdrop_url || series.poster_url,
  overview: getShortOverview(series.overview),
  releaseLabel: formatReleaseDate(series.first_air_date),
  providers: [],
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

function MovieCard({
  movie,
  isSaved,
  onOpen,
  onToggleWatchlist,
  genreLookup = defaultGenreLookup,
  removeMode = false,
}) {
  const mediaType = getMediaType(movie.media_type);
  const movieGenres = (movie.genre_ids || [])
    .map((genreId) => genreLookup[genreId])
    .filter(Boolean)
    .slice(0, 2);

  return (
    <article className="movies-card" onClick={() => onOpen(movie.id, mediaType)}>
      <div className="movies-card-poster">
        <img src={movie.poster} alt={movie.title} />
        <button
          className="movies-card-save"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleWatchlist(movie);
          }}
          aria-label={
            isSaved ? `Hapus ${movie.title} dari watchlist` : `Simpan ${movie.title}`
          }
        >
          {removeMode ? <FaTimes /> : isSaved ? <FaBookmark /> : <FaRegBookmark />}
        </button>
        <div className="movies-card-overlay" aria-hidden="true">
          <div className="movies-card-genres">
            {(movieGenres.length > 0
              ? movieGenres
              : [mediaType === "tv" ? "TV Series" : "Film"]
            ).map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
          <p>{getShortOverview(movie.overview)}</p>
        </div>
      </div>
      <h3>{movie.title}</h3>
      <p>
        {movie.year}
        <span />
        <strong>
          <FaStar />
          {movie.rating}
        </strong>
      </p>
    </article>
  );
}

function MoviesPage() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const watchlistKey = useMemo(() => getMovieWatchlistKey(user), [user]);
  const seriesWatchlistKey = useMemo(() => getSeriesWatchlistKey(user), [user]);
  const [watchlist, setWatchlist] = useState(() => readStoredWatchlist(user, "movie"));
  const [seriesWatchlist, setSeriesWatchlist] = useState(() =>
    readStoredWatchlist(user, "tv"),
  );
  const [pendingWatchlistMovie, setPendingWatchlistMovie] = useState(null);
  const [trendingMovies, setTrendingMovies] = useState(fallbackMovies.slice(0, 3));
  const [allMovies, setAllMovies] = useState(fallbackMovies);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [heroProvidersByMovieId, setHeroProvidersByMovieId] = useState({});
  const [heroTrailerUrls, setHeroTrailerUrls] = useState({});
  const [providersByMovieId, setProvidersByMovieId] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValues, setFilterValues] = useState(defaultFilterValues);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [genreLookup, setGenreLookup] = useState(defaultGenreLookup);
  const [loading, setLoading] = useState(true);

  const yearFilterOptions = useMemo(() => getYearFilterOptions(), []);
  const movieFilterSections = useMemo(
    () => [
      { key: "media", title: "Tipe", options: mediaFilterOptions },
      { key: "category", title: "Kategori", options: categoryFilterOptions },
      { key: "platform", title: "Platform", options: platformFilterOptions },
      { key: "year", title: "Tahun", options: yearFilterOptions },
      { key: "sort", title: "Urutkan Berdasarkan", options: movieSortOptions },
    ],
    [yearFilterOptions],
  );
  const savedMovieIds = useMemo(
    () => new Set(watchlist.map((movie) => String(movie.id))),
    [watchlist],
  );
  const savedSeriesIds = useMemo(
    () => new Set(seriesWatchlist.map((series) => String(series.id))),
    [seriesWatchlist],
  );

  const heroMovies = trendingMovies.slice(0, 4);
  const activeHeroMovie = heroMovies[activeHeroIndex] || heroMovies[0] || fallbackMovies[0];
  const activeHeroProviders =
    heroProvidersByMovieId[activeHeroMovie.id] || activeHeroMovie.providers || [];
  const hasLoadedActiveHeroProviders = Object.prototype.hasOwnProperty.call(
    heroProvidersByMovieId,
    activeHeroMovie.id,
  );
  const searchedAllMovies = allMovies.filter((movie) =>
    movie.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const filteredAllMovies = applyMovieFilters(
    searchedAllMovies,
    filterValues,
    providersByMovieId,
  );

  useEffect(() => {
    localStorage.setItem(watchlistKey, JSON.stringify(watchlist));
  }, [watchlist, watchlistKey]);

  useEffect(() => {
    localStorage.setItem(seriesWatchlistKey, JSON.stringify(seriesWatchlist));
  }, [seriesWatchlist, seriesWatchlistKey]);

  useEffect(() => {
    const loadGenres = async () => {
      try {
        const [movieResponse, seriesResponse] = await Promise.all([
          fetch(`${apiUrl}/api/movies/genres?language=id-ID`),
          fetch(`${apiUrl}/api/tv-series/genres?language=id-ID`),
        ]);

        if (!movieResponse.ok && !seriesResponse.ok) {
          return;
        }

        const movieData = movieResponse.ok ? await movieResponse.json() : { genres: [] };
        const seriesData = seriesResponse.ok ? await seriesResponse.json() : { genres: [] };
        const genres = Object.fromEntries(
          [...(movieData.genres || []), ...(seriesData.genres || [])].map((genre) => [
            genre.id,
            genre.name,
          ]),
        );

        setGenreLookup({
          ...defaultGenreLookup,
          ...genres,
        });
      } catch {
        setGenreLookup(defaultGenreLookup);
      }
    };

    loadGenres();
  }, []);

  useEffect(() => {
    const loadMovies = async () => {
      try {
        setLoading(true);
        const mediaTypes = getFilterMediaTypes(filterValues.media);
        const yearParam =
          filterValues.year === "all" ? "" : `&year=${encodeURIComponent(filterValues.year)}`;
        const latestRequests = mediaTypes.map(async (mediaType) => {
          const endpoint = mediaType === "tv" ? "tv-series" : "movies";
          const sortBy =
            mediaType === "tv" ? "first_air_date.desc" : "primary_release_date.desc";
          const response = await fetch(
            `${apiUrl}/api/${endpoint}/discover?sort_by=${sortBy}&language=id-ID&page=1${yearParam}`,
          );
          const data = response.ok ? await response.json() : { results: [] };

          return { data, mediaType };
        });
        const [trendingResponse, ...latestResponses] = await Promise.all([
          fetch(`${apiUrl}/api/movies/trending?time_window=week&language=id-ID`),
          ...latestRequests,
        ]);

        const trendingData = trendingResponse.ok
          ? await trendingResponse.json()
          : { results: [] };
        const mappedTrending = uniqueById(
          (trendingData.results || []).map(mapTmdbMovie),
        );
        const mappedLatest = uniqueById(
          latestResponses.flatMap(({ data, mediaType }) =>
            (data.results || []).map((item) =>
              mediaType === "tv" ? mapTmdbSeries(item) : mapTmdbMovie(item),
            ),
          ),
        );

        if (mappedTrending.length > 0) {
          setTrendingMovies(mappedTrending.slice(0, 3));
        }

        setAllMovies(mappedLatest.slice(0, 20));
      } catch {
        setTrendingMovies(fallbackMovies.slice(0, 3));
        setAllMovies(
          fallbackMovies.map((movie) => ({
            ...movie,
            media_type: getFilterMediaTypes(filterValues.media)[0] || "movie",
          })),
        );
      } finally {
        setLoading(false);
      }
    };

    loadMovies();
  }, [filterValues.media, filterValues.year]);

  useEffect(() => {
    if (heroMovies.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveHeroIndex((currentIndex) => (currentIndex + 1) % heroMovies.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [heroMovies.length]);

  useEffect(() => {
    const missingMovieItems = allMovies
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

    if (missingMovieItems.length === 0) {
      return undefined;
    }

    let shouldIgnore = false;

    const loadMovieProviders = async () => {
      const providerEntries = await Promise.all(
        missingMovieItems.map(async ({ id, mediaType }) => {
          const endpoint = mediaType === "tv" ? "tv-series" : "movies";
          const providerKey = getProviderCacheKey(mediaType, id);

          try {
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
  }, [allMovies, providersByMovieId]);

  useEffect(() => {
    const movieId = activeHeroMovie?.id;

    if (!Number.isInteger(Number(movieId)) || heroProvidersByMovieId[movieId]) {
      return undefined;
    }

    let shouldIgnore = false;

    const loadHeroProvider = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/movies/${movieId}/watch-providers`);

        if (!response.ok) {
          throw new Error("Gagal mengambil provider film");
        }

        const data = await response.json();
        const providerLogos = getProviderLogos(data);

        if (!shouldIgnore) {
          setHeroProvidersByMovieId((currentProviders) => ({
            ...currentProviders,
            [movieId]: providerLogos,
          }));
        }
      } catch {
        if (!shouldIgnore) {
          setHeroProvidersByMovieId((currentProviders) => ({
            ...currentProviders,
            [movieId]: [],
          }));
        }
      }
    };

    loadHeroProvider();

    return () => {
      shouldIgnore = true;
    };
  }, [activeHeroMovie?.id, heroProvidersByMovieId]);

  const openMovie = (movieId, mediaType = "movie") => {
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

  const moveHero = (direction) => {
    setActiveHeroIndex((currentIndex) => {
      const totalMovies = heroMovies.length || 1;
      return (currentIndex + direction + totalMovies) % totalMovies;
    });
  };

  const handleShareHero = async () => {
    const url = `${window.location.origin}/movie/${activeHeroMovie.id}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      await promptInput({
        title: "Salin Link Film",
        text: "Browser tidak memberi akses clipboard. Salin link berikut secara manual.",
        inputValue: url,
        confirmButtonText: "Tutup",
      });
    }
  };

  const handleWatchTrailer = async () => {
    const movieId = activeHeroMovie.id;

    if (!Number.isInteger(Number(movieId))) {
      return;
    }

    if (heroTrailerUrls[movieId]) {
      window.open(heroTrailerUrls[movieId], "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const fetchVideos = async (language) => {
        const response = await fetch(
          `${apiUrl}/api/movies/${movieId}/videos?language=${language}`,
        );

        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        return data.results || [];
      };

      const localizedVideos = await fetchVideos("id-ID");
      const fallbackVideos =
        localizedVideos.length > 0 ? [] : await fetchVideos("en-US");
      const trailerUrl = getTrailerUrl([...localizedVideos, ...fallbackVideos]);

      if (!trailerUrl) {
        showAlert({ title: "Trailer Belum Tersedia", text: "Trailer belum tersedia untuk film ini.", icon: "info" });
        return;
      }

      setHeroTrailerUrls((currentUrls) => ({
        ...currentUrls,
        [movieId]: trailerUrl,
      }));
      window.open(trailerUrl, "_blank", "noopener,noreferrer");
    } catch {
      showAlert({ title: "Gagal Membuka Trailer", text: "Trailer film belum bisa dibuka.", icon: "error" });
    }
  };

  const handleOpenHeroDetail = (event) => {
    const interactiveElement = event.target.closest("button, a");

    if (interactiveElement) {
      return;
    }

    navigate(`/movie/${activeHeroMovie.id}`);
  };

  return (
    <main className="movies-page">
      <SiteNavbar mode="fixed" activeKey="movies" />

      <section
        className="movies-hero"
        style={{ "--movies-hero-backdrop": `url(${activeHeroMovie.backdrop})` }}
        onClick={handleOpenHeroDetail}
        aria-label={`Buka detail ${activeHeroMovie.title}`}
      >
        <button
          className="movies-hero-arrow movies-hero-arrow-left"
          type="button"
          onClick={() => moveHero(-1)}
          aria-label="Film sebelumnya"
        >
          <FaChevronLeft />
        </button>

        <div className="movies-hero-copy">
          <div className="movies-hero-eyebrow">
            <span className="movies-hero-available-label">AVAILABLE ON</span>
            {activeHeroProviders.length > 0 ? (
              <div className="movies-hero-provider-logos" aria-label="Platform streaming">
                {activeHeroProviders.map((provider) => (
                  <img
                    src={provider.icon}
                    alt={provider.name}
                    key={`${provider.providerKey}-${provider.name}`}
                    title={provider.name}
                  />
                ))}
              </div>
            ) : (
              <strong>
                {hasLoadedActiveHeroProviders ? "Belum tersedia" : "Memuat..."}
              </strong>
            )}
            <span className="movies-hero-divider" />
            <span>{activeHeroMovie.releaseLabel}</span>
          </div>
          <h1>{activeHeroMovie.title}</h1>
          <div className="movies-hero-meta">
            <span className="movies-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar key={star} />
              ))}
            </span>
            <span>{activeHeroMovie.rating}</span>
            <span>Film</span>
            <span>Trending</span>
          </div>
          <p>{activeHeroMovie.overview}</p>

          <div className="movies-hero-buttons">
            <button type="button" onClick={handleWatchTrailer}>
              <FaPlay />
              Tonton Trailer
            </button>
            <button type="button" onClick={() => toggleWatchlist(activeHeroMovie)}>
              {savedMovieIds.has(String(activeHeroMovie.id)) ? (
                <FaBookmark />
              ) : (
                <FaRegBookmark />
              )}
              Simpan ke Watchlist
            </button>
            <button type="button" onClick={handleShareHero} aria-label="Bagikan film">
              <FaShareAlt />
            </button>
          </div>
        </div>

        <button
          className="movies-hero-arrow movies-hero-arrow-right"
          type="button"
          onClick={() => moveHero(1)}
          aria-label="Film berikutnya"
        >
          <FaChevronRight />
        </button>

        <div className="movies-hero-dots" aria-label="Pilih film hero">
          {heroMovies.map((movie, index) => (
            <button
              className={activeHeroIndex === index ? "is-active" : ""}
              type="button"
              key={movie.id}
              onClick={() => setActiveHeroIndex(index)}
              aria-label={`Tampilkan ${movie.title}`}
            />
          ))}
        </div>
      </section>

      <section className="movies-section">
        <div className="movies-section-header">
          <h2>Tonton Watchlist Kamu</h2>
          {watchlist.length > 0 && (
            <button type="button" onClick={() => navigate("/watchlist")}>
              Lihat Semua
            </button>
          )}
        </div>

        {watchlist.length > 0 ? (
          <div className="movies-card-row">
            {watchlist.slice(0, 5).map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                isSaved={savedMovieIds.has(String(movie.id))}
                onOpen={openMovie}
                onToggleWatchlist={toggleWatchlist}
                genreLookup={genreLookup}
                removeMode
              />
            ))}
          </div>
        ) : (
          <div className="movies-empty-watchlist">
            <h3>Ayo cari film dan simpan ke watchlist</h3>
            <p>Film yang kamu simpan akan muncul di section ini.</p>
            <a href="#all-movies">Cari Film</a>
          </div>
        )}
      </section>

      <section className="movies-section movies-trending-section">
        <h2>
          Trending <strong>Sekarang</strong>
        </h2>
        <div className="movies-trending-list">
          {trendingMovies.slice(0, 3).map((movie, index) => (
            <div className="movies-trending-item" key={movie.id}>
              <span className="movies-rank">{index + 1}</span>
              <MovieCard
                movie={movie}
                isSaved={savedMovieIds.has(String(movie.id))}
                onOpen={openMovie}
                onToggleWatchlist={toggleWatchlist}
                genreLookup={genreLookup}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="movies-section movies-all-section" id="all-movies">
        <div className="movies-section-header movies-all-header">
          <h2>Semua Film</h2>
          <div className="movies-all-tools">
            <label>
              <FaSearch />
              <input
                type="search"
                placeholder="Cari Film..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => setIsFilterOpen(true)}>
              <FaFilter />
              Filter
            </button>
          </div>
        </div>

        {loading && <p className="movies-status">Memuat film...</p>}
        {!loading && filteredAllMovies.length === 0 && (
          <p className="movies-status">Film tidak ditemukan.</p>
        )}

        <div className="movies-grid">
          {filteredAllMovies.map((movie) => (
            <MovieCard
              key={`${movie.media_type || "movie"}-${movie.id}`}
              movie={movie}
              isSaved={isMediaSaved(movie)}
              onOpen={openMovie}
              onToggleWatchlist={toggleWatchlist}
              genreLookup={genreLookup}
            />
          ))}
        </div>
      </section>

      <footer className="movies-footer">
        <nav aria-label="Footer navigation">
          <Link to="/">Home</Link>
          <Link to="/movies">Movie</Link>
          <Link to="/tv-series">TV Series</Link>
          <Link to="/genre">Genre</Link>
          <Link to="/community">Community</Link>
          <Link to="/contact-us">Contact Us</Link>
        </nav>
        <div>
          <FaFacebookF />
          <FaTwitter />
          <FaYoutube />
        </div>
        <p>Copyright 2026 - Kelompok 5</p>
      </footer>

      <FilterPopup
        open={isFilterOpen}
        title="Filter Film"
        values={filterValues}
        sections={movieFilterSections}
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

export default MoviesPage;
