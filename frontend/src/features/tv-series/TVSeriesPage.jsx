import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBookmark,
  FaFacebookF,
  FaFilter,
  FaRegBookmark,
  FaSearch,
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
import "./TVSeriesPage.css";

const apiUrl = import.meta.env.VITE_API_URL;

const fallbackPosterUrl =
  "https://image.tmdb.org/t/p/w500/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg";
const fallbackBackdropUrl =
  "https://image.tmdb.org/t/p/original/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg";

const fallbackSeries = Array.from({ length: 10 }, (_, index) => ({
  id: `fallback-tv-${index + 1}`,
  media_type: "tv",
  title: "The Last of Us",
  year: "2023",
  rating: "4.2",
  poster: fallbackPosterUrl,
  backdrop: fallbackBackdropUrl,
  overview:
    "Dua penyintas melakukan perjalanan melewati dunia yang berubah, membawa harapan di tengah bahaya dan kehilangan.",
  releaseLabel: "15 Januari 2023",
  providers: [],
  genre_ids: [18, 10765],
}));

const defaultGenreLookup = {
  16: "Animasi",
  18: "Drama",
  35: "Komedi",
  37: "Western",
  80: "Kriminal",
  99: "Dokumenter",
  9648: "Misteri",
  10751: "Keluarga",
  10759: "Aksi & Petualangan",
  10762: "Anak",
  10763: "Berita",
  10764: "Reality",
  10765: "Sci-Fi & Fantasi",
  10766: "Soap",
  10767: "Talk",
  10768: "Perang & Politik",
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

const seriesSortOptions = [
  { value: "latest", label: "Terbaru" },
  { value: "za", label: "Z - A" },
  { value: "az", label: "A - Z" },
  { value: "rating", label: "Rating Tertinggi" },
];

const defaultFilterValues = {
  media: "tv",
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
  mediaFilter === "all" ? ["tv", "movie"] : [getMediaType(mediaFilter)];

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

const getSeriesYear = (date) => date?.slice(0, 4) || "-";

const formatAirDate = (date) => {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
};

const getSeriesRating = (voteAverage) => {
  const numericRating = Number(voteAverage);

  if (!Number.isFinite(numericRating) || numericRating <= 0) {
    return "-";
  }

  return (numericRating / 2).toFixed(1);
};

const getShortOverview = (overview) => {
  const cleanOverview = overview?.trim();

  if (!cleanOverview) {
    return "Deskripsi series belum tersedia.";
  }

  if (cleanOverview.length <= 160) {
    return cleanOverview;
  }

  return `${cleanOverview.slice(0, 157).trim()}...`;
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

const sortSeriesList = (seriesList, sortKey) => {
  const sortedSeries = [...seriesList];

  if (sortKey === "az") {
    return sortedSeries.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (sortKey === "za") {
    return sortedSeries.sort((a, b) => b.title.localeCompare(a.title));
  }

  if (sortKey === "rating") {
    return sortedSeries.sort(
      (a, b) => getRatingSortScore(b.rating) - getRatingSortScore(a.rating),
    );
  }

  return sortedSeries.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
};

const applySeriesFilters = (seriesList, filters, providersBySeriesId) => {
  const filteredSeries = seriesList.filter((series) => {
    const mediaType = getMediaType(series.media_type);
    const providerKey = getProviderCacheKey(mediaType, series.id);
    const matchesMedia = filters.media === "all" || mediaType === filters.media;
    const matchesCategory = matchesCategoryFilter(series, filters.category);
    const matchesYear = filters.year === "all" || String(series.year) === filters.year;
    const hasLoadedProvider = Object.prototype.hasOwnProperty.call(
      providersBySeriesId,
      providerKey,
    );
    const matchesPlatform =
      filters.platform === "all" ||
      !hasLoadedProvider ||
      matchesPlatformFilter(providersBySeriesId[providerKey], filters.platform);

    return matchesMedia && matchesCategory && matchesYear && matchesPlatform;
  });

  return sortSeriesList(filteredSeries, filters.sort);
};

const mapTmdbSeries = (series) => ({
  id: series.id,
  media_type: "tv",
  title: series.title || series.name || series.original_name || "Untitled",
  year: getSeriesYear(series.first_air_date),
  rating: getSeriesRating(series.vote_average),
  poster: series.poster_url,
  backdrop: series.backdrop_url || series.poster_url,
  overview: getShortOverview(series.overview),
  releaseLabel: formatAirDate(series.first_air_date),
  providers: [],
  genre_ids: series.genre_ids || [],
});

const mapTmdbMovie = (movie) => ({
  id: movie.id,
  media_type: "movie",
  title: movie.title || movie.original_title || "Untitled",
  year: getSeriesYear(movie.release_date),
  rating: getSeriesRating(movie.vote_average),
  poster: movie.poster_url,
  backdrop: movie.backdrop_url || movie.poster_url,
  overview: getShortOverview(movie.overview),
  releaseLabel: formatAirDate(movie.release_date),
  providers: [],
  genre_ids: movie.genre_ids || [],
});

const uniqueById = (seriesList) => {
  const seen = new Set();

  return seriesList.filter((series) => {
    const mediaKey = `${series.media_type || "tv"}:${series.id}`;

    if (!series.id || seen.has(mediaKey) || !series.poster) {
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

function SeriesCard({
  series,
  isSaved,
  onOpen,
  onToggleWatchlist,
  genreLookup = defaultGenreLookup,
  removeMode = false,
}) {
  const mediaType = getMediaType(series.media_type);
  const seriesGenres = (series.genre_ids || [])
    .map((genreId) => genreLookup[genreId])
    .filter(Boolean)
    .slice(0, 2);

  return (
    <article className="tv-series-card" onClick={() => onOpen(series.id, mediaType)}>
      <div className="tv-series-card-poster">
        <img src={series.poster} alt={series.title} />
        <button
          className="tv-series-card-save"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleWatchlist(series);
          }}
          aria-label={
            isSaved
              ? `Hapus ${series.title} dari watchlist`
              : `Simpan ${series.title}`
          }
        >
          {removeMode ? <FaTimes /> : isSaved ? <FaBookmark /> : <FaRegBookmark />}
        </button>
        <div className="tv-series-card-overlay" aria-hidden="true">
          <div className="tv-series-card-genres">
            {(seriesGenres.length > 0
              ? seriesGenres
              : [mediaType === "tv" ? "Series" : "Film"]
            ).map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
          <p>{getShortOverview(series.overview)}</p>
        </div>
      </div>
      <h3>{series.title}</h3>
      <p>
        {series.year}
        <span />
        <strong>
          <FaStar />
          {series.rating}
        </strong>
      </p>
    </article>
  );
}

function TVSeriesPage() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const watchlistKey = useMemo(() => getSeriesWatchlistKey(user), [user]);
  const movieWatchlistKey = useMemo(() => getMovieWatchlistKey(user), [user]);
  const [watchlist, setWatchlist] = useState(() => readStoredWatchlist(user, "tv"));
  const [movieWatchlist, setMovieWatchlist] = useState(() =>
    readStoredWatchlist(user, "movie"),
  );
  const [pendingWatchlistSeries, setPendingWatchlistSeries] = useState(null);
  const [trendingSeries, setTrendingSeries] = useState(fallbackSeries.slice(0, 4));
  const [popularSeries, setPopularSeries] = useState(fallbackSeries);
  const [allSeries, setAllSeries] = useState(fallbackSeries);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [popularCarouselIndex, setPopularCarouselIndex] = useState(0);
  const [providersBySeriesId, setProvidersBySeriesId] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValues, setFilterValues] = useState(defaultFilterValues);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [genreLookup, setGenreLookup] = useState(defaultGenreLookup);
  const [loading, setLoading] = useState(true);

  const yearFilterOptions = useMemo(() => getYearFilterOptions(), []);
  const seriesFilterSections = useMemo(
    () => [
      { key: "media", title: "Tipe", options: mediaFilterOptions },
      { key: "category", title: "Kategori", options: categoryFilterOptions },
      { key: "platform", title: "Platform", options: platformFilterOptions },
      { key: "year", title: "Tahun", options: yearFilterOptions },
      { key: "sort", title: "Urutkan Berdasarkan", options: seriesSortOptions },
    ],
    [yearFilterOptions],
  );
  const savedSeriesIds = useMemo(
    () => new Set(watchlist.map((series) => String(series.id))),
    [watchlist],
  );
  const savedMovieIds = useMemo(
    () => new Set(movieWatchlist.map((movie) => String(movie.id))),
    [movieWatchlist],
  );

  const heroSeries = trendingSeries.slice(0, 4);
  const activeHeroSeries =
    heroSeries[activeHeroIndex] || heroSeries[0] || fallbackSeries[0];
  const topTenPopularSeries = popularSeries.slice(0, 10);
  const visiblePopularSeries = useMemo(() => {
    const visibleCount = Math.min(5, topTenPopularSeries.length);

    return Array.from({ length: visibleCount }, (_, offset) => {
      const index = (popularCarouselIndex + offset) % topTenPopularSeries.length;
      return {
        ...topTenPopularSeries[index],
        rank: index + 1,
      };
    });
  }, [popularCarouselIndex, topTenPopularSeries]);
  const searchedAllSeries = allSeries.filter((series) =>
    series.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const filteredAllSeries = applySeriesFilters(
    searchedAllSeries,
    filterValues,
    providersBySeriesId,
  );

  useEffect(() => {
    localStorage.setItem(watchlistKey, JSON.stringify(watchlist));
  }, [watchlist, watchlistKey]);

  useEffect(() => {
    localStorage.setItem(movieWatchlistKey, JSON.stringify(movieWatchlist));
  }, [movieWatchlist, movieWatchlistKey]);

  useEffect(() => {
    const loadGenres = async () => {
      try {
        const [seriesResponse, movieResponse] = await Promise.all([
          fetch(`${apiUrl}/api/tv-series/genres?language=id-ID`),
          fetch(`${apiUrl}/api/movies/genres?language=id-ID`),
        ]);

        if (!seriesResponse.ok && !movieResponse.ok) {
          return;
        }

        const seriesData = seriesResponse.ok
          ? await seriesResponse.json()
          : { genres: [] };
        const movieData = movieResponse.ok ? await movieResponse.json() : { genres: [] };
        const genres = Object.fromEntries(
          [...(seriesData.genres || []), ...(movieData.genres || [])].map((genre) => [
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
    const loadSeries = async () => {
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
        const [trendingResponse, popularResponse, ...latestResponses] =
          await Promise.all([
            fetch(`${apiUrl}/api/tv-series/trending?time_window=week&language=id-ID`),
            fetch(`${apiUrl}/api/tv-series/popular?language=id-ID&page=1`),
            ...latestRequests,
          ]);

        const trendingData = trendingResponse.ok
          ? await trendingResponse.json()
          : { results: [] };
        const popularData = popularResponse.ok
          ? await popularResponse.json()
          : { results: [] };
        const mappedTrending = uniqueById(
          (trendingData.results || []).map(mapTmdbSeries),
        );
        const mappedPopular = uniqueById(
          (popularData.results || []).map(mapTmdbSeries),
        );
        const mappedLatest = uniqueById(
          latestResponses.flatMap(({ data, mediaType }) =>
            (data.results || []).map((item) =>
              mediaType === "movie" ? mapTmdbMovie(item) : mapTmdbSeries(item),
            ),
          ),
        );

        if (mappedTrending.length > 0) {
          setTrendingSeries(mappedTrending.slice(0, 4));
        }

        if (mappedPopular.length > 0) {
          setPopularSeries(mappedPopular.slice(0, 10));
        }

        setAllSeries(mappedLatest.slice(0, 20));
      } catch {
        setTrendingSeries(fallbackSeries.slice(0, 4));
        setPopularSeries(fallbackSeries);
        setAllSeries(
          fallbackSeries.map((series) => ({
            ...series,
            media_type: getFilterMediaTypes(filterValues.media)[0] || "tv",
          })),
        );
      } finally {
        setLoading(false);
      }
    };

    loadSeries();
  }, [filterValues.media, filterValues.year]);

  useEffect(() => {
    if (heroSeries.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveHeroIndex((currentIndex) => (currentIndex + 1) % heroSeries.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [heroSeries.length]);

  useEffect(() => {
    if (topTenPopularSeries.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setPopularCarouselIndex((currentIndex) =>
        (currentIndex + 1) % topTenPopularSeries.length,
      );
    }, 2800);

    return () => window.clearInterval(intervalId);
  }, [topTenPopularSeries.length]);

  useEffect(() => {
    const missingSeriesItems = allSeries
      .map((series) => ({
        id: String(series.id),
        mediaType: getMediaType(series.media_type),
      }))
      .filter(
        ({ id, mediaType }) =>
          Number.isInteger(Number(id)) &&
          !Object.prototype.hasOwnProperty.call(
            providersBySeriesId,
            getProviderCacheKey(mediaType, id),
          ),
      );

    if (missingSeriesItems.length === 0) {
      return undefined;
    }

    let shouldIgnore = false;

    const loadSeriesProviders = async () => {
      const providerEntries = await Promise.all(
        missingSeriesItems.map(async ({ id, mediaType }) => {
          const endpoint = mediaType === "movie" ? "movies" : "tv-series";
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
        setProvidersBySeriesId((currentProviders) => ({
          ...currentProviders,
          ...Object.fromEntries(providerEntries),
        }));
      }
    };

    loadSeriesProviders();

    return () => {
      shouldIgnore = true;
    };
  }, [allSeries, providersBySeriesId]);

  const openSeries = (mediaId, mediaType = "tv") => {
    if (Number.isInteger(Number(mediaId))) {
      navigate(getMediaType(mediaType) === "movie" ? `/movie/${mediaId}` : `/tv-series/${mediaId}`);
    }
  };

  const isMediaSaved = (mediaItem) => {
    const mediaId = String(mediaItem.id);

    return getMediaType(mediaItem.media_type) === "movie"
      ? savedMovieIds.has(mediaId)
      : savedSeriesIds.has(mediaId);
  };

  const saveMediaToWatchlist = (mediaItem) => {
    const mediaType = getMediaType(mediaItem.media_type);
    const listSetter = mediaType === "movie" ? setMovieWatchlist : setWatchlist;

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
      const listSetter = mediaType === "movie" ? setMovieWatchlist : setWatchlist;

      listSetter((currentWatchlist) =>
        currentWatchlist.filter((savedItem) => String(savedItem.id) !== mediaId),
      );
      return;
    }

    if (canAddWatchlistItem(watchlist, movieWatchlist)) {
      setPendingWatchlistSeries({ ...mediaItem, media_type: mediaType });
    }
  };

  const confirmSaveToWatchlist = () => {
    if (pendingWatchlistSeries) {
      saveMediaToWatchlist(pendingWatchlistSeries);
    }

    setPendingWatchlistSeries(null);
  };

  return (
    <main className="tv-series-page">
      <SiteNavbar mode="fixed" activeKey="tv" />

      <section
        className="tv-series-showcase"
        style={{ "--tv-series-showcase-backdrop": `url(${activeHeroSeries.backdrop})` }}
      >
        <div className="tv-series-showcase-copy">
          <div className="tv-series-showcase-eyebrow">
            <span />
            TV SERIES
          </div>
          <h1>
            Jelajahi <strong>Series</strong> Terbaik
          </h1>
          <p>Dari drama Korea hingga thriller Amerika - semua ada di FLIX</p>
        </div>
      </section>

      <section
        className="tv-series-section tv-series-popular-section"
        id="series-popular"
      >
        <div className="tv-series-section-header">
          <h2>
            Series <strong>Populer</strong>
          </h2>
          <p>Top 10 bergerak otomatis</p>
        </div>

        <div className="tv-series-popular-window" aria-live="polite">
          {visiblePopularSeries.map((series) => (
            <div className="tv-series-popular-item" key={`${series.id}-${series.rank}`}>
              <span className="tv-series-rank">{series.rank}</span>
              <SeriesCard
                series={series}
                isSaved={savedSeriesIds.has(String(series.id))}
                onOpen={openSeries}
                onToggleWatchlist={toggleWatchlist}
                genreLookup={genreLookup}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="tv-series-section">
        <div className="tv-series-section-header">
          <h2>Tonton Watchlist Series Kamu</h2>
          {watchlist.length > 0 && (
            <button type="button" onClick={() => navigate("/watchlist")}>
              Lihat Semua
            </button>
          )}
        </div>

        {watchlist.length > 0 ? (
          <div className="tv-series-card-row">
            {watchlist.slice(0, 5).map((series) => (
              <SeriesCard
                key={series.id}
                series={series}
                isSaved={savedSeriesIds.has(String(series.id))}
                onOpen={openSeries}
                onToggleWatchlist={toggleWatchlist}
                genreLookup={genreLookup}
                removeMode
              />
            ))}
          </div>
        ) : (
          <div className="tv-series-empty-watchlist">
            <h3>Ayo cari series dan simpan ke watchlist</h3>
            <p>Series yang kamu simpan akan muncul di section ini.</p>
            <a href="#all-series">Cari Series</a>
          </div>
        )}
      </section>

      <section className="tv-series-section tv-series-all-section" id="all-series">
        <div className="tv-series-section-header tv-series-all-header">
          <h2>Semua Series</h2>
          <div className="tv-series-all-tools">
            <label>
              <FaSearch />
              <input
                type="search"
                placeholder="Cari Series..."
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

        {loading && <p className="tv-series-status">Memuat series...</p>}
        {!loading && filteredAllSeries.length === 0 && (
          <p className="tv-series-status">Series tidak ditemukan.</p>
        )}

        <div className="tv-series-grid">
          {filteredAllSeries.map((series) => (
            <SeriesCard
              key={`${series.media_type || "tv"}-${series.id}`}
              series={series}
              isSaved={isMediaSaved(series)}
              onOpen={openSeries}
              onToggleWatchlist={toggleWatchlist}
              genreLookup={genreLookup}
            />
          ))}
        </div>
      </section>

      <footer className="tv-series-footer">
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
        title="Filter Series"
        values={filterValues}
        sections={seriesFilterSections}
        onChange={setFilterValues}
        onClose={() => setIsFilterOpen(false)}
      />

      <WatchlistConfirmModal
        open={Boolean(pendingWatchlistSeries)}
        item={pendingWatchlistSeries}
        mediaLabel={pendingWatchlistSeries?.media_type === "movie" ? "Film" : "Series"}
        onCancel={() => setPendingWatchlistSeries(null)}
        onConfirm={confirmSaveToWatchlist}
      />
    </main>
  );
}

export default TVSeriesPage;
