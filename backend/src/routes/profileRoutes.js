import express from "express";
import {
  getMyProfile,
  getMyProfileActivity,
  deleteMyAccount,
  updateMyPassword,
  updateMyProfileMedia,
  updateMyProfile
} from "../controllers/profileController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", verifyToken, getMyProfile);
router.get("/activity", verifyToken, getMyProfileActivity);
router.put("/me", verifyToken, updateMyProfile);
router.put("/password", verifyToken, updateMyPassword);
router.put("/media", verifyToken, updateMyProfileMedia);
router.delete("/me", verifyToken, deleteMyAccount);

export default router;
