const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original";
const DEFAULT_WATCH_PROVIDER_REGION = "US";
const WATCH_PROVIDER_REGION_FALLBACKS = ["US", "GB", "CA", "AU", "ID"];

const getTmdbAuth = () => {
  const credential = process.env.TMDB_API_KEY?.trim();

  if (!credential) {
    return null;
  }

  if (credential.startsWith("eyJ")) {
    return {
      headers: {
        Authorization: `Bearer ${credential}`,
        accept: "application/json",
      },
      apiKey: null,
    };
  }

  return {
    headers: {
      accept: "application/json",
    },
    apiKey: credential,
  };
};

const buildTmdbUrl = (path, params = {}) => {
  const auth = getTmdbAuth();

  if (!auth) {
    return null;
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });

  if (auth.apiKey) {
    searchParams.set("api_key", auth.apiKey);
  }

  return {
    url: `${TMDB_BASE_URL}${path}?${searchParams.toString()}`,
    headers: auth.headers,
  };
};

const requestTmdb = async (path, params = {}) => {
  const request = buildTmdbUrl(path, params);

  if (!request) {
    const error = new Error("TMDB_API_KEY belum diatur di backend .env");
    error.status = 500;
    throw error;
  }

  const response = await fetch(request.url, {
    headers: request.headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.status_message || data.message || "TMDb request failed"
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

const mapImageUrl = (path, baseUrl = TMDB_IMAGE_BASE_URL) =>
  path ? `${baseUrl}${path}` : null;

const mapMovie = (movie) => ({
  id: movie.id,
  title: movie.title,
  original_title: movie.original_title,
  overview: movie.overview,
  release_date: movie.release_date,
  vote_average: movie.vote_average,
  vote_count: movie.vote_count,
  popularity: movie.popularity,
  genre_ids: movie.genre_ids || [],
  poster_path: movie.poster_path,
  backdrop_path: movie.backdrop_path,
  poster_url: mapImageUrl(movie.poster_path),
  backdrop_url: mapImageUrl(movie.backdrop_path, TMDB_BACKDROP_BASE_URL),
});

const mapMoviePage = (data) => ({
  page: data.page,
  total_pages: data.total_pages,
  total_results: data.total_results,
  results: (data.results || []).map(mapMovie),
});

const mapVideo = (video) => ({
  id: video.id,
  key: video.key,
  name: video.name,
  site: video.site,
  type: video.type,
  official: video.official,
  published_at: video.published_at,
  youtube_url:
    video.site === "YouTube"
      ? `https://www.youtube.com/watch?v=${video.key}`
      : null,
});

const mapCast = (person) => ({
  id: person.id,
  name: person.name,
  character: person.character,
  order: person.order,
  profile_path: person.profile_path,
  profile_url: mapImageUrl(person.profile_path),
});

const mapCrew = (person) => ({
  id: person.id,
  name: person.name,
  job: person.job,
  department: person.department,
  profile_path: person.profile_path,
  profile_url: mapImageUrl(person.profile_path),
});

const mapWatchProvider = (provider, type) => ({
  provider_id: provider.provider_id,
  provider_name: provider.provider_name,
  logo_path: provider.logo_path,
  logo_url: mapImageUrl(provider.logo_path),
  display_priority: provider.display_priority,
  type,
});

const uniqueWatchProviders = (providers) => {
  const seenProviderIds = new Set();

  return providers.filter((provider) => {
    if (seenProviderIds.has(provider.provider_id)) {
      return false;
    }

    seenProviderIds.add(provider.provider_id);
    return true;
  });
};

const hasWatchProviders = (regionProviders = {}) =>
  ["flatrate", "free", "ads", "rent", "buy"].some(
    (key) => (regionProviders[key] || []).length > 0
  );

const getWatchProviderRegion = (data, preferredRegion = DEFAULT_WATCH_PROVIDER_REGION) => {
  const availableRegions = Object.keys(data.results || {});
  const candidateRegions = [
    preferredRegion,
    ...WATCH_PROVIDER_REGION_FALLBACKS,
    ...availableRegions,
  ]
    .filter(Boolean)
    .map((region) => region.toUpperCase());
  const uniqueCandidateRegions = [...new Set(candidateRegions)];

  return (
    uniqueCandidateRegions.find((region) =>
      hasWatchProviders(data.results?.[region])
    ) ||
    uniqueCandidateRegions[0] ||
    DEFAULT_WATCH_PROVIDER_REGION
  );
};

const mapMovieWatchProviders = (
  data,
  region = DEFAULT_WATCH_PROVIDER_REGION
) => {
  const requestedRegion = region.toUpperCase();
  const regionCode = getWatchProviderRegion(data, requestedRegion);
  const regionProviders = data.results?.[regionCode] || {};
  const flatrate = (regionProviders.flatrate || []).map((provider) =>
    mapWatchProvider(provider, "flatrate")
  );
  const free = (regionProviders.free || []).map((provider) =>
    mapWatchProvider(provider, "free")
  );
  const ads = (regionProviders.ads || []).map((provider) =>
    mapWatchProvider(provider, "ads")
  );
  const rent = (regionProviders.rent || []).map((provider) =>
    mapWatchProvider(provider, "rent")
  );
  const buy = (regionProviders.buy || []).map((provider) =>
    mapWatchProvider(provider, "buy")
  );

  return {
    id: data.id,
    requested_region: requestedRegion,
    region: regionCode,
    used_fallback_region: regionCode !== requestedRegion,
    link: regionProviders.link || null,
    flatrate,
    free,
    ads,
    rent,
    buy,
    all: uniqueWatchProviders([...flatrate, ...free, ...ads, ...rent, ...buy]),
  };
};

const mapMovieDetail = (movie) => ({
  ...mapMovie(movie),
  genres: movie.genres || [],
  runtime: movie.runtime,
  tagline: movie.tagline,
  status: movie.status,
  homepage: movie.homepage,
  imdb_id: movie.imdb_id,
  budget: movie.budget,
  revenue: movie.revenue,
  production_companies: movie.production_companies || [],
  videos: (movie.videos?.results || []).map(mapVideo),
  cast: (movie.credits?.cast || []).slice(0, 12).map(mapCast),
  crew: (movie.credits?.crew || []).slice(0, 12).map(mapCrew),
  recommendations: movie.recommendations
    ? mapMoviePage(movie.recommendations)
    : undefined,
});

const getLanguage = (req) => req.query.language || "en-US";
const getPage = (req) => req.query.page || 1;

const handleTmdbError = (res, error, fallbackMessage) => {
  return res.status(error.status || 500).json({
    message: fallbackMessage,
    error: error.message,
  });
};

export const searchMovies = async (req, res) => {
  try {
    const query = req.query.query?.trim();

    if (!query) {
      return res.status(400).json({
        message: "Query film wajib diisi",
      });
    }

    const data = await requestTmdb("/search/movie", {
      query,
      include_adult: "false",
      language: getLanguage(req),
      page: getPage(req),
    });

    return res.json(mapMoviePage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mencari film");
  }
};

export const getPopularMovies = async (req, res) => {
  try {
    const data = await requestTmdb("/movie/popular", {
      language: getLanguage(req),
      page: getPage(req),
    });

    return res.json(mapMoviePage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil film populer");
  }
};

export const getTopRatedMovies = async (req, res) => {
  try {
    const data = await requestTmdb("/movie/top_rated", {
      language: getLanguage(req),
      page: getPage(req),
    });

    return res.json(mapMoviePage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil film top rated");
  }
};

export const getNowPlayingMovies = async (req, res) => {
  try {
    const data = await requestTmdb("/movie/now_playing", {
      language: getLanguage(req),
      page: getPage(req),
      region: req.query.region || "US",
    });

    return res.json(mapMoviePage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil film now playing");
  }
};

export const getUpcomingMovies = async (req, res) => {
  try {
    const data = await requestTmdb("/movie/upcoming", {
      language: getLanguage(req),
      page: getPage(req),
      region: req.query.region || "US",
    });

    return res.json(mapMoviePage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil film upcoming");
  }
};

export const getTrendingMovies = async (req, res) => {
  try {
    const timeWindow =
      req.query.time_window === "day" || req.query.time_window === "week"
        ? req.query.time_window
        : "week";

    const data = await requestTmdb(`/trending/movie/${timeWindow}`, {
      language: getLanguage(req),
    });

    return res.json(mapMoviePage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil film trending");
  }
};

export const getMovieGenres = async (req, res) => {
  try {
    const data = await requestTmdb("/genre/movie/list", {
      language: getLanguage(req),
    });

    return res.json(data);
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil genre film");
  }
};

export const discoverMovies = async (req, res) => {
  try {
    const data = await requestTmdb("/discover/movie", {
      language: getLanguage(req),
      page: getPage(req),
      sort_by: req.query.sort_by || "popularity.desc",
      with_genres: req.query.genre || req.query.with_genres,
      with_original_language: req.query.with_original_language,
      with_origin_country: req.query.with_origin_country,
      primary_release_year: req.query.year,
      "vote_average.gte": req.query.min_rating,
      include_adult: "false",
    });

    return res.json(mapMoviePage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal memfilter film");
  }
};

export const getMovieDetail = async (req, res) => {
  try {
    const region = req.query.region || DEFAULT_WATCH_PROVIDER_REGION;
    const [data, watchProviders] = await Promise.all([
      requestTmdb(`/movie/${req.params.id}`, {
        language: getLanguage(req),
        append_to_response: "videos,credits,recommendations",
      }),
      requestTmdb(`/movie/${req.params.id}/watch/providers`),
    ]);

    return res.json({
      ...mapMovieDetail(data),
      watch_providers: mapMovieWatchProviders(watchProviders, region),
    });
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil detail film");
  }
};

export const getMovieWatchProviders = async (req, res) => {
  try {
    const data = await requestTmdb(`/movie/${req.params.id}/watch/providers`);

    return res.json(
      mapMovieWatchProviders(
        data,
        req.query.region || DEFAULT_WATCH_PROVIDER_REGION
      )
    );
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil provider streaming film");
  }
};

export const getMovieRecommendations = async (req, res) => {
  try {
    const data = await requestTmdb(
      `/movie/${req.params.id}/recommendations`,
      {
        language: getLanguage(req),
        page: getPage(req),
      }
    );

    return res.json(mapMoviePage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil rekomendasi film");
  }
};

export const getMovieVideos = async (req, res) => {
  try {
    const data = await requestTmdb(`/movie/${req.params.id}/videos`, {
      language: getLanguage(req),
    });

    return res.json({
      id: data.id,
      results: (data.results || []).map(mapVideo),
    });
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil video film");
  }
};

export const getMovieCredits = async (req, res) => {
  try {
    const data = await requestTmdb(`/movie/${req.params.id}/credits`, {
      language: getLanguage(req),
    });

    return res.json({
      id: data.id,
      cast: (data.cast || []).map(mapCast),
      crew: (data.crew || []).map(mapCrew),
    });
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil cast film");
  }
};
