import express from "express";
import {
  acceptFriendRequest,
  addFriend,
  declineFriendRequest,
  getMyFriendIds,
  getMyFriends,
  getPendingFriendRequests,
  removeFriend,
  searchUsersForFriend,
} from "../controllers/friendController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { requirePremiumFeature } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, requirePremiumFeature, getMyFriends);
router.get("/ids", verifyToken, requirePremiumFeature, getMyFriendIds);
router.get("/requests", verifyToken, requirePremiumFeature, getPendingFriendRequests);
router.get("/search", verifyToken, requirePremiumFeature, searchUsersForFriend);
router.put("/requests/:friendId/accept", verifyToken, requirePremiumFeature, acceptFriendRequest);
router.delete("/requests/:friendId/decline", verifyToken, requirePremiumFeature, declineFriendRequest);
router.post("/:userId", verifyToken, requirePremiumFeature, addFriend);
router.delete("/:userId", verifyToken, requirePremiumFeature, removeFriend);

export default router;
