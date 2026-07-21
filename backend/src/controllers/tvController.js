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

const mapTvSeries = (series) => ({
  id: series.id,
  name: series.name,
  title: series.name || series.original_name,
  original_name: series.original_name,
  overview: series.overview,
  first_air_date: series.first_air_date,
  vote_average: series.vote_average,
  vote_count: series.vote_count,
  popularity: series.popularity,
  genre_ids: series.genre_ids || [],
  poster_path: series.poster_path,
  backdrop_path: series.backdrop_path,
  poster_url: mapImageUrl(series.poster_path),
  backdrop_url: mapImageUrl(series.backdrop_path, TMDB_BACKDROP_BASE_URL),
});

const mapTvSeriesPage = (data) => ({
  page: data.page,
  total_pages: data.total_pages,
  total_results: data.total_results,
  results: (data.results || []).map(mapTvSeries),
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

const mapTvWatchProviders = (
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

const mapTvSeriesDetail = (series) => ({
  ...mapTvSeries(series),
  genres: series.genres || [],
  tagline: series.tagline,
  status: series.status,
  type: series.type,
  homepage: series.homepage,
  original_language: series.original_language,
  episode_run_time: series.episode_run_time || [],
  first_air_date: series.first_air_date,
  last_air_date: series.last_air_date,
  number_of_episodes: series.number_of_episodes,
  number_of_seasons: series.number_of_seasons,
  in_production: series.in_production,
  created_by: series.created_by || [],
  networks: series.networks || [],
  production_companies: series.production_companies || [],
  seasons: series.seasons || [],
  videos: (series.videos?.results || []).map(mapVideo),
  cast: (series.credits?.cast || []).slice(0, 12).map(mapCast),
  crew: (series.credits?.crew || []).slice(0, 12).map(mapCrew),
  recommendations: series.recommendations
    ? mapTvSeriesPage(series.recommendations)
    : undefined,
});

const mapEpisode = (episode) => ({
  id: episode.id,
  name: episode.name,
  overview: episode.overview,
  season_number: episode.season_number,
  episode_number: episode.episode_number,
  air_date: episode.air_date,
  runtime: episode.runtime,
  vote_average: episode.vote_average,
  vote_count: episode.vote_count,
  still_path: episode.still_path,
  still_url: mapImageUrl(episode.still_path, TMDB_BACKDROP_BASE_URL),
});

const getLanguage = (req) => req.query.language || "en-US";
const getPage = (req) => req.query.page || 1;

const handleTmdbError = (res, error, fallbackMessage) => {
  return res.status(error.status || 500).json({
    message: fallbackMessage,
    error: error.message,
  });
};

export const searchTvSeries = async (req, res) => {
  try {
    const query = req.query.query?.trim();

    if (!query) {
      return res.status(400).json({
        message: "Query series wajib diisi",
      });
    }

    const data = await requestTmdb("/search/tv", {
      query,
      include_adult: "false",
      language: getLanguage(req),
      page: getPage(req),
    });

    return res.json(mapTvSeriesPage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mencari TV series");
  }
};

export const getPopularTvSeries = async (req, res) => {
  try {
    const data = await requestTmdb("/tv/popular", {
      language: getLanguage(req),
      page: getPage(req),
    });

    return res.json(mapTvSeriesPage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil TV series populer");
  }
};

export const getTopRatedTvSeries = async (req, res) => {
  try {
    const data = await requestTmdb("/tv/top_rated", {
      language: getLanguage(req),
      page: getPage(req),
    });

    return res.json(mapTvSeriesPage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil TV series top rated");
  }
};

export const getOnTheAirTvSeries = async (req, res) => {
  try {
    const data = await requestTmdb("/tv/on_the_air", {
      language: getLanguage(req),
      page: getPage(req),
      timezone: req.query.timezone || "Asia/Jakarta",
    });

    return res.json(mapTvSeriesPage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil TV series on the air");
  }
};

export const getTrendingTvSeries = async (req, res) => {
  try {
    const timeWindow =
      req.query.time_window === "day" || req.query.time_window === "week"
        ? req.query.time_window
        : "week";

    const data = await requestTmdb(`/trending/tv/${timeWindow}`, {
      language: getLanguage(req),
    });

    return res.json(mapTvSeriesPage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil TV series trending");
  }
};

export const getTvGenres = async (req, res) => {
  try {
    const data = await requestTmdb("/genre/tv/list", {
      language: getLanguage(req),
    });

    return res.json(data);
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil genre TV series");
  }
};

export const discoverTvSeries = async (req, res) => {
  try {
    const data = await requestTmdb("/discover/tv", {
      language: getLanguage(req),
      page: getPage(req),
      sort_by: req.query.sort_by || "popularity.desc",
      with_genres: req.query.genre || req.query.with_genres,
      with_original_language: req.query.with_original_language,
      with_origin_country: req.query.with_origin_country,
      first_air_date_year: req.query.year,
      "vote_average.gte": req.query.min_rating,
      include_adult: "false",
    });

    return res.json(mapTvSeriesPage(data));
  } catch (error) {
    return handleTmdbError(res, error, "Gagal memfilter TV series");
  }
};

export const getTvSeriesDetail = async (req, res) => {
  try {
    const region = req.query.region || DEFAULT_WATCH_PROVIDER_REGION;
    const [data, watchProviders] = await Promise.all([
      requestTmdb(`/tv/${req.params.id}`, {
        language: getLanguage(req),
        append_to_response: "videos,credits,recommendations",
      }),
      requestTmdb(`/tv/${req.params.id}/watch/providers`),
    ]);

    return res.json({
      ...mapTvSeriesDetail(data),
      watch_providers: mapTvWatchProviders(watchProviders, region),
    });
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil detail TV series");
  }
};

export const getTvSeriesWatchProviders = async (req, res) => {
  try {
    const data = await requestTmdb(`/tv/${req.params.id}/watch/providers`);

    return res.json(
      mapTvWatchProviders(
        data,
        req.query.region || DEFAULT_WATCH_PROVIDER_REGION
      )
    );
  } catch (error) {
    return handleTmdbError(
      res,
      error,
      "Gagal mengambil provider streaming TV series"
    );
  }
};

export const getTvSeriesVideos = async (req, res) => {
  try {
    const data = await requestTmdb(`/tv/${req.params.id}/videos`, {
      language: getLanguage(req),
    });

    return res.json({
      id: data.id,
      results: (data.results || []).map(mapVideo),
    });
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil video TV series");
  }
};

export const getTvSeasonEpisodes = async (req, res) => {
  try {
    const data = await requestTmdb(
      `/tv/${req.params.id}/season/${req.params.seasonNumber}`,
      {
        language: getLanguage(req),
      }
    );

    return res.json({
      id: data.id,
      name: data.name,
      overview: data.overview,
      season_number: data.season_number,
      air_date: data.air_date,
      poster_path: data.poster_path,
      poster_url: mapImageUrl(data.poster_path),
      episodes: (data.episodes || []).map(mapEpisode),
    });
  } catch (error) {
    return handleTmdbError(res, error, "Gagal mengambil episode TV series");
  }
};
