import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaBookmark,
  FaChevronRight,
  FaFacebookF,
  FaFilter,
  FaRegBookmark,
  FaStar,
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
import "./GenrePage.css";

const apiUrl = import.meta.env.VITE_API_URL;

const fallbackPosterUrl =
  "https://image.tmdb.org/t/p/w500/cdPSUck4tBRvRu6DFk6XciDrssn.jpg";
const fallbackGenreImage =
  "https://image.tmdb.org/t/p/original/tiIpajUBpLMNWMEzpjRBxo0jCbD.jpg";

const fallbackGenres = [
  { id: 28, name: "Aksi", type: "genre", query: { genre: "28" } },
  { id: 12, name: "Petualangan", type: "genre", query: { genre: "12" } },
  { id: 16, name: "Animasi", type: "genre", query: { genre: "16" } },
  { id: 35, name: "Komedi", type: "genre", query: { genre: "35" } },
  { id: 80, name: "Kriminal", type: "genre", query: { genre: "80" } },
  { id: 18, name: "Drama", type: "genre", query: { genre: "18" } },
  { id: 14, name: "Fantasi", type: "genre", query: { genre: "14" } },
  { id: 27, name: "Horor", type: "genre", query: { genre: "27" } },
  { id: 9648, name: "Misteri", type: "genre", query: { genre: "9648" } },
  { id: 10749, name: "Romantis", type: "genre", query: { genre: "10749" } },
  { id: 878, name: "Sci-Fi", type: "genre", query: { genre: "878" } },
  { id: 53, name: "Thriller", type: "genre", query: { genre: "53" } },
  { id: 10751, name: "Keluarga", type: "genre", query: { genre: "10751" } },
  { id: 36, name: "Sejarah", type: "genre", query: { genre: "36" } },
  { id: 10402, name: "Musik", type: "genre", query: { genre: "10402" } },
  { id: 10752, name: "Perang", type: "genre", query: { genre: "10752" } },
  {
    id: "hollywood",
    name: "Hollywood",
    type: "regional",
    query: { with_origin_country: "US", with_original_language: "en" },
  },
  {
    id: "bollywood",
    name: "Bollywood",
    type: "regional",
    query: { with_origin_country: "IN", with_original_language: "hi" },
  },
  {
    id: "k-drama",
    name: "K-Drama",
    type: "regional",
    query: { genre: "18", with_origin_country: "KR", with_original_language: "ko" },
  },
  {
    id: "china-drama",
    name: "Cina Drama",
    type: "regional",
    query: { genre: "18", with_origin_country: "CN", with_original_language: "zh" },
  },
  {
    id: "japan",
    name: "Japan",
    type: "regional",
    query: { with_origin_country: "JP", with_original_language: "ja" },
  },
];

const genreDescriptions = {
  Aksi: "Adegan cepat, konflik besar, dan energi tinggi.",
  Petualangan: "Perjalanan besar, dunia baru, dan misi penuh risiko.",
  Animasi: "Visual ekspresif untuk keluarga, fantasi, dan cerita hangat.",
  Komedi: "Cerita ringan dengan momen lucu dan karakter santai.",
  Kriminal: "Kasus, investigasi, dan dunia gelap penuh intrik.",
  Drama: "Cerita emosional dengan konflik manusia yang kuat.",
  Fantasi: "Dunia imajinatif, kekuatan magis, dan petualangan epik.",
  Horor: "Ketegangan gelap, teror, dan kejutan yang intens.",
  Misteri: "Rahasia, teka-teki, dan jawaban yang perlahan terbuka.",
  Romantis: "Kisah hubungan, rasa, dan pilihan hati.",
  "Sci-Fi": "Teknologi, masa depan, dan gagasan besar.",
  Thriller: "Alur tegang dengan ancaman yang terus meningkat.",
  Keluarga: "Tontonan nyaman untuk dinikmati bersama.",
  Sejarah: "Cerita masa lalu, tokoh besar, dan peristiwa penting.",
  Musik: "Cerita yang hidup lewat lagu, panggung, dan ritme.",
  Perang: "Konflik besar, strategi, dan sisi manusia dari pertempuran.",
  Hollywood: "Film produksi Amerika dengan skala populer.",
  Bollywood: "Film India dengan drama, musik, dan emosi besar.",
  "K-Drama": "Drama Korea dengan cerita emosional dan karakter kuat.",
  "Cina Drama": "Drama Cina dengan relasi, konflik, dan visual elegan.",
  Japan: "Film Jepang dengan gaya cerita khas dan atmosfer kuat.",
};

