import express from "express";
import {
  getCommentsByPost,
  createComment
} from "../controllers/commentController.js";
import { optionalToken, verifyToken } from "../middleware/authMiddleware.js";
import { requirePremiumFeature } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

router.get("/:postId", optionalToken, getCommentsByPost);
router.post("/:postId", verifyToken, requirePremiumFeature, createComment);

export default router;
