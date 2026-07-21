import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import flixLogo from "@/assets/flix-logo.png";
import "./Login.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const hasSubmitted = useRef(false);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Memverifikasi akun kamu...");

  useEffect(() => {
    const verifyAccount = async () => {
      if (hasSubmitted.current) {
        return;
      }

      hasSubmitted.current = true;

      if (!token) {
        setStatus("error");
        setMessage("Token verifikasi tidak ditemukan.");
        return;
      }

      try {
        const response = await axios.post(`${API_URL}/api/auth/verify-email`, {
          token,
        });

        setStatus("success");
        setMessage(response.data.message || "Akun berhasil diverifikasi.");
      } catch (error) {
        setStatus("error");
        setMessage(error.response?.data?.message || "Gagal verifikasi akun.");
      }
    };

    verifyAccount();
  }, [token]);

  return (
    <main className="login-page">
      <img className="login-logo" src={flixLogo} alt="FLIX" />

      <section className="login-shell forgot-shell auth-status-shell">
        <p className={`auth-status-badge auth-status-badge--${status}`}>
          {status === "loading" ? "Verifikasi" : status === "success" ? "Berhasil" : "Gagal"}
        </p>
        <h1 className="login-title">Verifikasi Akun</h1>
        <p className="login-subtitle">{message}</p>

        <div className="auth-status-actions">
          <Link className="login-submit auth-status-link" to="/login">
            Ke Login
          </Link>
          <Link className="login-link-button auth-status-secondary" to="/register">
            Buat akun baru
          </Link>
        </div>
      </section>
    </main>
  );
}

export default VerifyEmail;
