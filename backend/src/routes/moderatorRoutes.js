import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/dashboard",
  verifyToken,
  allowRoles("moderator", "admin"),
  (req, res) => {
    res.json({
      message: "Selamat datang di dashboard moderator",
      user: req.user
    });
  }
);

export default router;