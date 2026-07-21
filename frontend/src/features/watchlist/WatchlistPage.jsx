import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import SiteNavbar from "@/components/layout/SiteNavbar";
import { requireLogin } from "@/utils/authPrompt";
import {
  getMovieWatchlistKey,
  getSeriesWatchlistKey,
  getWatchStatusKey,
  readWatchlist as readStoredWatchlist,
  readWatchStatus,
} from "@/utils/watchlistStorage";
import bookmarkIcon from "@/assets/icon/bookmark-icon.svg";
import checkIcon from "@/assets/icon/check-icon.svg";
import clockIcon from "@/assets/icon/clock-icon.svg";
import closeIcon from "@/assets/icon/close-icon.svg";
import facebookIcon from "@/assets/icon/facebook-icon.svg";
import filterIcon from "@/assets/icon/sliders-horizontal-icon.svg";
import searchIcon from "@/assets/icon/search-line-icon.svg";
import starIcon from "@/assets/icon/star-icon.svg";
import twitterIcon from "@/assets/icon/twitter-icon.svg";
import youtubeIcon from "@/assets/icon/youtube-icon.svg";
import "./WatchlistPage.css";

const apiUrl = import.meta.env.VITE_API_URL;

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

const getItemKey = (item) => `${item.mediaType}:${item.id}`;
const getSeriesStatusKey = (seriesId) => `tv:${seriesId}`;
const getEpisodeStatusKey = (seriesId, seasonNumber, episodeNumber) =>
  `tv:${seriesId}:s${seasonNumber}:e${episodeNumber}`;
const getSeasonEpisodesKey = (seriesId, seasonNumber) =>
  `${seriesId}:${seasonNumber}`;

const getAvailableSeasons = (series) =>
  (series?.seasons || [])
    .filter((season) => Number(season.season_number) > 0)
    .filter((season) => Number(season.episode_count || 0) > 0)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number));

const getTotalEpisodeCount = (series) => {
  const tmdbTotal = Number(series?.number_of_episodes || 0);

  if (tmdbTotal > 0) {
    return tmdbTotal;
  }

  return getAvailableSeasons(series).reduce(
    (total, season) => total + Number(season.episode_count || 0),
    0,
  );
};

const normalizeItem = (item, mediaType) => ({
  ...item,
  mediaType,
  title: item.title || item.name || item.original_name || "Untitled",
  poster: item.poster || item.poster_url,
  year: item.year || item.releaseLabel?.slice?.(-4) || "-",
  rating: item.rating || "-",
  overview: item.overview || "Deskripsi belum tersedia.",
});

