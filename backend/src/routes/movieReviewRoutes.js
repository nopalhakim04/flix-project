import express from "express";
import {
  createMovieReview,
  deleteMovieReview,
  getMovieReviews,
  toggleLikeMovieReview,
  updateMovieReview,
} from "../controllers/movieReviewController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:movieId", getMovieReviews);
router.post("/:movieId", verifyToken, createMovieReview);
router.put("/:reviewId", verifyToken, updateMovieReview);
router.delete("/:reviewId", verifyToken, deleteMovieReview);
router.post("/likes/:reviewId", verifyToken, toggleLikeMovieReview);

export default router;
