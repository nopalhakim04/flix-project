import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FaApple, FaFacebookF } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { FiEye, FiEyeOff } from "react-icons/fi";
import flixLogo from "@/assets/flix-logo.png";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setLoading(true);
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        form,
      );

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate("/");

      window.location.reload();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <img className="login-logo" src={flixLogo} alt="FLIX" />

      <section className="login-shell">
        <h1 className="login-title">Login</h1>
        <p className="login-subtitle">
          Login untuk akses FLIX - Website Rekomendasi Film
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span className="login-field-label">Email</span>
            <input
              className="login-input"
              type="email"
              name="email"
              placeholder="Masukkan email Anda"
              value={form.email}
              onChange={handleChange}
              autoComplete={rememberMe ? "email" : "off"}
              required
            />
          </label>

          <label className="login-field">
            <span className="login-field-label">Password</span>
            <input
              className="login-input login-password-input"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Masukkan password Anda"
              value={form.password}
              onChange={handleChange}
              autoComplete={rememberMe ? "current-password" : "off"}
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

          <div className="login-row">
            <label className="login-check">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Ingat Saya</span>
            </label>

            <button
              className="login-link-button"
              type="button"
              onClick={() => navigate("/forgot-password")}
            >
              Lupa Password
            </button>
          </div>

          {errorMessage && <p className="login-error">{errorMessage}</p>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Login"}
          </button>

          <p className="login-signup">
            Belum punya akun? <Link to="/register">Sign Up</Link>
          </p>
        </form>

        <div className="login-divider">Atau login dengan</div>

        <div className="login-socials" aria-label="Social login options">
          <button className="login-social login-social-facebook" type="button">
            <FaFacebookF />
          </button>
          <button className="login-social" type="button">
            <FcGoogle />
          </button>
          <button className="login-social login-social-apple" type="button">
            <FaApple />
          </button>
        </div>
      </section>
    </main>
  );
}

export default Login;
