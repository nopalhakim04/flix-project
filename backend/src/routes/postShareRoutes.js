import express from "express";
import { logPostShare } from "../controllers/postShareController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { requirePremiumFeature } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

router.post("/:postId", verifyToken, requirePremiumFeature, logPostShare);

export default router;
