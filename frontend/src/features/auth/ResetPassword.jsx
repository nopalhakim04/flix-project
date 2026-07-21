import { useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import flixLogo from "@/assets/flix-logo.png";
import "./Login.css";

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!token) {
      setErrorMessage("Token reset password tidak ditemukan");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErrorMessage("Password dan confirm password tidak sama");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/reset-password`,
        {
          token,
          password: form.password,
        }
      );

      setMessage(res.data.message);
      setTimeout(() => navigate("/login"), 1200);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <img className="login-logo" src={flixLogo} alt="FLIX" />

      <section className="login-shell forgot-shell">
        <h1 className="login-title">Reset Password</h1>
        <p className="login-subtitle">
          Buat password baru untuk akun FLIX kamu
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span className="login-field-label">New Password</span>
            <input
              className="login-input login-password-input"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password baru"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            <button
              className="login-password-toggle"
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              {showPassword ? <FiEye /> : <FiEyeOff />}
            </button>
          </label>

          <label className="login-field">
            <span className="login-field-label">Confirm Password</span>
            <input
              className="login-input login-password-input"
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Ulangi password baru"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            <button
              className="login-password-toggle"
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={
                showConfirmPassword
                  ? "Sembunyikan confirm password"
                  : "Tampilkan confirm password"
              }
            >
              {showConfirmPassword ? <FiEye /> : <FiEyeOff />}
            </button>
          </label>

          {message && <p className="login-success">{message}</p>}
          {errorMessage && <p className="login-error">{errorMessage}</p>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Reset Password"}
          </button>

          <p className="login-signup">
            Back to <Link to="/login">Login</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

export default ResetPassword;
