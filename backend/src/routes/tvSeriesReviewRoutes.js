import express from "express";
import {
  createTvSeriesReview,
  deleteTvSeriesReview,
  getTvSeriesReviews,
  toggleLikeTvSeriesReview,
  updateTvSeriesReview,
} from "../controllers/tvSeriesReviewController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:seriesId", getTvSeriesReviews);
router.post("/:seriesId", verifyToken, createTvSeriesReview);
router.put("/:reviewId", verifyToken, updateTvSeriesReview);
router.delete("/:reviewId", verifyToken, deleteTvSeriesReview);
router.post("/likes/:reviewId", verifyToken, toggleLikeTvSeriesReview);

export default router;
