import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FiCheck, FiImage } from "react-icons/fi";
import { resolveMediaUrl } from "@/utils/media";
import "./AdminSettingsPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
};

const defaultPreferences = {
  displayName: "",
  gender: "",
  country: "",
  language: "",
  timezone: ""
};

const getPreferences = () => {
  try {
    return {
      ...defaultPreferences,
      ...(JSON.parse(localStorage.getItem("flix_admin_settings")) || {})
    };
  } catch {
    return defaultPreferences;
  }
};

function AdminSettingsPanel() {
  const token = localStorage.getItem("token");
  const storedUser = useMemo(getStoredUser, []);
  const [profile, setProfile] = useState(storedUser);
  const [form, setForm] = useState({
    username: storedUser.username || "",
    email: storedUser.email || "",
    ...getPreferences()
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: ""
  });
  const [savingSection, setSavingSection] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const profileImageUrl = resolveMediaUrl(profile?.profile_image_url);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const nextProfile = response.data;

        setProfile(nextProfile);
        setForm({
          username: nextProfile.username || "",
          email: nextProfile.email || "",
          ...getPreferences()
        });
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...getStoredUser(),
            ...nextProfile,
            role: nextProfile.role_name || getStoredUser().role
          })
        );
      } catch (error) {
        setErrorMessage(error.response?.data?.message || "Gagal mengambil data admin");
      }
    };

    fetchProfile();
  }, [token]);

  const updateStoredUser = (nextUser) => {
    const nextStored = {
      ...getStoredUser(),
      ...nextUser,
      role: nextUser.role_name || getStoredUser().role
    };

    localStorage.setItem("user", JSON.stringify(nextStored));
    setProfile((currentProfile) => ({
      ...currentProfile,
      ...nextUser
    }));
  };

  const updateForm = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  };

  const saveProfile = async () => {
    try {
      setSavingSection("profile");
      setMessage("");
      setErrorMessage("");
      const response = await axios.put(
        `${API_URL}/api/profile/me`,
        {
          username: form.username,
          email: form.email
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      updateStoredUser(response.data.user);
      setMessage(response.data.message || "Informasi profil admin berhasil disimpan");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal menyimpan profil admin");
    } finally {
      setSavingSection("");
    }
  };

  const savePreferences = () => {
    localStorage.setItem(
      "flix_admin_settings",
      JSON.stringify({
        displayName: form.displayName,
        gender: form.gender,
        country: form.country,
        language: form.language,
        timezone: form.timezone
      })
    );
    setErrorMessage("");
    setMessage("Informasi data diri admin berhasil disimpan");
  };

  const savePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setErrorMessage("Kata sandi saat ini dan kata sandi baru wajib diisi");
      return;
    }

    try {
      setSavingSection("password");
      setMessage("");
      setErrorMessage("");
      const response = await axios.put(`${API_URL}/api/profile/password`, passwordForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPasswordForm({ currentPassword: "", newPassword: "" });
      setMessage(response.data.message || "Kata sandi admin berhasil diperbarui");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal memperbarui kata sandi");
    } finally {
      setSavingSection("");
    }
  };

  const uploadProfileImage = async (event) => {
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
      const uploadResponse = await axios.post(`${API_URL}/api/uploads/editor-image`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      const mediaResponse = await axios.put(
        `${API_URL}/api/profile/media`,
        {
          field: "profile_image_url",
          image_url: uploadResponse.data.imageUrl
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      updateStoredUser(mediaResponse.data.user);
      setMessage("Foto profil admin berhasil diperbarui");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Gagal upload foto profil admin");
    } finally {
      setSavingSection("");
    }
  };

  return (
    <section className="admin-settings" aria-label="Pengaturan admin">
      {message && <p className="admin-settings__alert admin-settings__alert--success">{message}</p>}
      {errorMessage && <p className="admin-settings__alert">{errorMessage}</p>}

      <article className="admin-settings-card admin-settings-card--profile">
        <header className="admin-settings-card__head">
          <h2>Informasi Profil</h2>
        </header>
        <div className="admin-settings-profile">
          <div className="admin-settings-profile__avatar">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt={profile?.username || "Admin"} />
            ) : (
              <FiImage aria-hidden="true" />
            )}
          </div>
          <label className="admin-settings-file">
            Pilih File
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadProfileImage} />
          </label>
          <div className="admin-settings-file__copy">
            <span>{savingSection === "media" ? "Mengupload foto..." : "Tidak ada berkas yang dipilih"}</span>
            <small>JPG, PNG, atau WebP. Maks 2MB.</small>
          </div>
          <button type="button" className="admin-settings-save" disabled={savingSection !== ""} onClick={saveProfile}>
            <FiCheck aria-hidden="true" />
            {savingSection === "profile" ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </article>

      <article className="admin-settings-card">
        <header className="admin-settings-card__head">
          <h2>Informasi Data Diri</h2>
          <p>Isi data diri secara lengkap</p>
        </header>
        <div className="admin-settings-grid">
          <label>
            Nama Lengkap
            <input type="text" value={form.username} onChange={(event) => updateForm("username", event.target.value)} />
          </label>
          <label>
            Nama panggilan
            <input type="text" value={form.displayName} onChange={(event) => updateForm("displayName", event.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
          </label>
          <label>
            Jenis Kelamin
            <select value={form.gender} onChange={(event) => updateForm("gender", event.target.value)}>
              <option value="">Pilih jenis kelamin</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </label>
          <label>
            Bahasa
            <select value={form.language} onChange={(event) => updateForm("language", event.target.value)}>
              <option value="">Pilih bahasa</option>
              <option value="Indonesia">Indonesia</option>
              <option value="English">English</option>
            </select>
          </label>
          <label>
            Zona Waktu
            <select value={form.timezone} onChange={(event) => updateForm("timezone", event.target.value)}>
              <option value="">Pilih zona waktu</option>
              <option value="WIB">WIB</option>
              <option value="WITA">WITA</option>
              <option value="WIT">WIT</option>
            </select>
          </label>
        </div>
        <button type="button" className="admin-settings-save admin-settings-save--right" onClick={savePreferences}>
          <FiCheck aria-hidden="true" />
          Simpan Perubahan
        </button>
      </article>

      <article className="admin-settings-card">
        <header className="admin-settings-card__head">
          <h2>Perbarui Kata Sandi</h2>
          <p>Pastikan akun admin menggunakan kata sandi yang kuat.</p>
        </header>
        <div className="admin-settings-grid admin-settings-grid--password">
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
        <button type="button" className="admin-settings-save admin-settings-save--right" disabled={savingSection !== ""} onClick={savePassword}>
          <FiCheck aria-hidden="true" />
          {savingSection === "password" ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </article>
    </section>
  );
}

export default AdminSettingsPanel;
