import express from "express";
import multer from "multer";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  addCustomerServiceMessage,
  claimCustomerServiceTicket,
  closeCustomerServiceTicket,
  getAdminCustomerServiceTickets,
  getCustomerServiceTicketDetail,
} from "../controllers/customerServiceController.js";
import {
  createAdminMovie,
  getAdminCommunity,
  getAdminContactMessages,
  getAdminDashboard,
  getAdminMovies,
  getAdminPaymentSettings,
  getAdminReviews,
  getAdminTransactions,
  getAdminUserDetail,
  getAdminUsers,
  deleteAdminUser,
  resetAdminUserPassword,
  updateAdminTransactionStatus,
  updateAdminCommunityReportStatus,
  updateAdminContactMessageStatus,
  updateAdminPaymentSettings,
  updateAdminReviewReportStatus,
  updateAdminUser,
  updateAdminUserStatus,
  updateAdminMovie
} from "../controllers/adminController.js";

const router = express.Router();
const maxCustomerServiceAttachmentSize = 2 * 1024 * 1024;
const maxCustomerServiceAttachmentCount = 2;

const adminUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("File harus berupa gambar, PDF, DOC, atau DOCX"), false);
  },
  limits: {
    fileSize: maxCustomerServiceAttachmentSize,
    files: maxCustomerServiceAttachmentCount,
  },
});

const uploadCustomerServiceAttachments = (req, res, next) => {
  adminUpload.array("attachments", maxCustomerServiceAttachmentCount)(req, res, (error) => {
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

router.get(
  "/dashboard",
  verifyToken,
  allowRoles("admin"),
  getAdminDashboard
);

router.get(
  "/movies",
  verifyToken,
  allowRoles("admin", "moderator"),
  getAdminMovies
);

router.post(
  "/movies",
  verifyToken,
  allowRoles("admin", "moderator"),
  createAdminMovie
);

router.put(
  "/movies/:id",
  verifyToken,
  allowRoles("admin", "moderator"),
  updateAdminMovie
);

router.get(
  "/reviews",
  verifyToken,
  allowRoles("admin", "moderator"),
  getAdminReviews
);

router.patch(
  "/reviews/reports/:reportId/status",
  verifyToken,
  allowRoles("admin", "moderator"),
  updateAdminReviewReportStatus
);

router.get(
  "/community",
  verifyToken,
  allowRoles("admin", "moderator"),
  getAdminCommunity
);

router.get(
  "/contact-us",
  verifyToken,
  allowRoles("admin", "moderator"),
  getAdminContactMessages
);

router.get(
  "/customer-service/tickets",
  verifyToken,
  allowRoles("admin", "moderator"),
  getAdminCustomerServiceTickets
);

router.get(
  "/customer-service/tickets/:id",
  verifyToken,
  allowRoles("admin", "moderator"),
  getCustomerServiceTicketDetail
);

router.patch(
  "/customer-service/tickets/:id/claim",
  verifyToken,
  allowRoles("admin", "moderator"),
  claimCustomerServiceTicket
);

router.post(
  "/customer-service/tickets/:id/messages",
  verifyToken,
  allowRoles("admin", "moderator"),
  uploadCustomerServiceAttachments,
  addCustomerServiceMessage
);

router.patch(
  "/customer-service/tickets/:id/close",
  verifyToken,
  allowRoles("admin", "moderator"),
  closeCustomerServiceTicket
);

router.patch(
  "/contact-us/:id/status",
  verifyToken,
  allowRoles("admin", "moderator"),
  updateAdminContactMessageStatus
);

router.get(
  "/transactions",
  verifyToken,
  allowRoles("admin", "moderator"),
  getAdminTransactions
);

router.patch(
  "/transactions/:id/status",
  verifyToken,
  allowRoles("admin", "moderator"),
  updateAdminTransactionStatus
);

router.get(
  "/payment-settings",
  verifyToken,
  allowRoles("admin", "moderator"),
  getAdminPaymentSettings
);

router.put(
  "/payment-settings",
  verifyToken,
  allowRoles("admin", "moderator"),
  updateAdminPaymentSettings
);

router.patch(
  "/community/reports/:reportId/status",
  verifyToken,
  allowRoles("admin", "moderator"),
  updateAdminCommunityReportStatus
);

router.get(
  "/users",
  verifyToken,
  allowRoles("admin"),
  getAdminUsers
);

router.get(
  "/users/:id",
  verifyToken,
  allowRoles("admin"),
  getAdminUserDetail
);

router.put(
  "/users/:id",
  verifyToken,
  allowRoles("admin"),
  updateAdminUser
);

router.post(
  "/users/:id/reset-password",
  verifyToken,
  allowRoles("admin"),
  resetAdminUserPassword
);

router.delete(
  "/users/:id",
  verifyToken,
  allowRoles("admin"),
  deleteAdminUser
);

router.patch(
  "/users/:id/status",
  verifyToken,
  allowRoles("admin"),
  updateAdminUserStatus
);

export default router;
