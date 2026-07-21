import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { FiCheck, FiImage, FiTrash2 } from "react-icons/fi";
import { FaFacebookF, FaTwitter, FaYoutube } from "react-icons/fa";
import SiteNavbar from "@/components/layout/SiteNavbar";
import { resolveMediaUrl } from "@/utils/media";
import "./SettingsPage.css";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

const preferenceDefaults = {
  gender: "",
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
};

const getStoredPreferences = () => {
  try {
    return {
      ...preferenceDefaults,
      ...(JSON.parse(localStorage.getItem("flix_user_settings")) || {})
    };
  } catch {
    return preferenceDefaults;
  }
};

function SettingsPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const storedUser = useMemo(() => getStoredUser(), []);
  const [profile, setProfile] = useState(storedUser);
  const [accountForm, setAccountForm] = useState({
    username: storedUser?.username || "",
    email: storedUser?.email || "",
    ...getStoredPreferences()
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: ""
  });
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const role = profile?.role_name || storedUser?.role;
  const isAdmin = role === "admin";
  const profileImageUrl = resolveMediaUrl(profile?.profile_image_url);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(`${apiUrl}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const nextProfile = response.data;
        const preferences = getStoredPreferences();

        setProfile(nextProfile);
        setAccountForm({
          username: nextProfile.username || "",
          email: nextProfile.email || "",
          ...preferences
        });
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...(getStoredUser() || {}),
            ...nextProfile,
            role: nextProfile.role_name || getStoredUser()?.role
          })
        );
      } catch (error) {
        setErrorMessage(error.response?.data?.message || "Gagal mengambil data settings");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate, token]);

  const updateStoredUser = (nextUser) => {
    const stored = getStoredUser() || {};
    const nextStored = {
      ...stored,
      ...nextUser,
      role: nextUser.role_name || stored.role
    };

    localStorage.setItem("user", JSON.stringify(nextStored));
    setProfile((currentProfile) => ({
      ...currentProfile,
      ...nextUser
    }));
  };

  const handleAccountChange = (field, value) => {
    setAccountForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  };

  const handleProfileSave = async () => {
    try {
      setSavingSection("profile");
      setMessage("");
      setErrorMessage("");
      const response = await axios.put(
        `${apiUrl}/api/profile/me`,
        {
          username: accountForm.username,
          email: accountForm.email
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      updateStoredUser(response.data.user);
      localStorage.setItem(
        "flix_user_settings",
        JSON.stringify({
          gender: accountForm.gender,
        }),
      );
      setMessage(response.data.message || "Informasi profile berhasil disimpan");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal menyimpan informasi profile");
    } finally {
      setSavingSection("");
    }
  };

  const handlePreferenceSave = () => {
    handleProfileSave();
  };

  const handlePasswordSave = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setErrorMessage("Kata sandi lama dan kata sandi baru wajib diisi");
      return;
    }

    try {
      setSavingSection("password");
      setMessage("");
      setErrorMessage("");
      const response = await axios.put(`${apiUrl}/api/profile/password`, passwordForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPasswordForm({ currentPassword: "", newPassword: "" });
      setMessage(response.data.message || "Kata sandi berhasil diperbarui");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal memperbarui kata sandi");
    } finally {
      setSavingSection("");
    }
  };

  const handleMediaUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setSavingSection("media");
      setMessage("");
      setErrorMessage("");
      const formData = new FormData();
      formData.append("image", file);

      const uploadResponse = await axios.post(`${apiUrl}/api/uploads/editor-image`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      const mediaResponse = await axios.put(
        `${apiUrl}/api/profile/media`,
        {
          field: "profile_image_url",
          image_url: uploadResponse.data.imageUrl
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      updateStoredUser(mediaResponse.data.user);
      setMessage("Foto profile berhasil diperbarui");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal upload foto profile");
    } finally {
      setSavingSection("");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setSavingSection("delete");
      setErrorMessage("");
      await axios.delete(`${apiUrl}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal menghapus akun");
      setSavingSection("");
      setDeleteConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <main className="settings-page settings-page--state">
        <SiteNavbar mode="fixed" />
        <p>Memuat settings...</p>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <SiteNavbar mode="fixed" />
      <section className="settings-shell">
        <header className="settings-hero">
          <span>Account Settings</span>
          <h1>Pengaturan Akun</h1>
          <p>Kelola informasi profil, data diri, dan keamanan akun FLIX.</p>
        </header>

        {message && <p className="settings-alert settings-alert--success">{message}</p>}
        {errorMessage && <p className="settings-alert">{errorMessage}</p>}

        <section className="settings-panel settings-profile-panel">
          <div className="settings-panel__head">
            <h2>Informasi Profil</h2>
          </div>
          <div className="settings-profile-upload">
            <div className="settings-profile-upload__avatar">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt={profile?.username || "Profile"} />
              ) : (
                <FiImage aria-hidden="true" />
              )}
            </div>
            <label className="settings-file-button">
              Pilih File
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleMediaUpload} />
            </label>
            <div className="settings-file-copy">
              <span>{savingSection === "media" ? "Mengupload foto..." : "Tidak ada berkas yang dipilih"}</span>
              <small>JPG, PNG, atau WebP. Maks 2MB. Akan dipotong ke ukuran profile.</small>
            </div>
            <button type="button" className="settings-save-button" onClick={handleProfileSave} disabled={savingSection !== ""}>
              <FiCheck aria-hidden="true" />
              {savingSection === "profile" ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel__head">
            <h2>Informasi Data Diri</h2>
            <p>Isi data diri secara lengkap</p>
          </div>
          <div className="settings-form-grid">
            <label>
              Nama Lengkap
              <input
                type="text"
                value={accountForm.username}
                onChange={(event) => handleAccountChange("username", event.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={accountForm.email}
                onChange={(event) => handleAccountChange("email", event.target.value)}
              />
            </label>
            <label>
              Jenis Kelamin
              <select value={accountForm.gender} onChange={(event) => handleAccountChange("gender", event.target.value)}>
                <option value="">Pilih jenis kelamin</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="settings-save-button settings-save-button--right"
            onClick={handlePreferenceSave}
            disabled={savingSection !== ""}
          >
            <FiCheck aria-hidden="true" />
            {savingSection === "profile" ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </section>

        <section className="settings-panel">
          <div className="settings-panel__head">
            <h2>Perbarui Kata Sandi</h2>
            <p>Pastikan akun Anda menggunakan kata sandi yang panjang dan acak agar tetap aman.</p>
          </div>
          <div className="settings-form-grid settings-form-grid--password">
            <label>
              Kata Sandi Saat Ini*
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((currentForm) => ({
                    ...currentForm,
                    currentPassword: event.target.value
                  }))
                }
              />
            </label>
            <label>
              Kata Sandi Baru*
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((currentForm) => ({
                    ...currentForm,
                    newPassword: event.target.value
                  }))
                }
              />
            </label>
          </div>
          <button type="button" className="settings-save-button settings-save-button--right" onClick={handlePasswordSave} disabled={savingSection !== ""}>
            <FiCheck aria-hidden="true" />
            {savingSection === "password" ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </section>

        {!isAdmin && (
          <section className="settings-panel settings-panel--danger">
            <div className="settings-panel__head">
              <h2>Hapus Akun</h2>
              <p>Apakah Anda yakin ingin menghapus akun Anda? Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <button type="button" className="settings-delete-button" onClick={() => setDeleteConfirmOpen(true)}>
              <FiTrash2 aria-hidden="true" />
              Hapus Akun
            </button>
          </section>
        )}
      </section>

      {deleteConfirmOpen && (
        <div className="settings-modal" role="presentation" onClick={() => setDeleteConfirmOpen(false)}>
          <section
            className="settings-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="settings-delete-title">Apakah Anda yakin ingin menghapus akun?</h2>
            <div className="settings-delete-actions">
              <button type="button" onClick={() => setDeleteConfirmOpen(false)} disabled={savingSection === "delete"}>
                Batal
              </button>
              <button type="button" onClick={handleDeleteAccount} disabled={savingSection === "delete"}>
                {savingSection === "delete" ? "Menghapus..." : "Hapus Akun"}
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="settings-footer">
        <nav aria-label="Footer navigation">
          <Link to="/">Home</Link>
          <Link to="/movies">Movie</Link>
          <Link to="/tv-series">TV Series</Link>
          <Link to="/genre">Genre</Link>
          <Link to="/community">Community</Link>
          <Link to="/contact-us">Contact Us</Link>
        </nav>
        <div aria-label="Social media">
          <FaFacebookF />
          <FaTwitter />
          <FaYoutube />
        </div>
        <p>Copyright 2026 - Kelompok 5</p>
      </footer>
    </main>
  );
}

export default SettingsPage;
