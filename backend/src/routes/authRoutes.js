import express from "express";
import {
  bootstrapAdmin,
  forgotPassword,
  login,
  register,
  resetPassword,
  verifyEmail
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/bootstrap-admin", bootstrapAdmin);

export default router;
