import express from "express";
import { createContactMessage } from "../controllers/contactController.js";
import { optionalToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", optionalToken, createContactMessage);

export default router;
