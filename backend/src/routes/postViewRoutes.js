import express from "express";
import { recordPostView } from "../controllers/postViewController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:postId", verifyToken, recordPostView);

export default router;
