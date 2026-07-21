import express from "express";
import { reactToPost } from "../controllers/postReactionController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { requirePremiumFeature } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

router.post("/:postId", verifyToken, requirePremiumFeature, reactToPost);

export default router;
