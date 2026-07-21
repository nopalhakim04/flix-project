import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import {
  FaBookmark,
  FaCheckCircle,
  FaFacebookF,
  FaPen,
  FaPlay,
  FaRegBookmark,
  FaRegCircle,
  FaRegStar,
  FaShareAlt,
  FaStar,
  FaThumbsUp,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";
import SiteNavbar from "@/components/layout/SiteNavbar";
import PremiumAvatar from "@/components/ui/PremiumAvatar";
import ReportModal from "@/components/ui/ReportModal";
import ReviewModal from "@/components/ui/ReviewModal";
import WatchlistConfirmModal from "@/components/ui/WatchlistConfirmModal";
import reportIcon from "@/assets/icon/report-icon.svg";
import amazonPrimeVideoIcon from "@/assets/platformstream-logo/amazonprimevideo-icon.png";
import appleTvIcon from "@/assets/platformstream-logo/appletv-icon.png";
import catchplayIcon from "@/assets/platformstream-logo/catchplay-icon.png";
import disneyHotstarIcon from "@/assets/platformstream-logo/disneyhotstar-icon.png";
import hboMaxIcon from "@/assets/platformstream-logo/HBOmax-icon.png";
import netflixIcon from "@/assets/platformstream-logo/netflix-icon.png";
import { canAddWatchlistItem, hasPremiumAccess, requireLogin } from "@/utils/authPrompt";
import {
  getSeriesWatchlistKey,
  getWatchStatusKey,
  readWatchlist as readStoredWatchlist,
  readWatchStatus,
} from "@/utils/watchlistStorage";
import { promptInput, showAlert, showToast } from "@/utils/alerts";
import { submitReport } from "@/utils/report";
import "@/features/movies/MovieDetail.css";

const apiUrl = import.meta.env.VITE_API_URL;

const providerIconMatchers = [
  { icon: netflixIcon, matches: ["netflix"] },
  { icon: disneyHotstarIcon, matches: ["disney", "hotstar"] },
  { icon: hboMaxIcon, matches: ["hbo", "max"] },
  { icon: catchplayIcon, matches: ["catchplay"] },
  { icon: appleTvIcon, matches: ["apple tv"] },
  { icon: amazonPrimeVideoIcon, matches: ["amazon", "prime video"] },
];

const getLocalProviderIcon = (providerName = "") => {
  const normalizedName = providerName.toLowerCase();
  const match = providerIconMatchers.find(({ matches }) =>
    matches.some((keyword) => normalizedName.includes(keyword)),
  );

  return match?.icon || null;
};

const getYear = (date) => date?.slice(0, 4) || "-";

const buildGenrePath = (genre, media = "tv") => {
  const params = new URLSearchParams({
    media,
    genre: String(genre.id),
    name: genre.name,
  });

  return `/genre?${params.toString()}`;
};

const formatRating = (rating) => {
  const numericRating = Number(rating);

  if (!Number.isFinite(numericRating)) {
    return "0.0";
  }

  return (numericRating / 2).toFixed(1);
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

const formatEpisodeRuntime = (runtime = []) => {
  const runtimeValue = Array.isArray(runtime) ? runtime.find(Boolean) : runtime;

  if (!runtimeValue) {
    return "-";
  }

  return `${runtimeValue}m/episode`;
};

const formatSeriesCount = (series) => {
  const seasons = Number(series?.number_of_seasons || 0);
  const episodes = Number(series?.number_of_episodes || 0);

  if (seasons && episodes) {
    return `${seasons} Season | ${episodes} Episode`;
  }

  if (seasons) {
    return `${seasons} Season`;
  }

  if (episodes) {
    return `${episodes} Episode`;
  }

  return "TV Series";
};

const formatReviewDate = (dateValue) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateValue));

const buildReviewTree = (reviews) => {
  const roots = [];
  const reviewMap = new Map();

  reviews.forEach((review) => {
    reviewMap.set(review.id_review, {
      ...review,
      replies: [],
    });
  });

  reviewMap.forEach((review) => {
    if (review.parent_review_id && reviewMap.has(review.parent_review_id)) {
      reviewMap.get(review.parent_review_id).replies.push(review);
      return;
    }

    roots.push(review);
  });

  return roots;
};

