import express from "express";
import { getPollByPostId, votePoll } from "../controllers/pollController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { requirePremiumFeature } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

router.get("/post/:postId", getPollByPostId);
router.post("/:pollId/vote", verifyToken, requirePremiumFeature, votePoll);

export default router;
