import express from "express";
import {
  addToWatchlist,
  getMyWatchlist,
  removeFromWatchlist,
} from "../controllers/watchlistController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getMyWatchlist);
router.post("/", verifyToken, addToWatchlist);
router.delete("/:mediaType/:tmdbId", verifyToken, removeFromWatchlist);

export default router;
