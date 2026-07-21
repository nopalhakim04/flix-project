import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import flixAdminLogo from "@/assets/flixadmin-logo.png";
import { getUpgradeTargetPath, hasPendingPayment } from "@/utils/authPrompt";
import "./LoginRequiredModal.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function LoginRequiredModal() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [targetPath, setTargetPath] = useState("/premium");

  useEffect(() => {
    const handleOpen = () => {
      setMode("login");
      setMessage("");
      setTargetPath("/register");
      setOpen(true);
    };
    const handleUpgradeOpen = async (event) => {
      setMode("upgrade");
      setMessage(event.detail?.message || "Fitur ini hanya tersedia untuk pengguna Premium atau Eksklusif.");
      setTargetPath(event.detail?.targetPath || "/premium");
      setOpen(true);

      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          return;
        }

        const profile = await response.json();
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}") || {};
        const nextUser = {
          ...storedUser,
          ...profile,
          role: profile.role_name || profile.role,
        };
        const shouldContinuePayment =
          hasPendingPayment(storedUser) ||
          hasPendingPayment(profile) ||
          hasPendingPayment(nextUser);
        const resolvedUser = shouldContinuePayment
          ? { ...nextUser, pending_payment_status: "pending" }
          : nextUser;

        localStorage.setItem("user", JSON.stringify(resolvedUser));
        setTargetPath(shouldContinuePayment ? "/payment" : getUpgradeTargetPath(resolvedUser));
      } catch {
        // Biarkan target dari event/localStorage jika refresh profile gagal.
      }
    };

    window.addEventListener("flix:require-login", handleOpen);
    window.addEventListener("flix:require-upgrade", handleUpgradeOpen);
    return () => {
      window.removeEventListener("flix:require-login", handleOpen);
      window.removeEventListener("flix:require-upgrade", handleUpgradeOpen);
    };
  }, []);

  if (!open) {
    return null;
  }

  const closeModal = () => setOpen(false);

  const goToAuthPage = (path) => {
    closeModal();
    navigate(path);
  };

  return (
    <div className="login-required" role="presentation" onClick={closeModal}>
      <section
        className="login-required__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-required-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="login-required__close"
          type="button"
          onClick={closeModal}
          aria-label="Tutup popup login"
        >
          x
        </button>

        <div className="login-required__icon" aria-hidden="true">
          <img src={flixAdminLogo} alt="" />
        </div>

        <div className="login-required__texts">
          <h2 id="login-required-title">
            {mode === "upgrade" ? "Upgrade FLIX" : "Gabung dengan FLIX"}
          </h2>
          <p>
            {mode === "upgrade"
              ? message
              : "Yuk login dulu! Kamu perlu punya akun untuk menjelajahi FLIX."}
          </p>
        </div>

        <div className="login-required__actions">
          <button
            className="login-required__primary"
            type="button"
            onClick={() => goToAuthPage(mode === "upgrade" ? targetPath : "/register")}
          >
            {mode === "upgrade" ? "Lihat Paket" : "Daftar Sekarang"}
          </button>
          {mode === "upgrade" ? (
            <button
              className="login-required__secondary"
              type="button"
              onClick={closeModal}
            >
              Nanti dulu
            </button>
          ) : (
            <button
              className="login-required__secondary"
              type="button"
              onClick={() => goToAuthPage("/login")}
            >
              Login
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default LoginRequiredModal;