function ReviewAvatar({ review, user }) {
  const username = review?.username || user?.username || "";

  return (
    <PremiumAvatar
      className="movie-review-avatar"
      imageUrl={review?.profile_image_url || user?.profile_image_url}
      name={username || "?"}
      isPremium={Boolean(review?.is_premium || (!review && user?.is_premium))}
      alt={username || "Profile"}
    />
  );
}

const getSeriesStatusKey = (seriesId) => `tv:${seriesId}`;

const getEpisodeStatusKey = (seriesId, seasonNumber, episodeNumber) =>
  `tv:${seriesId}:s${seasonNumber}:e${episodeNumber}`;

const readStorageObject = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

const mapSeriesToWatchlist = (series) => ({
  id: series.id,
  title: series.name || series.title || series.original_name || "Untitled",
  year: getYear(series.first_air_date),
  rating: formatRating(series.vote_average),
  poster: series.poster_url,
  backdrop: series.backdrop_url || series.poster_url,
  overview: series.overview,
  releaseLabel: series.first_air_date || "-",
  providers: [],
  genre_ids: series.genre_ids || (series.genres || []).map((genre) => genre.id),
  seasons: series.seasons || [],
  number_of_episodes: series.number_of_episodes || 0,
  number_of_seasons: series.number_of_seasons || 0,
  episode_run_time: series.episode_run_time || [],
});

