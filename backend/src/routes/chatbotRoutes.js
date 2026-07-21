import express from "express";
import { askFlixChatbot } from "../controllers/chatbotController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { requireExclusiveFeature } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, requireExclusiveFeature, askFlixChatbot);

export default router;
