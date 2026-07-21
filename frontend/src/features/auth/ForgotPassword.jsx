import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import flixLogo from "@/assets/flix-logo.png";
import "./Login.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    try {
      setLoading(true);
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/forgot-password`,
        { email }
      );

      setMessage(res.data.message);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Gagal mengirim link reset password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <img className="login-logo" src={flixLogo} alt="FLIX" />

      <section className="login-shell forgot-shell">
        <h1 className="login-title">Forgot Password</h1>
        <p className="login-subtitle">
          Masukkan email akun FLIX kamu untuk menerima link reset password
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span className="login-field-label">Email</span>
            <input
              className="login-input"
              type="email"
              name="email"
              placeholder="john.doe@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          {message && <p className="login-success">{message}</p>}
          {errorMessage && <p className="login-error">{errorMessage}</p>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Send Reset Link"}
          </button>

          <p className="login-signup">
            Remember your password? <Link to="/login">Login</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

export default ForgotPassword;
