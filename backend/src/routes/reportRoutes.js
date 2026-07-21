import express from "express";
import {
  createReport,
  getReportCategories,
} from "../controllers/reportController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/categories", getReportCategories);
router.post("/", verifyToken, createReport);

export default router;