const fallbackMovies = Array.from({ length: 10 }, (_, index) => ({
  id: `genre-fallback-${index + 1}`,
  title: "Cargo",
  year: "2023",
  rating: "4.9",
  poster: fallbackPosterUrl,
  overview:
    "Seorang ayah berusaha melindungi bayinya dalam perjalanan penuh risiko setelah wabah mengubah dunia.",
  genre_ids: [18, 53],
}));

const getMediaType = (media) => (media === "tv" ? "tv" : "movie");

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
    return "Deskripsi film belum tersedia.";
  }

  if (cleanOverview.length <= 150) {
    return cleanOverview;
  }

  return `${cleanOverview.slice(0, 147).trim()}...`;
};

const getGenreSeed = (value) =>
  String(value)
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);

const formatGenreCount = (count) =>
  new Intl.NumberFormat("id-ID").format(Number(count || 0));

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

const genreSortOptions = [
  { value: "latest", label: "Terbaru" },
  { value: "za", label: "Z - A" },
  { value: "az", label: "A - Z" },
  { value: "rating", label: "Rating Tertinggi" },
];

const defaultFilterValues = {
  genre: "all",
  media: "all",
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

const mapTmdbMediaItem = (movie, mediaType = "movie") => ({
  id: movie.id,
  title:
    movie.title ||
    movie.name ||
    movie.original_title ||
    movie.original_name ||
    "Untitled",
  year: getMovieYear(movie.release_date || movie.first_air_date),
  rating: getMovieRating(movie.vote_average),
  poster: movie.poster_url,
  backdrop: movie.backdrop_url || movie.poster_url,
  overview: getShortOverview(movie.overview),
  genre_ids: movie.genre_ids || [],
  media_type: mediaType,
});

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

const movieToTvGenreMap = {
  12: "10759",
  14: "10765",
  16: "16",
  18: "18",
  27: "9648",
  28: "10759",
  35: "35",
  36: "18",
  37: "37",
  53: "9648",
  80: "80",
  99: "99",
  878: "10765",
  9648: "9648",
  10402: "18",
  10749: "18",
  10751: "10751",
  10752: "10768",
};

const tvToMovieGenreMap = {
  16: "16",
  18: "18",
  35: "35",
  37: "37",
  80: "80",
  99: "99",
  9648: "9648",
  10751: "10751",
  10759: "28",
  10762: "10751",
  10765: "878",
  10766: "18",
  10768: "10752",
};

const getDiscoverQueryForMedia = (genre, mediaType) => {
  if (!genre?.query?.genre || genre.type !== "genre") {
    return genre?.query || {};
  }

  const genreId = String(genre.query.genre);
  const mappedGenre =
    mediaType === "tv"
      ? movieToTvGenreMap[genreId] || genreId
      : tvToMovieGenreMap[genreId] || genreId;

  return {
    ...genre.query,
    genre: mappedGenre,
  };
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

const getRatingSortScore = (rating) => {
  const score = Number(rating);
  return Number.isFinite(score) ? score : 0;
};

const sortMediaList = (mediaList, sortKey) => {
  const sortedMedia = [...mediaList];

  if (sortKey === "az") {
    return sortedMedia.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (sortKey === "za") {
    return sortedMedia.sort((a, b) => b.title.localeCompare(a.title));
  }

  if (sortKey === "rating") {
    return sortedMedia.sort(
      (a, b) => getRatingSortScore(b.rating) - getRatingSortScore(a.rating),
    );
  }

  if (sortKey === "latest") {
    return sortedMedia.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  }

  return sortedMedia;
};

const getProviderCacheKey = (mediaType, mediaId) =>
  `${getMediaType(mediaType)}:${mediaId}`;

const getFilterMediaTypes = (mediaFilter) =>
  mediaFilter === "all" ? ["movie", "tv"] : [getMediaType(mediaFilter)];

const applyRecommendationFilters = (
  mediaList,
  filters,
  providersByMediaId,
  mediaType,
) => {
  const shouldFilterByGenreId =
    filters.genre !== "all" && Number.isInteger(Number(filters.genre));

  const filteredMedia = mediaList.filter((mediaItem) => {
    const itemMediaType = getMediaType(mediaItem.media_type || mediaType);
    const mediaId = getProviderCacheKey(itemMediaType, mediaItem.id);
    const matchesMedia = filters.media === "all" || itemMediaType === filters.media;
    const matchesGenre =
      !shouldFilterByGenreId ||
      (mediaItem.genre_ids || [])
        .map((genreId) => String(genreId))
        .includes(String(filters.genre));
    const matchesCategory = matchesCategoryFilter(mediaItem, filters.category);
    const matchesYear = filters.year === "all" || String(mediaItem.year) === filters.year;
    const hasLoadedProvider = Object.prototype.hasOwnProperty.call(
      providersByMediaId,
      mediaId,
    );
    const matchesPlatform =
      filters.platform === "all" ||
      !hasLoadedProvider ||
      matchesPlatformFilter(providersByMediaId[mediaId], filters.platform);

    return matchesMedia && matchesGenre && matchesCategory && matchesYear && matchesPlatform;
  });

  return sortMediaList(filteredMedia, filters.sort);
};

const normalizeGenre = (genre) => ({
  ...genre,
  id: genre.id,
  name: genre.name,
  type: genre.type || "genre",
  query: genre.query || { genre: String(genre.id) },
  description:
    genre.description ||
    genreDescriptions[genre.name] ||
    "Rekomendasi film pilihan berdasarkan kategori ini.",
});

const buildDiscoverUrl = (query = {}, mediaType = "movie", extraParams = {}) => {
  const params = new URLSearchParams({
    sort_by: "popularity.desc",
    language: "id-ID",
    page: "1",
  });

  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value && value !== "all") {
      params.set(key, value);
    }
  });

  const endpoint = mediaType === "tv" ? "tv-series" : "movies";

  return `${apiUrl}/api/${endpoint}/discover?${params.toString()}`;
};

