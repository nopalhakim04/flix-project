import express from "express";
import { getPostInsight } from "../controllers/postInsightController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:postId", verifyToken, getPostInsight);

export default router;