function WatchlistCard({
  item,
  watched,
  watchStatus,
  seriesDetail,
  selectedSeasonNumber,
  seasonEpisodes,
  episodesLoading,
  onOpen,
  onSelectSeason,
  onToggleEpisodeWatched,
  onToggleWatched,
  onRemove,
}) {
  const [isEpisodePickerOpen, setIsEpisodePickerOpen] = useState(false);
  const [isSeasonPickerOpen, setIsSeasonPickerOpen] = useState(false);
  const seriesSource = seriesDetail || item;
  const availableSeasons = item.mediaType === "tv" ? getAvailableSeasons(seriesSource) : [];
  const selectedSeason =
    availableSeasons.find(
      (season) => String(season.season_number) === String(selectedSeasonNumber),
    ) || availableSeasons[0];
  const activeSeasonNumber = selectedSeason?.season_number || selectedSeasonNumber;
  const watchedSeasonEpisodeCount = seasonEpisodes.filter((episode) =>
    Boolean(
      watchStatus[
        getEpisodeStatusKey(item.id, activeSeasonNumber, episode.episode_number)
      ],
    ),
  ).length;

  useEffect(() => {
    setIsEpisodePickerOpen(false);
    setIsSeasonPickerOpen(false);
  }, [activeSeasonNumber, item.id]);

  return (
    <article className="watchlist-card">
      <button
        className="watchlist-card__poster"
        type="button"
        onClick={() => onOpen(item)}
        aria-label={`Buka detail ${item.title}`}
      >
        <img src={item.poster} alt={item.title} />
        <span className={watched ? "is-watched" : ""}>
          {watched ? "Sudah Ditonton" : "Belum Ditonton"}
        </span>
      </button>

      <div className="watchlist-card__body">
        <p>{item.mediaType === "tv" ? "TV Series" : "Film"}</p>
        <h3>{item.title}</h3>
        <div className="watchlist-card__meta">
          <span>{item.year}</span>
          <span>
            <img src={starIcon} alt="" />
            {item.rating}
          </span>
        </div>
      </div>

      {item.mediaType === "tv" && (
        <div className="watchlist-card__series-progress">
          {availableSeasons.length > 0 ? (
            <>
              <div className="watchlist-card__season-field">
                <span>Season</span>
                <div className="watchlist-card__season-control">
                  <button
                    className={isSeasonPickerOpen ? "is-open" : ""}
                    type="button"
                    onClick={() => setIsSeasonPickerOpen((current) => !current)}
                    aria-expanded={isSeasonPickerOpen}
                  >
                    {activeSeasonNumber || 1}
                  </button>
                  {isSeasonPickerOpen && (
                    <div className="watchlist-card__season-menu">
                      {availableSeasons.map((season) => (
                        <button
                          className={
                            String(season.season_number) === String(activeSeasonNumber)
                              ? "is-active"
                              : ""
                          }
                          key={season.id || season.season_number}
                          type="button"
                          onClick={() => {
                            onSelectSeason(item, season.season_number);
                            setIsSeasonPickerOpen(false);
                          }}
                        >
                          Season {season.season_number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="watchlist-card__episode-list">
                <div className="watchlist-card__episode-head">
                  <span>Episode</span>
                  {episodesLoading ? (
                    <p>Memuat episode...</p>
                  ) : seasonEpisodes.length > 0 ? (
                    <button
                      className={isEpisodePickerOpen ? "is-open" : ""}
                      type="button"
                      onClick={() => setIsEpisodePickerOpen((current) => !current)}
                      aria-expanded={isEpisodePickerOpen}
                    >
                      {watchedSeasonEpisodeCount}/{seasonEpisodes.length} ditonton
                    </button>
                  ) : (
                    <p>Episode belum tersedia.</p>
                  )}
                </div>

                {isEpisodePickerOpen && seasonEpisodes.length > 0 && (
                  <div className="watchlist-card__episode-scroll">
                    {seasonEpisodes.map((episode) => {
                      const isEpisodeWatched = Boolean(
                        watchStatus[
                          getEpisodeStatusKey(
                            item.id,
                            activeSeasonNumber,
                            episode.episode_number,
                          )
                        ],
                      );

                      return (
                        <label
                          className={
                            isEpisodeWatched
                              ? "watchlist-card__episode-row is-active"
                              : "watchlist-card__episode-row"
                          }
                          key={episode.id || episode.episode_number}
                        >
                          <input
                            checked={isEpisodeWatched}
                            type="checkbox"
                            onChange={() => onToggleEpisodeWatched(item, episode)}
                          />
                          <span>Episode {episode.episode_number}</span>
                          <strong>{isEpisodeWatched ? "Ditonton" : "Belum"}</strong>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="watchlist-card__series-empty">Data episode belum tersedia.</p>
          )}
        </div>
      )}

      <div className="watchlist-card__actions">
        <button
          type="button"
          onClick={() => onToggleWatched(item)}
          className={watched ? "is-active" : ""}
        >
          <img src={watched ? checkIcon : clockIcon} alt="" />
          {item.mediaType === "tv"
            ? watched
              ? "Sudah ditonton"
              : "Tandai sudah ditonton"
            : watched
              ? "Sudah ditonton"
              : "Tandai sudah ditonton"}
        </button>
        <button type="button" onClick={() => onRemove(item)} aria-label="Hapus dari watchlist">
          <img src={closeIcon} alt="" />
        </button>
      </div>
    </article>
  );
}

function WatchlistPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = useMemo(() => getStoredUser(), []);
  const movieWatchlistKey = useMemo(() => getMovieWatchlistKey(user), [user]);
  const seriesWatchlistKey = useMemo(() => getSeriesWatchlistKey(user), [user]);
  const watchStatusKey = useMemo(() => getWatchStatusKey(user), [user]);

  const [movieWatchlist, setMovieWatchlist] = useState(() =>
    readStoredWatchlist(user, "movie"),
  );
  const [seriesWatchlist, setSeriesWatchlist] = useState(() =>
    readStoredWatchlist(user, "tv"),
  );
  const [watchStatus, setWatchStatus] = useState(() =>
    readWatchStatus(user),
  );
  const [seriesDetails, setSeriesDetails] = useState({});
  const [seriesSeasonSelection, setSeriesSeasonSelection] = useState({});
  const [seriesEpisodes, setSeriesEpisodes] = useState({});
  const [seriesDetailsLoading, setSeriesDetailsLoading] = useState({});
  const [seriesEpisodesLoading, setSeriesEpisodesLoading] = useState({});
  const requestedSeriesDetailsRef = useRef(new Set());
  const requestedSeasonEpisodesRef = useRef(new Set());
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [showFilter, setShowFilter] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState(null);

  useEffect(() => {
    if (!token) {
      requireLogin();
    }
  }, [token]);

  useEffect(() => {
    localStorage.setItem(movieWatchlistKey, JSON.stringify(movieWatchlist));
  }, [movieWatchlist, movieWatchlistKey]);

  useEffect(() => {
    localStorage.setItem(seriesWatchlistKey, JSON.stringify(seriesWatchlist));
  }, [seriesWatchlist, seriesWatchlistKey]);

  useEffect(() => {
    localStorage.setItem(watchStatusKey, JSON.stringify(watchStatus));
  }, [watchStatus, watchStatusKey]);

  useEffect(() => {
    seriesWatchlist.forEach((series) => {
      const seriesId = String(series.id);

      if (
        Object.prototype.hasOwnProperty.call(seriesDetails, seriesId) ||
        requestedSeriesDetailsRef.current.has(seriesId)
      ) {
        return;
      }

      requestedSeriesDetailsRef.current.add(seriesId);
      setSeriesDetailsLoading((current) => ({
        ...current,
        [seriesId]: true,
      }));

      axios
        .get(`${apiUrl}/api/tv-series/${seriesId}`, {
          params: { language: "id-ID" },
        })
        .then((response) => {
          setSeriesDetails((current) => ({
            ...current,
            [seriesId]: response.data,
          }));
        })
        .catch(() => {
          setSeriesDetails((current) => ({
            ...current,
            [seriesId]: series,
          }));
        })
        .finally(() => {
          setSeriesDetailsLoading((current) => ({
            ...current,
            [seriesId]: false,
          }));
        });
    });
  }, [seriesWatchlist, seriesDetails]);

  useEffect(() => {
    setSeriesSeasonSelection((current) => {
      let didChange = false;
      const nextSelection = { ...current };

      seriesWatchlist.forEach((series) => {
        const seriesId = String(series.id);

        if (nextSelection[seriesId]) {
          return;
        }

        const seriesSource = seriesDetails[seriesId] || series;
        const firstSeason = getAvailableSeasons(seriesSource)[0];

        if (firstSeason?.season_number) {
          nextSelection[seriesId] = Number(firstSeason.season_number);
          didChange = true;
        }
      });

      return didChange ? nextSelection : current;
    });
  }, [seriesWatchlist, seriesDetails]);

  useEffect(() => {
    Object.entries(seriesSeasonSelection).forEach(([seriesId, seasonNumber]) => {
      const seasonKey = getSeasonEpisodesKey(seriesId, seasonNumber);

      if (
        !seriesWatchlist.some((series) => String(series.id) === seriesId) ||
        Object.prototype.hasOwnProperty.call(seriesEpisodes, seasonKey) ||
        requestedSeasonEpisodesRef.current.has(seasonKey)
      ) {
        return;
      }

      requestedSeasonEpisodesRef.current.add(seasonKey);
      setSeriesEpisodesLoading((current) => ({
        ...current,
        [seasonKey]: true,
      }));

      axios
        .get(`${apiUrl}/api/tv-series/${seriesId}/seasons/${seasonNumber}`, {
          params: { language: "id-ID" },
        })
        .then((response) => {
          setSeriesEpisodes((current) => ({
            ...current,
            [seasonKey]: response.data.episodes || [],
          }));
        })
        .catch(() => {
          setSeriesEpisodes((current) => ({
            ...current,
            [seasonKey]: [],
          }));
        })
        .finally(() => {
          setSeriesEpisodesLoading((current) => ({
            ...current,
            [seasonKey]: false,
          }));
        });
    });
  }, [seriesEpisodes, seriesSeasonSelection, seriesWatchlist]);

  const watchlistItems = useMemo(
    () => [
      ...movieWatchlist.map((item) => normalizeItem(item, "movie")),
      ...seriesWatchlist.map((item) => normalizeItem(item, "tv")),
    ],
    [movieWatchlist, seriesWatchlist],
  );

  const watchedCount = watchlistItems.filter((item) => watchStatus[getItemKey(item)]).length;
  const unwatchedCount = watchlistItems.length - watchedCount;

  const visibleItems = watchlistItems.filter((item) => {
    const itemWatched = Boolean(watchStatus[getItemKey(item)]);
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "watched" && itemWatched) ||
      (activeTab === "unwatched" && !itemWatched);
    const matchesMedia = mediaFilter === "all" || item.mediaType === mediaFilter;
    const matchesSearch = item.title
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());

    return matchesTab && matchesMedia && matchesSearch;
  });

  const removeItem = (item) => {
    if (item.mediaType === "movie") {
      setMovieWatchlist((current) =>
        current.filter((movie) => String(movie.id) !== String(item.id)),
      );
    } else {
      setSeriesWatchlist((current) =>
        current.filter((series) => String(series.id) !== String(item.id)),
      );
    }

    setWatchStatus((current) => {
      const nextStatus = { ...current };
      const itemKey = getItemKey(item);
      delete nextStatus[itemKey];

      if (item.mediaType === "tv") {
        const episodePrefix = `tv:${item.id}:s`;
        Object.keys(nextStatus).forEach((statusKey) => {
          if (statusKey.startsWith(episodePrefix)) {
            delete nextStatus[statusKey];
          }
        });
      }

      return nextStatus;
    });
  };

  const toggleWatched = (item) => {
    if (!requireLogin()) {
      return;
    }

    if (item.mediaType !== "tv") {
      setWatchStatus((current) => ({
        ...current,
        [getItemKey(item)]: !current[getItemKey(item)],
      }));
      return;
    }

    const seriesId = String(item.id);
    const seriesSource = seriesDetails[seriesId] || item;
    const availableSeriesSeasons = getAvailableSeasons(seriesSource);

    setWatchStatus((current) => {
      const shouldMarkWatched = !current[getSeriesStatusKey(seriesId)];
      const nextStatus = { ...current };
      const episodePrefix = `tv:${seriesId}:s`;

      if (!shouldMarkWatched) {
        delete nextStatus[getSeriesStatusKey(seriesId)];
        Object.keys(nextStatus).forEach((statusKey) => {
          if (statusKey.startsWith(episodePrefix)) {
            delete nextStatus[statusKey];
          }
        });
        return nextStatus;
      }

      nextStatus[getSeriesStatusKey(seriesId)] = true;

      availableSeriesSeasons.forEach((season) => {
        const seasonNumber = Number(season.season_number);
        const episodeCount = Number(season.episode_count || 0);

        for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber += 1) {
          nextStatus[getEpisodeStatusKey(seriesId, seasonNumber, episodeNumber)] = true;
        }
      });

      return nextStatus;
    });
  };

  const selectSeriesSeason = (item, seasonNumber) => {
    setSeriesSeasonSelection((current) => ({
      ...current,
      [String(item.id)]: Number(seasonNumber),
    }));
  };

  const toggleSeriesEpisodeWatched = (item, episode) => {
    if (!requireLogin()) {
      return;
    }

    const seriesId = String(item.id);
    const seasonNumber = seriesSeasonSelection[seriesId] || episode.season_number || 1;
    const episodeKey = getEpisodeStatusKey(seriesId, seasonNumber, episode.episode_number);
    const seasonKey = getSeasonEpisodesKey(seriesId, seasonNumber);
    const currentSeasonEpisodes = seriesEpisodes[seasonKey] || [];
    const seriesSource = seriesDetails[seriesId] || item;
    const totalEpisodes = getTotalEpisodeCount(seriesSource);

    setWatchStatus((current) => {
      const shouldMarkWatched = !current[episodeKey];
      const nextStatus = { ...current };

      currentSeasonEpisodes.forEach((seasonEpisode) => {
        const currentEpisodeNumber = Number(seasonEpisode.episode_number);
        const clickedEpisodeNumber = Number(episode.episode_number);
        const currentEpisodeKey = getEpisodeStatusKey(
          seriesId,
          seasonNumber,
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

      const watchedEpisodeCount = Object.entries(nextStatus).filter(
        ([statusKey, value]) =>
          statusKey.startsWith(`tv:${seriesId}:s`) && Boolean(value),
      ).length;

      nextStatus[getSeriesStatusKey(seriesId)] =
        totalEpisodes > 0 && watchedEpisodeCount >= totalEpisodes;

      return nextStatus;
    });
  };

  const openDetail = (item) => {
    navigate(item.mediaType === "tv" ? `/tv-series/${item.id}` : `/movie/${item.id}`);
  };

  const confirmRemoveItem = () => {
    if (!requireLogin()) {
      return;
    }

    if (!removeCandidate) {
      return;
    }

    removeItem(removeCandidate);
    setRemoveCandidate(null);
  };

  const tabs = [
    { key: "all", label: "Semua", count: watchlistItems.length },
    { key: "unwatched", label: "Belum Ditonton", count: unwatchedCount },
    { key: "watched", label: "Sudah Ditonton", count: watchedCount },
  ];

  return (
    <main className="watchlist-page">
      <SiteNavbar mode="fixed" />

      <section className="watchlist-hero">
        <div className="watchlist-eyebrow">
          <span />
          My Collection
        </div>
        <h1>
          Watchlist <strong>Saya</strong>
        </h1>
        <p>Film &amp; series yang ingin kamu tonton.</p>

        <div className="watchlist-dashboard">
          <div className="watchlist-stat-card">
            <strong>{watchlistItems.length}</strong>
            <span>Film Tersimpan</span>
            <img src={bookmarkIcon} alt="" />
          </div>
          <div className="watchlist-stat-card">
            <strong>{watchedCount}</strong>
            <span>Sudah Ditonton</span>
            <img src={checkIcon} alt="" />
          </div>
          <div className="watchlist-stat-card">
            <strong>{unwatchedCount}</strong>
            <span>Belum Ditonton</span>
            <img src={clockIcon} alt="" />
          </div>

          <div className="watchlist-tools">
            <label>
              <img src={searchIcon} alt="" />
              <input
                type="search"
                placeholder="Cari Film di Watchlist..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="watchlist-filter">
              <button type="button" onClick={() => setShowFilter((current) => !current)}>
                <img src={filterIcon} alt="" />
                Filter
              </button>
              {showFilter && (
                <div className="watchlist-filter__menu">
                  {[
                    ["all", "Semua"],
                    ["movie", "Film"],
                    ["tv", "TV Series"],
                  ].map(([value, label]) => (
                    <button
                      className={mediaFilter === value ? "is-active" : ""}
                      key={value}
                      type="button"
                      onClick={() => {
                        setMediaFilter(value);
                        setShowFilter(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="watchlist-content">
        <div className="watchlist-tabs" role="tablist" aria-label="Filter status watchlist">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.key ? "is-active" : ""}
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </div>

        {visibleItems.length > 0 ? (
          <div className="watchlist-grid">
            {visibleItems.map((item) => (
              <WatchlistCard
                key={getItemKey(item)}
                item={item}
                watched={Boolean(watchStatus[getItemKey(item)])}
                watchStatus={watchStatus}
                seriesDetail={seriesDetails[String(item.id)]}
                selectedSeasonNumber={seriesSeasonSelection[String(item.id)]}
                seasonEpisodes={
                  seriesEpisodes[
                    getSeasonEpisodesKey(
                      item.id,
                      seriesSeasonSelection[String(item.id)] || 1,
                    )
                  ] || []
                }
                episodesLoading={Boolean(
                  seriesEpisodesLoading[
                    getSeasonEpisodesKey(
                      item.id,
                      seriesSeasonSelection[String(item.id)] || 1,
                    )
                  ],
                )}
                onOpen={openDetail}
                onSelectSeason={selectSeriesSeason}
                onToggleEpisodeWatched={toggleSeriesEpisodeWatched}
                onToggleWatched={toggleWatched}
                onRemove={setRemoveCandidate}
              />
            ))}
          </div>
        ) : (
          <div className="watchlist-empty">
            <h2>Ayo cari Film dan simpan ke Watchlist</h2>
            <p>Film yang kamu simpan akan muncul disini.</p>
            <button type="button" onClick={() => navigate("/movies")}>
              Cari Film
            </button>
          </div>
        )}
      </section>

      {removeCandidate && (
        <div
          className="watchlist-remove-modal"
          role="presentation"
          onClick={() => setRemoveCandidate(null)}
        >
          <section
            className="watchlist-remove-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="watchlist-remove-title"
            onClick={(event) => event.stopPropagation()}
          >
            {removeCandidate.poster && (
              <img
                className="watchlist-remove-modal__poster"
                src={removeCandidate.poster}
                alt={removeCandidate.title}
              />
            )}
            <div>
              <h2 id="watchlist-remove-title">
                Hapus{" "}
                {removeCandidate.mediaType === "tv" ? "series" : "film"}{" "}
                <strong>{removeCandidate.title}</strong> dari Watchlist?
              </h2>
              <div className="watchlist-remove-modal__actions">
                <button
                  className="watchlist-remove-modal__cancel"
                  type="button"
                  onClick={() => setRemoveCandidate(null)}
                >
                  Batal
                </button>
                <button
                  className="watchlist-remove-modal__delete"
                  type="button"
                  onClick={confirmRemoveItem}
                >
                  Hapus
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <footer className="watchlist-footer">
        <nav aria-label="Footer navigation">
          <Link to="/">Home</Link>
          <Link to="/movies">Movie</Link>
          <Link to="/tv-series">TV Series</Link>
          <Link to="/genre">Genre</Link>
          <Link to="/community">Community</Link>
          <Link to="/contact-us">Contact Us</Link>
        </nav>
        <div>
          <img src={facebookIcon} alt="Facebook" />
          <img src={twitterIcon} alt="Twitter" />
          <img src={youtubeIcon} alt="YouTube" />
        </div>
        <p>Copyright 2026 - Kelompok 5</p>
      </footer>
    </main>
  );
}

export default WatchlistPage;