const uniqueById = (movies) => {
  const seen = new Set();

  return movies.filter((movie) => {
    const movieKey = `${movie.media_type || "movie"}:${movie.id}`;

    if (!movie.id || seen.has(movieKey) || !movie.poster) {
      return false;
    }

    seen.add(movieKey);
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

function GenreMovieCard({
  movie,
  mediaType,
  isSaved,
  genreLookup,
  onOpen,
  onToggleWatchlist,
}) {
  const movieGenres = (movie.genre_ids || [])
    .map((genreId) => genreLookup[genreId])
    .filter(Boolean)
    .slice(0, 2);

  return (
    <article
      className="genre-movie-card"
      onClick={() => onOpen(movie.id, movie.media_type || mediaType)}
    >
      <div className="genre-movie-poster">
        <img src={movie.poster} alt={movie.title} />
        <button
          className="genre-movie-save"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleWatchlist(movie);
          }}
          aria-label={
            isSaved ? `Hapus ${movie.title} dari watchlist` : `Simpan ${movie.title}`
          }
        >
          {isSaved ? <FaBookmark /> : <FaRegBookmark />}
        </button>
        <div className="genre-movie-overlay" aria-hidden="true">
          <div className="genre-movie-tags">
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

function GenrePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryMediaParam = searchParams.get("media");
  const queryMedia = getMediaType(queryMediaParam);
  const queryGenreId = searchParams.get("genre");
  const queryGenreName = searchParams.get("name");
  const user = useMemo(() => getStoredUser(), []);
  const movieWatchlistKey = useMemo(() => getMovieWatchlistKey(user), [user]);
  const seriesWatchlistKey = useMemo(() => getSeriesWatchlistKey(user), [user]);
  const [movieWatchlist, setMovieWatchlist] = useState(() =>
    readStoredWatchlist(user, "movie"),
  );
  const [seriesWatchlist, setSeriesWatchlist] = useState(() =>
    readStoredWatchlist(user, "tv"),
  );
  const [pendingWatchlistItem, setPendingWatchlistItem] = useState(null);
  const [genres, setGenres] = useState(fallbackGenres.map(normalizeGenre));
  const [genreImages, setGenreImages] = useState({});
  const [genreCounts, setGenreCounts] = useState({});
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(queryMedia);
  const [movies, setMovies] = useState([]);
  const [providersByMediaId, setProvidersByMediaId] = useState({});
  const [filterValues, setFilterValues] = useState(defaultFilterValues);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [genreLoading, setGenreLoading] = useState(false);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const genreLookup = useMemo(
    () =>
      Object.fromEntries(
        genres
          .filter((genre) => genre.type === "genre")
          .map((genre) => [genre.id, genre.name]),
      ),
    [genres],
  );

  const savedMovieIds = useMemo(
    () => new Set(movieWatchlist.map((movie) => String(movie.id))),
    [movieWatchlist],
  );
  const savedSeriesIds = useMemo(
    () => new Set(seriesWatchlist.map((series) => String(series.id))),
    [seriesWatchlist],
  );
  const yearFilterOptions = useMemo(() => getYearFilterOptions(), []);
  const genreRecommendationFilterSections = useMemo(
    () => [
      { key: "media", title: "Tipe", options: mediaFilterOptions },
      { key: "category", title: "Kategori", options: categoryFilterOptions },
      { key: "platform", title: "Platform", options: platformFilterOptions },
      { key: "year", title: "Tahun", options: yearFilterOptions },
      { key: "sort", title: "Urutkan Berdasarkan", options: genreSortOptions },
    ],
    [yearFilterOptions],
  );
  const filteredMovies = useMemo(
    () =>
      applyRecommendationFilters(
        movies,
        filterValues,
        providersByMediaId,
        selectedMedia,
      ),
    [filterValues, movies, providersByMediaId, selectedMedia],
  );
  const selectedMediaLabel =
    filterValues.media === "all"
      ? "Film & TV Series"
      : filterValues.media === "tv"
        ? "TV Series"
        : "Film";
  const selectedMediaCountLabel =
    filterValues.media === "all"
      ? "judul"
      : filterValues.media === "tv"
        ? "series"
        : "film";

  useEffect(() => {
    localStorage.setItem(movieWatchlistKey, JSON.stringify(movieWatchlist));
  }, [movieWatchlist, movieWatchlistKey]);

  useEffect(() => {
    localStorage.setItem(seriesWatchlistKey, JSON.stringify(seriesWatchlist));
  }, [seriesWatchlist, seriesWatchlistKey]);

  useEffect(() => {
    if (!queryGenreId && !queryGenreName) {
      return;
    }

    const matchingGenre =
      genres.find((genre) => String(genre.id) === String(queryGenreId)) ||
      genres.find(
        (genre) =>
          queryGenreName &&
          genre.name.toLowerCase() === queryGenreName.toLowerCase(),
      );

    const nextGenre =
      matchingGenre ||
      normalizeGenre({
        id: queryGenreId || queryGenreName,
        name: queryGenreName || "Genre",
        query: queryGenreId ? { genre: queryGenreId } : {},
      });

    setSelectedMedia(queryMedia);
    setSelectedGenre(nextGenre);
    setFilterValues((currentValues) => ({
      ...currentValues,
      genre: String(nextGenre.id),
      media: queryMediaParam ? queryMedia : currentValues.media,
    }));
  }, [genres, queryGenreId, queryGenreName, queryMedia, queryMediaParam]);

  useEffect(() => {
    const loadGenres = async () => {
      try {
        setGenreLoading(true);
        const genreEndpoint = queryMedia === "tv" ? "tv-series" : "movies";
        const response = await fetch(
          `${apiUrl}/api/${genreEndpoint}/genres?language=id-ID`,
        );

        if (!response.ok) {
          throw new Error("Gagal mengambil genre");
        }

        const data = await response.json();
        const fetchedGenres = data.genres || [];

        if (fetchedGenres.length > 0) {
          const fetchedGenreCards = fetchedGenres.map((genre) =>
            normalizeGenre({
              ...genre,
              query: { genre: String(genre.id) },
            }),
          );
          const customGenreCards =
            queryMedia === "movie"
              ? fallbackGenres
                  .filter((genre) => genre.type === "regional")
                  .map(normalizeGenre)
              : [];

          setGenres([...fetchedGenreCards, ...customGenreCards]);
        }
      } catch {
        setGenres(fallbackGenres.map(normalizeGenre));
      } finally {
        setGenreLoading(false);
      }
    };

    loadGenres();
  }, [queryMedia]);

  useEffect(() => {
    const genresWithoutData = genres.filter(
      (genre) => !genreImages[genre.id] || genreCounts[genre.id] === undefined,
    );

    if (genresWithoutData.length === 0) {
      return undefined;
    }

    let shouldIgnore = false;

    const loadGenreImages = async () => {
      const genrePayloads = await Promise.all(
        genresWithoutData.map(async (genre) => {
          try {
            const response = await fetch(buildDiscoverUrl(genre.query, queryMedia));

            if (!response.ok) {
              throw new Error("Gagal mengambil gambar genre");
            }

            const data = await response.json();
            const candidates = (data.results || [])
              .flatMap((movie) => [movie.poster_url, movie.backdrop_url])
              .filter(Boolean);

            return {
              genreId: genre.id,
              candidates,
              totalResults: data.total_results,
            };
          } catch {
            return {
              genreId: genre.id,
              candidates: [fallbackGenreImage],
              totalResults: 0,
            };
          }
        }),
      );

      if (!shouldIgnore) {
        const usedImages = new Set(Object.values(genreImages));
        const imageEntries = genrePayloads.map(({ genreId, candidates }) => {
          const uniqueCandidates = [...new Set(candidates.length ? candidates : [fallbackGenreImage])];
          const startIndex = getGenreSeed(genreId) % uniqueCandidates.length;
          const orderedCandidates = [
            ...uniqueCandidates.slice(startIndex),
            ...uniqueCandidates.slice(0, startIndex),
          ];
          const image =
            orderedCandidates.find((candidate) => !usedImages.has(candidate)) ||
            orderedCandidates[0] ||
            fallbackGenreImage;

          usedImages.add(image);
          return [genreId, image];
        });
        const countEntries = genrePayloads.map(({ genreId, totalResults }) => [
          genreId,
          Number(totalResults || 0),
        ]);

        setGenreImages((currentImages) => ({
          ...currentImages,
          ...Object.fromEntries(imageEntries),
        }));
        setGenreCounts((currentCounts) => ({
          ...currentCounts,
          ...Object.fromEntries(countEntries),
        }));
      }
    };

    loadGenreImages();

    return () => {
      shouldIgnore = true;
    };
  }, [genreCounts, genreImages, genres, queryMedia]);

  useEffect(() => {
    if (!selectedGenre) {
      setMovies([]);
      return undefined;
    }

    let shouldIgnore = false;

    const loadMoviesByGenre = async () => {
      try {
        setMoviesLoading(true);
        setErrorMessage("");
        const mediaTypes = getFilterMediaTypes(filterValues.media);
        const extraParams =
          filterValues.year === "all" ? {} : { year: filterValues.year };
        const mediaResponses = await Promise.all(
          mediaTypes.map(async (mediaType) => {
            const response = await fetch(
              buildDiscoverUrl(
                getDiscoverQueryForMedia(selectedGenre, mediaType),
                mediaType,
                extraParams,
              ),
            );

            if (!response.ok) {
              throw new Error("Gagal mengambil rekomendasi film");
            }

            const data = await response.json();
            return { data, mediaType };
          }),
        );
        const mappedMovies = uniqueById(
          mediaResponses.flatMap(({ data, mediaType }) =>
            (data.results || []).map((item) => mapTmdbMediaItem(item, mediaType)),
          ),
        );

        if (!shouldIgnore) {
          setMovies(mappedMovies.length > 0 ? mappedMovies.slice(0, 20) : []);
        }
      } catch {
        if (!shouldIgnore) {
          const fallbackMediaType =
            getFilterMediaTypes(filterValues.media)[0] || selectedMedia;
          setMovies(
            fallbackMovies.map((movie) => ({
              ...movie,
              media_type: fallbackMediaType,
            })),
          );
          setErrorMessage("Gagal mengambil data terbaru, menampilkan fallback sementara.");
        }
      } finally {
        if (!shouldIgnore) {
          setMoviesLoading(false);
        }
      }
    };

    loadMoviesByGenre();

    return () => {
      shouldIgnore = true;
    };
  }, [filterValues.media, filterValues.year, selectedGenre, selectedMedia]);

  useEffect(() => {
    const missingProviderItems = movies
      .map((movie) => ({
        id: String(movie.id),
        mediaType: getMediaType(movie.media_type || selectedMedia),
      }))
      .filter(
        ({ id, mediaType }) =>
          Number.isInteger(Number(id)) &&
          !Object.prototype.hasOwnProperty.call(
            providersByMediaId,
            getProviderCacheKey(mediaType, id),
          ),
      );

    if (missingProviderItems.length === 0) {
      return undefined;
    }

    let shouldIgnore = false;

    const loadWatchProviders = async () => {
      const providerEntries = await Promise.all(
        missingProviderItems.map(async ({ id, mediaType }) => {
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
        setProvidersByMediaId((currentProviders) => ({
          ...currentProviders,
          ...Object.fromEntries(providerEntries),
        }));
      }
    };

    loadWatchProviders();

    return () => {
      shouldIgnore = true;
    };
  }, [movies, providersByMediaId, selectedMedia]);

  const openMovie = (movieId, mediaType = selectedMedia) => {
    if (Number.isInteger(Number(movieId))) {
      navigate(mediaType === "tv" ? `/tv-series/${movieId}` : `/movie/${movieId}`);
    }
  };

  const selectGenre = (genre) => {
    const mediaType = selectedMedia;

    setSelectedMedia(mediaType);
    setSelectedGenre(genre);
    setFilterValues((currentValues) => ({
      ...currentValues,
      genre: String(genre.id),
    }));
    setSearchParams({
      media: mediaType,
      genre: String(genre.id),
      name: genre.name,
    });
  };

  const handleFilterChange = (nextValues) => {
    const nextGenreValue = nextValues.genre;
    const nextMediaValue = nextValues.media;

    if (nextMediaValue !== filterValues.media && nextMediaValue !== "all") {
      const nextMedia = getMediaType(nextMediaValue);
      setSelectedMedia(nextMedia);

      if (selectedGenre) {
        setSearchParams({
          media: nextMedia,
          genre: String(selectedGenre.id),
          name: selectedGenre.name,
        });
      }
    }

    if (nextGenreValue !== filterValues.genre && nextGenreValue !== "all") {
      const nextGenre = genres.find(
        (genre) => String(genre.id) === String(nextGenreValue),
      );

      if (nextGenre) {
        setSelectedGenre(nextGenre);
        setSearchParams({
          media: nextMediaValue === "all" ? selectedMedia : getMediaType(nextMediaValue),
          genre: String(nextGenre.id),
          name: nextGenre.name,
        });
      }
    }

    setFilterValues(nextValues);
  };

  const isMediaSaved = (mediaItem) => {
    const mediaType = getMediaType(mediaItem.media_type || selectedMedia);
    const mediaId = String(mediaItem.id);

    return mediaType === "tv" ? savedSeriesIds.has(mediaId) : savedMovieIds.has(mediaId);
  };

  const saveItemToWatchlist = (mediaItem) => {
    const mediaType = getMediaType(mediaItem.media_type || selectedMedia);
    const listSetter = mediaType === "tv" ? setSeriesWatchlist : setMovieWatchlist;

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

    const mediaType = getMediaType(mediaItem.media_type || selectedMedia);
    const mediaId = String(mediaItem.id);

    if (isMediaSaved(mediaItem)) {
      const listSetter = mediaType === "tv" ? setSeriesWatchlist : setMovieWatchlist;

      listSetter((currentWatchlist) =>
        currentWatchlist.filter((savedItem) => String(savedItem.id) !== mediaId),
      );
      return;
    }

    const primaryWatchlist = mediaType === "tv" ? seriesWatchlist : movieWatchlist;
    const secondaryWatchlist = mediaType === "tv" ? movieWatchlist : seriesWatchlist;

    if (canAddWatchlistItem(primaryWatchlist, secondaryWatchlist)) {
      setPendingWatchlistItem({
        mediaLabel: mediaType === "tv" ? "Series" : "Film",
        item: {
          ...mediaItem,
          media_type: mediaType,
        },
      });
    }
  };

  const confirmSaveToWatchlist = () => {
    if (pendingWatchlistItem?.item) {
      saveItemToWatchlist(pendingWatchlistItem.item);
    }

    setPendingWatchlistItem(null);
  };

  return (
    <main className="genre-page">
      <SiteNavbar mode="fixed" activeKey="genre" />

      <section className="genre-hero">
        <div className="genre-hero__eyebrow">
          <span />
          Genre Film
        </div>
        <h1>
          Pilih Genre, Temukan <strong>Rekomendasi</strong> Film yang Pas
        </h1>
        <p>
          Jelajahi film berdasarkan kategori favoritmu. Rekomendasi di bawah akan
          muncul setelah kamu memilih salah satu genre.
        </p>
      </section>

      <section className="genre-picker" aria-labelledby="genre-picker-title">
        <div className="genre-section-header">
          <div>
            <p>Pilih Genre</p>
            <h2 id="genre-picker-title">Genre yang tersedia</h2>
          </div>
          {genreLoading && <span>Memuat genre...</span>}
        </div>

        <div className="genre-chip-grid">
          {genres.map((genre) => (
            <button
              className={selectedGenre?.id === genre.id ? "is-active" : ""}
              key={genre.id}
              type="button"
              onClick={() => selectGenre(genre)}
              style={{
                "--genre-card-image": `url(${genreImages[genre.id] || fallbackGenreImage})`,
              }}
            >
              <span className="genre-chip-card__stack genre-chip-card__stack--back" aria-hidden="true" />
              <span className="genre-chip-card__stack genre-chip-card__stack--middle" aria-hidden="true" />
              <span className="genre-chip-card__front" aria-hidden="true" />
              <span className="genre-chip-card__arrow" aria-hidden="true">
                <FaChevronRight />
              </span>
              <span className="genre-chip-card__content">
                <strong>{genre.name}</strong>
                <small>{formatGenreCount(genreCounts[genre.id])} Film Baru</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="genre-recommendations" aria-live="polite">
        <div className="genre-section-header">
          <div>
            <p>Rekomendasi {selectedMediaLabel}</p>
            <h2>
              {selectedGenre
                ? `${selectedMediaLabel} untuk genre ${selectedGenre.name}`
                : "Pilih genre untuk melihat rekomendasi"}
            </h2>
          </div>
          {selectedGenre && (
            <button
              className="genre-filter-button"
              type="button"
              onClick={() => setIsFilterOpen(true)}
            >
              <FaFilter />
              Filter
            </button>
          )}
        </div>

        {!selectedGenre ? (
          <div className="genre-empty-state">
            <h3>Rekomendasi belum ditampilkan</h3>
            <p>
              Pilih satu genre di atas untuk menampilkan daftar{" "}
              {selectedMediaCountLabel} yang sesuai.
            </p>
          </div>
        ) : (
          <>
            {errorMessage && <p className="genre-status">{errorMessage}</p>}
            {moviesLoading && (
              <p className="genre-status">
                Memuat rekomendasi {selectedMediaCountLabel}...
              </p>
            )}
            {!moviesLoading && movies.length > 0 && filteredMovies.length === 0 && (
              <p className="genre-status">
                Tidak ada {selectedMediaCountLabel} yang cocok dengan filter ini.
              </p>
            )}
            {!moviesLoading && movies.length === 0 && (
              <p className="genre-status">
                {selectedMediaLabel} untuk genre ini belum ditemukan.
              </p>
            )}

            <div className="genre-movie-grid">
              {filteredMovies.map((movie) => (
                <GenreMovieCard
                  key={movie.id}
                  movie={movie}
                  mediaType={selectedMedia}
                  isSaved={isMediaSaved(movie)}
                  genreLookup={genreLookup}
                  onOpen={openMovie}
                  onToggleWatchlist={toggleWatchlist}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <footer className="genre-footer">
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

      <WatchlistConfirmModal
        open={Boolean(pendingWatchlistItem)}
        item={pendingWatchlistItem?.item}
        mediaLabel={pendingWatchlistItem?.mediaLabel || "Film"}
        onCancel={() => setPendingWatchlistItem(null)}
        onConfirm={confirmSaveToWatchlist}
      />

      <FilterPopup
        open={isFilterOpen}
        title={`Filter ${selectedMediaLabel}`}
        values={filterValues}
        sections={genreRecommendationFilterSections}
        onChange={handleFilterChange}
        onClose={() => setIsFilterOpen(false)}
      />
    </main>
  );
}

export default GenrePage;