function RatingStars({ value, onChange, readonly = false }) {
  return (
    <div className="movie-stars" aria-label={`Rating ${value} dari 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isActive = star <= value;

        if (readonly) {
          return isActive ? <FaStar key={star} /> : <FaRegStar key={star} />;
        }

        return (
          <button
            className={isActive ? "is-active" : ""}
            key={star}
            type="button"
            onClick={() => onChange(star)}
            aria-label={`Beri rating ${star}`}
          >
            {isActive ? <FaStar /> : <FaRegStar />}
          </button>
        );
      })}
    </div>
  );
}

function TVSeriesDetail() {
  const { id } = useParams();
  const token = localStorage.getItem("token");
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const watchlistKey = useMemo(() => getSeriesWatchlistKey(user), [user]);
  const watchStatusKey = useMemo(() => getWatchStatusKey(user), [user]);
  const [series, setSeries] = useState(null);
  const [watchlist, setWatchlist] = useState(() => readStoredWatchlist(user, "tv"));
  const [watchStatus, setWatchStatus] = useState(() =>
    readWatchStatus(user),
  );
  const [pendingWatchlistSeries, setPendingWatchlistSeries] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({
    average_rating: 0,
    review_count: 0,
  });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [replyContent, setReplyContent] = useState("");
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [activeTab, setActiveTab] = useState("synopsis");
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [showSynopsisToggle, setShowSynopsisToggle] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportError, setReportError] = useState("");
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(null);
  const [isSeasonMenuOpen, setIsSeasonMenuOpen] = useState(false);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const synopsisRef = useRef(null);
  const reviewSectionRef = useRef(null);

  const reviewTree = useMemo(() => buildReviewTree(reviews), [reviews]);
  const savedSeriesIds = useMemo(
    () => new Set(watchlist.map((savedSeries) => String(savedSeries.id))),
    [watchlist],
  );
  const audienceRating = Number(reviewSummary.average_rating || 0);
  const detailRating = audienceRating || Number(formatRating(series?.vote_average));
  const ratingPercent = Math.min((detailRating / 5) * 100, 100);
  const seriesTitle = series?.name || series?.title || series?.original_name || "TV Series";
  const isSaved = savedSeriesIds.has(String(series?.id));
  const availableSeasons = useMemo(
    () =>
      (series?.seasons || [])
        .filter((season) => Number(season.season_number) > 0)
        .filter((season) => Number(season.episode_count || 0) > 0)
        .sort((a, b) => Number(a.season_number) - Number(b.season_number)),
    [series?.seasons],
  );
  const totalEpisodeCount = useMemo(() => {
    const tmdbTotal = Number(series?.number_of_episodes || 0);

    if (tmdbTotal > 0) {
      return tmdbTotal;
    }

    return availableSeasons.reduce(
      (total, season) => total + Number(season.episode_count || 0),
      0,
    );
  }, [availableSeasons, series?.number_of_episodes]);
  const watchedEpisodeCount = useMemo(() => {
    if (!series?.id || !isSaved) {
      return 0;
    }

    const prefix = `tv:${series.id}:s`;
    return Object.entries(watchStatus).filter(
      ([key, value]) => key.startsWith(prefix) && Boolean(value),
    ).length;
  }, [isSaved, series?.id, watchStatus]);
  const currentSeasonWatchedCount = useMemo(() => {
    if (!series?.id || !selectedSeasonNumber || !isSaved) {
      return 0;
    }

    const prefix = `tv:${series.id}:s${selectedSeasonNumber}:e`;
    return Object.entries(watchStatus).filter(
      ([key, value]) => key.startsWith(prefix) && Boolean(value),
    ).length;
  }, [isSaved, selectedSeasonNumber, series?.id, watchStatus]);

  const fetchSeries = async () => {
    const res = await axios.get(`${apiUrl}/api/tv-series/${id}`, {
      params: { language: "id-ID" },
    });
    setSeries(res.data);
    const firstSeason = (res.data.seasons || [])
      .filter((season) => Number(season.season_number) > 0)
      .filter((season) => Number(season.episode_count || 0) > 0)
      .sort((a, b) => Number(a.season_number) - Number(b.season_number))[0];

    setSelectedSeasonNumber(firstSeason?.season_number || 1);
  };

  const fetchReviews = async () => {
    const res = await axios.get(`${apiUrl}/api/tv-series-reviews/${id}`);
    setReviews(res.data.reviews || []);
    setReviewSummary(res.data.summary || { average_rating: 0, review_count: 0 });
  };

  useEffect(() => {
    localStorage.setItem(watchlistKey, JSON.stringify(watchlist));
  }, [watchlist, watchlistKey]);

  useEffect(() => {
    localStorage.setItem(watchStatusKey, JSON.stringify(watchStatus));
  }, [watchStatus, watchStatusKey]);

  useEffect(() => {
    setIsSeasonMenuOpen(false);
  }, [id]);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        setErrorMessage("");
        await Promise.all([fetchSeries(), fetchReviews()]);
      } catch (error) {
        setErrorMessage(
          error.response?.data?.message || "Gagal memuat detail TV series",
        );
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [id]);

  useEffect(() => {
    if (!selectedSeasonNumber) {
      setSeasonEpisodes([]);
      return undefined;
    }

    let shouldIgnore = false;

    const loadSeasonEpisodes = async () => {
      try {
        setEpisodesLoading(true);
        setEpisodesError("");

        const response = await axios.get(
          `${apiUrl}/api/tv-series/${id}/seasons/${selectedSeasonNumber}`,
          {
            params: { language: "id-ID" },
          },
        );

        if (!shouldIgnore) {
          setSeasonEpisodes(response.data.episodes || []);
        }
      } catch (error) {
        if (!shouldIgnore) {
          setSeasonEpisodes([]);
          setEpisodesError(
            error.response?.data?.message || "Gagal memuat episode TV series",
          );
        }
      } finally {
        if (!shouldIgnore) {
          setEpisodesLoading(false);
        }
      }
    };

    loadSeasonEpisodes();

    return () => {
      shouldIgnore = true;
    };
  }, [id, selectedSeasonNumber]);

  useEffect(() => {
    if (activeTab !== "synopsis" || !series?.overview) {
      setShowSynopsisToggle(false);
      setIsSynopsisExpanded(false);
      return undefined;
    }

    let frameId = 0;

    const measureSynopsis = () => {
      const element = synopsisRef.current;

      if (!element) {
        return;
      }

      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
      const previousDisplay = element.style.display;
      const previousOverflow = element.style.overflow;
      const previousLineClamp = element.style.webkitLineClamp;
      const previousBoxOrient = element.style.webkitBoxOrient;

      element.style.display = "block";
      element.style.overflow = "visible";
      element.style.webkitLineClamp = "unset";
      element.style.webkitBoxOrient = "initial";

      const fullHeight = element.scrollHeight;
      const maxCollapsedHeight = lineHeight * 5;

      element.style.display = previousDisplay;
      element.style.overflow = previousOverflow;
      element.style.webkitLineClamp = previousLineClamp;
      element.style.webkitBoxOrient = previousBoxOrient;

      setShowSynopsisToggle(fullHeight > maxCollapsedHeight + 2);
    };

    setIsSynopsisExpanded(false);
    frameId = window.requestAnimationFrame(measureSynopsis);
    window.addEventListener("resize", measureSynopsis);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measureSynopsis);
    };
  }, [activeTab, series?.overview]);

  const saveSeriesToWatchlist = (watchlistSeries) => {
    setWatchlist((currentWatchlist) => {
      const seriesId = String(watchlistSeries.id);

      if (currentWatchlist.some((savedSeries) => String(savedSeries.id) === seriesId)) {
        return currentWatchlist;
      }

      const nextWatchlist = [watchlistSeries, ...currentWatchlist];
      return hasPremiumAccess() ? nextWatchlist : nextWatchlist.slice(0, 20);
    });
  };

  const toggleWatchlist = () => {
    if (!requireLogin()) {
      return;
    }

    if (!series) {
      return;
    }

    const watchlistSeries = mapSeriesToWatchlist(series);
    const seriesId = String(watchlistSeries.id);

    if (savedSeriesIds.has(seriesId)) {
      setWatchlist((currentWatchlist) =>
        currentWatchlist.filter((savedSeries) => String(savedSeries.id) !== seriesId),
      );
      setWatchStatus((currentStatus) => {
        const nextStatus = { ...currentStatus };
        const episodePrefix = `tv:${seriesId}:s`;
        delete nextStatus[getSeriesStatusKey(seriesId)];
        Object.keys(nextStatus).forEach((statusKey) => {
          if (statusKey.startsWith(episodePrefix)) {
            delete nextStatus[statusKey];
          }
        });
        return nextStatus;
      });
      return;
    }

    if (canAddWatchlistItem(watchlist)) {
      setPendingWatchlistSeries(watchlistSeries);
    }
  };

  const confirmSaveToWatchlist = () => {
    if (pendingWatchlistSeries) {
      saveSeriesToWatchlist(pendingWatchlistSeries);
    }

    setPendingWatchlistSeries(null);
  };

  const toggleEpisodeWatched = (episode) => {
    if (!series?.id || !selectedSeasonNumber || !isSaved) {
      return;
    }

    const episodeKey = getEpisodeStatusKey(
      series.id,
      selectedSeasonNumber,
      episode.episode_number,
    );
    const seriesKey = getSeriesStatusKey(series.id);
    const episodePrefix = `tv:${series.id}:s`;

    setWatchStatus((currentStatus) => {
      const shouldMarkWatched = !currentStatus[episodeKey];
      const nextStatus = {
        ...currentStatus,
      };

      seasonEpisodes.forEach((seasonEpisode) => {
        const currentEpisodeNumber = Number(seasonEpisode.episode_number);
        const clickedEpisodeNumber = Number(episode.episode_number);
        const currentEpisodeKey = getEpisodeStatusKey(
          series.id,
          selectedSeasonNumber,
          seasonEpisode.episode_number,
        );

        if (shouldMarkWatched) {
          nextStatus[currentEpisodeKey] = currentEpisodeNumber <= clickedEpisodeNumber;
          return;
        }

        if (currentEpisodeNumber >= clickedEpisodeNumber) {
          nextStatus[currentEpisodeKey] = false;
        }
      });

      const nextWatchedEpisodeCount = Object.entries(nextStatus).filter(
        ([key, value]) => key.startsWith(episodePrefix) && Boolean(value),
      ).length;

      nextStatus[seriesKey] =
        totalEpisodeCount > 0 && nextWatchedEpisodeCount >= totalEpisodeCount;

      return nextStatus;
    });
  };

  const handleReviewTabClick = () => {
    setActiveTab("review");

    window.requestAnimationFrame(() => {
      reviewSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleWatchTrailer = async () => {
    if (!series) {
      return;
    }

    const trailerUrl = getTrailerUrl(series.videos || []);

    if (trailerUrl) {
      window.open(trailerUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const response = await fetch(
        `${apiUrl}/api/tv-series/${id}/videos?language=en-US`,
      );

      if (!response.ok) {
        throw new Error("Gagal mengambil trailer");
      }

      const data = await response.json();
      const fallbackTrailerUrl = getTrailerUrl(data.results || []);

      if (!fallbackTrailerUrl) {
        showAlert({ title: "Trailer Belum Tersedia", text: "Trailer belum tersedia untuk TV series ini.", icon: "info" });
        return;
      }

      window.open(fallbackTrailerUrl, "_blank", "noopener,noreferrer");
    } catch {
      showAlert({ title: "Gagal Membuka Trailer", text: "Trailer TV series belum bisa dibuka.", icon: "error" });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: seriesTitle,
      text: `Lihat ${seriesTitle} di FLIX`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareMessage("Link TV series berhasil disalin.");
      window.setTimeout(() => setShareMessage(""), 1800);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      await promptInput({
        title: "Salin Link TV Series",
        text: "Browser tidak memberi akses clipboard. Salin link berikut secara manual.",
        inputValue: url,
        confirmButtonText: "Tutup",
      });
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();

    if (!requireLogin()) {
      return;
    }

    if (!reviewContent.trim()) {
      return;
    }

    await axios.post(
      `${apiUrl}/api/tv-series-reviews/${id}`,
      {
        content: reviewContent,
        rating: reviewRating,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    setReviewContent("");
    setReviewRating(5);
    await fetchReviews();
    setIsReviewModalOpen(false);
  };

  const handleSubmitReply = async (event, parentReviewId) => {
    event.preventDefault();

    if (!requireLogin()) {
      return;
    }

    if (!replyContent.trim()) {
      return;
    }

    await axios.post(
      `${apiUrl}/api/tv-series-reviews/${id}`,
      {
        content: replyContent,
        parent_review_id: parentReviewId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    setReplyContent("");
    setActiveReplyId(null);
    await fetchReviews();
  };

  const handleLikeReview = async (reviewId) => {
    if (!requireLogin()) {
      return;
    }

    await axios.post(
      `${apiUrl}/api/tv-series-reviews/likes/${reviewId}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    await fetchReviews();
  };

  const handleOpenReport = (reviewId, label = "review") => {
    if (!requireLogin()) {
      return;
    }

    setReportError("");
    setReportTarget({
      targetType: "tv_series_review",
      targetId: reviewId,
      targetLabel: label,
    });
  };

  const handleSubmitReport = async ({ category, reason }) => {
    if (!reportTarget) return;

    try {
      setReportSaving(true);
      setReportError("");
      await submitReport({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        category,
        reason,
      });
      setReportTarget(null);
      showToast({ title: "Report berhasil dikirim." });
    } catch (error) {
      setReportError(error.response?.data?.message || "Gagal mengirim report");
    } finally {
      setReportSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="movie-detail-page movie-detail-state">
        Memuat detail TV series...
      </main>
    );
  }

  if (errorMessage || !series) {
    return (
      <main className="movie-detail-page movie-detail-state">
        {errorMessage || "TV series tidak ditemukan"}
      </main>
    );
  }

  const backdrop = series.backdrop_url || series.poster_url;
  const cast = series.cast || [];
  const watchProviders = series.watch_providers?.all || [];
  const visibleWatchProviders = watchProviders.slice(0, 6);
  const hasWatchProviders = visibleWatchProviders.length > 0;
  const selectedSeason = availableSeasons.find(
    (season) => String(season.season_number) === String(selectedSeasonNumber),
  );
  const runtimeFallback = Array.isArray(series.episode_run_time)
    ? series.episode_run_time.find(Boolean)
    : series.episode_run_time;

  return (
    <main className="movie-detail-page">
      <SiteNavbar mode="absolute" activeKey="tv" />

      <section
        className="movie-detail-hero"
        style={{ "--movie-backdrop": `url(${backdrop})` }}
      >
        <div className="movie-detail-container movie-detail-hero-content">
          <div className="movie-detail-copy">
            <h1>{seriesTitle}</h1>
            <div className="movie-detail-meta">
              <span>{getYear(series.first_air_date)}</span>
              <span>{formatEpisodeRuntime(series.episode_run_time)}</span>
              <span>Language: {series.original_language?.toUpperCase() || "-"}</span>
            </div>

            <div className="movie-detail-buttons">
              <button type="button" onClick={handleWatchTrailer}>
                <FaPlay />
                Tonton Trailer
              </button>
              <button type="button" onClick={toggleWatchlist}>
                {isSaved ? <FaBookmark /> : <FaRegBookmark />}
                {isSaved ? "Tersimpan di Watchlist" : "Simpan ke Watchlist"}
              </button>
              <button type="button" onClick={handleShare} aria-label="Bagikan TV series">
                <FaShareAlt />
              </button>
            </div>
            {shareMessage && (
              <p className="movie-detail-share-feedback" role="status">
                {shareMessage}
              </p>
            )}
          </div>

          <article className="movie-detail-poster-card">
            <img src={series.poster_url} alt={seriesTitle} />
            <div className="movie-detail-poster-meta">
              <span>
                <FaStar />
                {formatRating(series.vote_average)}
              </span>
              <span>{getYear(series.first_air_date)}</span>
            </div>
            <h2>{seriesTitle}</h2>
          </article>
        </div>
      </section>

      <section className="movie-detail-info movie-detail-container">
        <div className="movie-detail-genre-block">
          <h3>Genre</h3>
          <div className="movie-detail-tags">
            {(series.genres || []).slice(0, 4).map((genre) => (
              <Link key={genre.id} to={buildGenrePath(genre, "tv")}>
                {genre.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="movie-detail-provider-block">
          <h3>Tersedia Di</h3>
          {hasWatchProviders ? (
            <div className="movie-detail-providers">
              {visibleWatchProviders.map((provider) => {
                const providerIcon =
                  getLocalProviderIcon(provider.provider_name) || provider.logo_url;

                return (
                  <a
                    className="movie-detail-provider"
                    href={series.watch_providers.link || "#"}
                    key={provider.provider_id}
                    target="_blank"
                    rel="noreferrer"
                    title={provider.provider_name}
                    aria-label={`Lihat ${seriesTitle} di ${provider.provider_name}`}
                  >
                    {providerIcon ? (
                      <img src={providerIcon} alt={provider.provider_name} />
                    ) : (
                      <span>{provider.provider_name}</span>
                    )}
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="movie-detail-provider-empty">
              Belum tersedia di region {series.watch_providers?.region || "US"}.
            </p>
          )}
        </div>
      </section>

      {availableSeasons.length > 0 && (
        <section className="tv-detail-episodes movie-detail-container">
          <div className="tv-detail-season-picker">
            <span>Pilih Season</span>
            <div className="tv-detail-season-picker__control">
              <button
                className={isSeasonMenuOpen ? "is-open" : ""}
                type="button"
                onClick={() => setIsSeasonMenuOpen((current) => !current)}
                aria-expanded={isSeasonMenuOpen}
              >
                Season {selectedSeasonNumber || 1}
              </button>
              {isSeasonMenuOpen && (
                <div className="tv-detail-season-picker__menu">
                  {availableSeasons.map((season) => (
                    <button
                      className={
                        String(season.season_number) === String(selectedSeasonNumber)
                          ? "is-active"
                          : ""
                      }
                      key={season.id || season.season_number}
                      type="button"
                      onClick={() => {
                        setSelectedSeasonNumber(Number(season.season_number));
                        setIsSeasonMenuOpen(false);
                      }}
                    >
                      Season {season.season_number}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="tv-detail-episodes__header">
            <h2>Episode</h2>
            
          </div>
          {!isSaved && (
            <p className="tv-detail-episodes__hint">
              Simpan series ke Watchlist untuk menandai episode yang sudah ditonton.
            </p>
          )}

          {episodesLoading ? (
            <p className="tv-detail-episodes__state">Memuat episode...</p>
          ) : episodesError ? (
            <p className="tv-detail-episodes__state">{episodesError}</p>
          ) : seasonEpisodes.length > 0 ? (
            <>
              <div className="tv-detail-season-summary">
                <span>{selectedSeason?.name || `Season ${selectedSeasonNumber}`}</span>
                <span>
                  {currentSeasonWatchedCount}/{seasonEpisodes.length} selesai
                </span>
              </div>

              <div className="tv-detail-episode-list" aria-label="Daftar episode">
                {seasonEpisodes.map((episode) => {
                  const episodeWatched =
                    isSaved &&
                    Boolean(
                      watchStatus[
                        getEpisodeStatusKey(
                          series.id,
                          selectedSeasonNumber,
                          episode.episode_number,
                        )
                      ],
                    );
                  const runtime = episode.runtime || runtimeFallback;

                  return (
                    <article
                      className={
                        episodeWatched
                          ? "tv-detail-episode-card is-watched"
                          : "tv-detail-episode-card"
                      }
                      key={episode.id || episode.episode_number}
                    >
                      <div className="tv-detail-episode-thumb">
                        <img
                          src={episode.still_url || series.backdrop_url || series.poster_url}
                          alt={episode.name || `Episode ${episode.episode_number}`}
                        />
                        <div className="tv-detail-episode-overlay">
                          <div>
                            <h3>{episode.name || `Episode ${episode.episode_number}`}</h3>
                            {runtime && <span>{runtime}m</span>}
                          </div>
                          <button
                            type="button"
                            aria-label={`Putar ${episode.name || "episode"}`}
                          >
                            <FaPlay />
                          </button>
                          <p>{episode.overview || "Deskripsi episode belum tersedia."}</p>
                        </div>
                      </div>

                      <div className="tv-detail-episode-meta">
                        <div>
                          <h3>{episode.name || seriesTitle}</h3>
                          <p>Episode {episode.episode_number}</p>
                        </div>
                      </div>
                      {isSaved && (
                        <button
                          className={
                            episodeWatched
                              ? "tv-detail-episode-watch-toggle is-active"
                              : "tv-detail-episode-watch-toggle"
                          }
                          type="button"
                          onClick={() => toggleEpisodeWatched(episode)}
                          aria-label={
                            episodeWatched
                              ? `Tandai episode ${episode.episode_number} belum ditonton`
                              : `Tandai episode ${episode.episode_number} sudah ditonton`
                          }
                        >
                          {episodeWatched ? <FaCheckCircle /> : <FaRegCircle />}
                          <span>{episodeWatched ? "Sudah ditonton" : "Tandai ditonton"}</span>
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="tv-detail-episodes__state">
              Episode belum tersedia untuk season ini.
            </p>
          )}
        </section>
      )}

      <section className="movie-detail-main movie-detail-container">
        <div className="movie-detail-tabs">
          <button
            className={activeTab === "synopsis" ? "is-active" : ""}
            type="button"
            onClick={() => setActiveTab("synopsis")}
          >
            Sinopsis
          </button>
          <button
            className={activeTab === "review" ? "is-active" : ""}
            type="button"
            onClick={handleReviewTabClick}
          >
            Review
          </button>
        </div>

        {activeTab === "synopsis" && (
          <div className="movie-detail-content-grid">
            <div>
              <p
                className={`movie-detail-synopsis ${
                  showSynopsisToggle && !isSynopsisExpanded ? "is-clamped" : ""
                }`}
                ref={synopsisRef}
              >
                {series.overview || "Sinopsis belum tersedia."}
              </p>
              {showSynopsisToggle && (
                <button
                  className="movie-detail-more"
                  type="button"
                  onClick={() => setIsSynopsisExpanded((current) => !current)}
                >
                  {isSynopsisExpanded ? "Tampilkan lebih sedikit" : "Selengkapnya"}
                </button>
              )}

              <div className="movie-detail-cast">
                <h3>Pemeran Utama</h3>
                <div className="movie-detail-cast-list">
                  {cast.map((person) => (
                    <article key={`${person.id}-${person.character}`}>
                      <img
                        src={
                          person.profile_url ||
                          "https://placehold.co/96x96/444/fff?text=FLIX"
                        }
                        alt={person.name}
                      />
                      <h4>{person.name}</h4>
                      <p>{person.character || "-"}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="movie-detail-score">
              <div
                className="movie-detail-score-ring"
                style={{ "--score-percent": `${ratingPercent}%` }}
              >
                <span>
                  <FaStar />
                  {detailRating.toFixed(1)}
                </span>
              </div>
              <p>{reviewSummary.review_count} review penonton</p>
              <p>{formatSeriesCount(series)}</p>
            </div>
          </div>
        )}
      </section>

      <section
        className="movie-review-section movie-detail-container"
        ref={reviewSectionRef}
      >
        <h2>Review Penonton</h2>

        <button
          className="movie-review-open-button"
          type="button"
          onClick={() => {
            if (!requireLogin()) {
              return;
            }

            setIsReviewModalOpen(true);
          }}
        >
          <FaPen />
          Berikan Review
        </button>

        <div className="movie-review-list">
          {reviewTree.length > 0 ? (
            reviewTree.map((review) => (
              <article className="movie-review-item" key={review.id_review}>
                <div className="movie-review-header">
                  <div className="movie-review-user">
                    <ReviewAvatar review={review} />
                    <div>
                      <h3>{review.username}</h3>
                      <p>{formatReviewDate(review.created_at)}</p>
                    </div>
                  </div>
                  <div className="movie-review-header-tools">
                    <RatingStars value={review.rating || 0} readonly />
                    <button
                      className="movie-review-report-button"
                      type="button"
                      onClick={() => handleOpenReport(review.id_review, "review")}
                      aria-label={`Report review dari ${review.username}`}
                      title="Report review"
                    >
                      <img src={reportIcon} alt="" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <p className="movie-review-content">{review.content}</p>
                <div className="movie-review-actions">
                  <button type="button" onClick={() => handleLikeReview(review.id_review)}>
                    <FaThumbsUp />
                    {review.like_count || 0}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveReplyId(
                        activeReplyId === review.id_review ? null : review.id_review,
                      )
                    }
                  >
                    Reply
                  </button>
                </div>

                {review.replies.length > 0 && (
                  <div className="movie-review-replies">
                    {review.replies.map((reply) => (
                      <article className="movie-review-reply" key={reply.id_review}>
                        <div className="movie-review-reply-header">
                          <div className="movie-review-user">
                            <ReviewAvatar review={reply} />
                            <div>
                              <h3>{reply.username}</h3>
                              <p>{formatReviewDate(reply.created_at)}</p>
                            </div>
                          </div>
                          <button
                            className="movie-review-report-button"
                            type="button"
                            onClick={() => handleOpenReport(reply.id_review, "reply review")}
                            aria-label={`Report reply review dari ${reply.username}`}
                            title="Report reply review"
                          >
                            <img src={reportIcon} alt="" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="movie-review-content">{reply.content}</p>
                        <button
                          className="movie-review-like-mini"
                          type="button"
                          onClick={() => handleLikeReview(reply.id_review)}
                        >
                          <FaThumbsUp />
                          {reply.like_count || 0}
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {activeReplyId === review.id_review && (
                  <form
                    className="movie-reply-form"
                    onSubmit={(event) => handleSubmitReply(event, review.id_review)}
                  >
                    <ReviewAvatar user={user} />
                    <input
                      placeholder="Reply..."
                      value={replyContent}
                      onChange={(event) => setReplyContent(event.target.value)}
                    />
                    <button type="submit">Kirim</button>
                  </form>
                )}
              </article>
            ))
          ) : (
            <p className="movie-review-empty">Belum ada review untuk TV series ini.</p>
          )}
        </div>
      </section>

      <footer className="movie-detail-footer">
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
        open={Boolean(pendingWatchlistSeries)}
        item={pendingWatchlistSeries}
        mediaLabel="Series"
        onCancel={() => setPendingWatchlistSeries(null)}
        onConfirm={confirmSaveToWatchlist}
      />
      <ReviewModal
        open={isReviewModalOpen}
        mediaLabel="Series"
        itemTitle={seriesTitle}
        itemPoster={series.poster_url}
        itemYear={getYear(series.first_air_date)}
        itemGenres={(series.genres || []).map((genre) => genre.name)}
        rating={reviewRating}
        content={reviewContent}
        placeholder="Bagikan pendapatmu tentang TV series ini..."
        onRatingChange={setReviewRating}
        onContentChange={setReviewContent}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmit={handleSubmitReview}
      />
      <ReportModal
        open={Boolean(reportTarget)}
        targetLabel={reportTarget?.targetLabel}
        isSubmitting={reportSaving}
        errorMessage={reportError}
        onClose={() => setReportTarget(null)}
        onSubmit={handleSubmitReport}
      />
    </main>
  );
}

export default TVSeriesDetail;
