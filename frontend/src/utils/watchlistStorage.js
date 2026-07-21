const readArray = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const readObject = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

const getUniqueStorageIds = (user) => {
  const ids = [
    user?.id_user,
    user?.id,
    user?.user_id,
    user?.email,
    "guest",
  ]
    .map((id) => String(id || "").trim())
    .filter(Boolean);

  return [...new Set(ids)];
};

const mergeWatchlistItems = (items) => {
  const seen = new Set();

  return items.filter((item) => {
    const mediaType = item.media_type || item.mediaType || "";
    const id = item.id || item.tmdbId || item.tmdb_id;
    const key = `${mediaType}:${id}`;

    if (!id || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const getUserStorageId = (user) => {
  const primaryId = user?.id_user || user?.id || user?.user_id || user?.email;
  return String(primaryId || "guest");
};

export const getMovieWatchlistKey = (user) =>
  `flix_movie_watchlist_${getUserStorageId(user)}`;

export const getSeriesWatchlistKey = (user) =>
  `flix_tv_watchlist_${getUserStorageId(user)}`;

export const getWatchStatusKey = (user) =>
  `flix_watchlist_status_${getUserStorageId(user)}`;

export const getMoodHistoryKey = (user) =>
  `flix_mood_history_${getUserStorageId(user)}`;

export const readWatchlist = (user, mediaType) => {
  const prefix = mediaType === "tv" ? "flix_tv_watchlist" : "flix_movie_watchlist";
  const primaryKey =
    mediaType === "tv" ? getSeriesWatchlistKey(user) : getMovieWatchlistKey(user);
  const mergedItems = mergeWatchlistItems(
    getUniqueStorageIds(user).flatMap((id) => readArray(`${prefix}_${id}`)),
  );

  if (getUserStorageId(user) !== "guest" && mergedItems.length) {
    localStorage.setItem(primaryKey, JSON.stringify(mergedItems));
  }

  return mergedItems;
};

export const readWatchStatus = (user) => {
  const mergedStatus = getUniqueStorageIds(user).reduce(
    (result, id) => ({
      ...result,
      ...readObject(`flix_watchlist_status_${id}`),
    }),
    {},
  );

  if (getUserStorageId(user) !== "guest" && Object.keys(mergedStatus).length) {
    localStorage.setItem(getWatchStatusKey(user), JSON.stringify(mergedStatus));
  }

  return mergedStatus;
};

export const readMoodHistory = (user) => {
  const mergedHistory = getUniqueStorageIds(user).reduce(
    (result, id) => ({
      ...result,
      ...readObject(`flix_mood_history_${id}`),
    }),
    {},
  );

  if (getUserStorageId(user) !== "guest" && Object.keys(mergedHistory).length) {
    localStorage.setItem(getMoodHistoryKey(user), JSON.stringify(mergedHistory));
  }

  return mergedHistory;
};
