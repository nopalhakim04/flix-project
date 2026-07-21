import express from "express";
import {
  getConversationMessages,
  getMyConversations,
  sendMessage,
  startConversation,
} from "../controllers/chatController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { requirePremiumFeature } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

router.get("/conversations", verifyToken, requirePremiumFeature, getMyConversations);
router.post("/conversations/:userId", verifyToken, requirePremiumFeature, startConversation);
router.get("/conversations/:conversationId/messages", verifyToken, requirePremiumFeature, getConversationMessages);
router.post("/conversations/:conversationId/messages", verifyToken, requirePremiumFeature, sendMessage);

export default router;
