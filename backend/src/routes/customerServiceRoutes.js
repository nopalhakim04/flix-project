import express from "express";
import multer from "multer";
import {
  addCustomerServiceMessage,
  createCustomerServiceTicket,
  getCustomerServiceTicketDetail,
  getMyCustomerServiceTickets,
} from "../controllers/customerServiceController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const maxAttachmentSize = 2 * 1024 * 1024;
const maxAttachmentCount = 2;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("File harus berupa gambar, PDF, DOC, atau DOCX"), false);
  },
  limits: {
    fileSize: maxAttachmentSize,
    files: maxAttachmentCount,
  },
});

const uploadAttachments = (req, res, next) => {
  upload.array("attachments", maxAttachmentCount)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Ukuran tiap lampiran maksimal 2 MB."
          : error.code === "LIMIT_FILE_COUNT"
            ? "Lampiran maksimal 2 file."
            : "Lampiran customer service tidak valid.";

      res.status(400).json({ message });
      return;
    }

    res.status(400).json({ message: error.message || "Lampiran customer service tidak valid." });
  });
};

router.get("/tickets", verifyToken, getMyCustomerServiceTickets);
router.post("/tickets", verifyToken, uploadAttachments, createCustomerServiceTicket);
router.get("/tickets/:id", verifyToken, getCustomerServiceTicketDetail);
router.post("/tickets/:id/messages", verifyToken, uploadAttachments, addCustomerServiceMessage);

export default router;
