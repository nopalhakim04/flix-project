import express from "express";
import {
  getMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../controllers/notificationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getMyNotifications);
router.put("/read-all", verifyToken, markAllNotificationsAsRead);
router.put("/:id/read", verifyToken, markNotificationAsRead);

export default router;
