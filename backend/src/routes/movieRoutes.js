import express from "express";
import {
  discoverMovies,
  getMovieCredits,
  getMovieDetail,
  getMovieGenres,
  getMovieRecommendations,
  getMovieVideos,
  getMovieWatchProviders,
  getNowPlayingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getTrendingMovies,
  getUpcomingMovies,
  searchMovies,
} from "../controllers/movieController.js";

const router = express.Router();

router.get("/search", searchMovies);
router.get("/popular", getPopularMovies);
router.get("/top-rated", getTopRatedMovies);
router.get("/now-playing", getNowPlayingMovies);
router.get("/upcoming", getUpcomingMovies);
router.get("/trending", getTrendingMovies);
router.get("/genres", getMovieGenres);
router.get("/discover", discoverMovies);
router.get("/:id/recommendations", getMovieRecommendations);
router.get("/:id/videos", getMovieVideos);
router.get("/:id/credits", getMovieCredits);
router.get("/:id/watch-providers", getMovieWatchProviders);
router.get("/:id", getMovieDetail);

export default router;
