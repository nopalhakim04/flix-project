import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const isDecodedUserActive = async (decoded) => {
  if (!decoded?.id_user) {
    return false;
  }

  const result = await pool.query(
    "SELECT is_active FROM flix.users WHERE id_user = $1",
    [decoded.id_user],
  );

  if (!result.rows.length) {
    return false;
  }

  return result.rows[0].is_active !== false;
};

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token tidak ditemukan"
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!(await isDecodedUserActive(decoded))) {
      return res.status(403).json({
        message: "Akun dinonaktifkan oleh admin"
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token tidak valid"
    });
  }
};

export const optionalToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = (await isDecodedUserActive(decoded)) ? decoded : null;
  } catch (error) {
    req.user = null;
  }

  return next();
};

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "User belum login"
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Akses ditolak"
      });
    }

    next();
  };
};
