import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/authMiddleware.js";
import { fileToDataUrl } from "../utils/uploadDataUrl.js";

const router = express.Router();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File harus berupa gambar JPG, PNG, atau WEBP"), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

router.post("/editor-image", verifyToken, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Gambar tidak ditemukan"
      });
    }

    return res.json({
      message: "Upload berhasil",
      imageUrl: fileToDataUrl(req.file)
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal upload gambar editor",
      error: error.message
    });
  }
});

export default router;
