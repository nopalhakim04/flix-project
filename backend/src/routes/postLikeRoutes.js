import express from "express";
import { toggleLikePost } from "../controllers/postLikeController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { requirePremiumFeature } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

router.post("/:postId", verifyToken, requirePremiumFeature, toggleLikePost);

export default router;
