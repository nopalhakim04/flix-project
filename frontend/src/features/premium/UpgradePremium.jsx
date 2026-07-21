import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import flixLogo from "../../assets/flix-logo.png";
import PageLoadingOverlay from "@/components/ui/PageLoadingOverlay";
import "./UpgradePremium.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const defaultPackagePrices = {
  premium: 29000,
  premium_yearly: 249000,
};

const formatCurrency = (value, compact = false) => {
  const number = Number(value || 0);

  if (compact && number >= 1000) {
    return `Rp ${Math.round(number / 1000)}K`;
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(number);
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
};

function UpgradePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [user, setUser] = useState(() => getStoredUser());
  const [packagePrices, setPackagePrices] = useState(defaultPackagePrices);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [paymentSettingsLoading, setPaymentSettingsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    let shouldIgnore = false;

    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (shouldIgnore) {
          return;
        }

        const nextUser = {
          ...getStoredUser(),
          ...response.data,
          role: response.data.role_name || getStoredUser().role
        };

        setUser(nextUser);
        localStorage.setItem("user", JSON.stringify(nextUser));
      } catch {
        setUser(getStoredUser());
      }
    };

    fetchProfile();

    return () => {
      shouldIgnore = true;
    };
  }, [token]);

  useEffect(() => {
    let shouldIgnore = false;

    const fetchPaymentSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/payment/settings`);
        const packages = Array.isArray(response.data?.packages) ? response.data.packages : [];

        if (shouldIgnore || !packages.length) {
          return;
        }

        setPackagePrices((prices) => ({
          ...prices,
          ...packages.reduce((result, paymentPackage) => {
            result[paymentPackage.code] = Number(paymentPackage.price || 0);
            return result;
          }, {}),
        }));
        setSubscriberCount(Number(response.data?.subscriberCount || 0));
      } catch {
        if (!shouldIgnore) {
          setPackagePrices(defaultPackagePrices);
          setSubscriberCount(0);
        }
      } finally {
        if (!shouldIgnore) {
          setPaymentSettingsLoading(false);
        }
      }
    };

    fetchPaymentSettings();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  const currentPackageId = useMemo(() => {
    if (!user?.is_premium) {
      return "free";
    }

    const packageCode = String(user.current_package_code || "").toLowerCase();
    const packageName = String(user.current_package_name || "").toLowerCase();

    if (
      packageCode.includes("year") ||
      packageName.includes("tahunan") ||
      packageName.includes("exclusive") ||
      packageName.includes("eksklusif")
    ) {
      return "annual";
    }

    return "premium";
  }, [user]);

  const packageRank = {
    free: 0,
    premium: 1,
    annual: 2
  };
  const hasPendingPayment =
    String(user?.pending_payment_status || "").toLowerCase() === "pending";

  const getPackageAction = (pkg) => {
    if (hasPendingPayment && pkg.id !== "free") {
      return {
        text: "Lanjutkan Pembayaran",
        className: "btn-primary",
        disabled: false,
        hasArrow: true
      };
    }

    if (pkg.id === currentPackageId) {
      return {
        text: "Paket Saat Ini",
        className: "btn-disabled",
        disabled: true,
        hasArrow: false
      };
    }

    if (packageRank[currentPackageId] > packageRank[pkg.id]) {
      return {
        text: "Paket Lebih Rendah",
        className: "btn-disabled",
        disabled: true,
        hasArrow: false
      };
    }

    if (pkg.id === "annual" && currentPackageId === "premium") {
      return {
        text: "Upgrade Eksklusif",
        className: "btn-secondary",
        disabled: false,
        hasArrow: true
      };
    }

    return {
      text: pkg.buttonText,
      className: pkg.buttonClass,
      disabled: pkg.id === "free",
      hasArrow: Boolean(pkg.hasArrow)
    };
  };

  // Data Paket untuk mempermudah perulangan (looping)
  const packages = [
    {
      id: "free",
      name: "FREE",
      price: "Rp 0",
      period: "/bulan",
      note: "Selamanya gratis",
      description: "Untuk kamu yang baru mulai menjelajah FLIX.",
      features: [
        { text: "Lihat film & TV series", active: true },
        { text: "Search film & TV series", active: true },
        { text: "Watchlist maks. 10 film", active: true },
        { text: "Review film/series", active: true },
        { text: "Community post", active: false },
        { text: "Chat antar user", active: false },
        { text: "Chatbot FLIX", active: false },
      ],
      buttonText: "Paket Gratis",
      buttonClass: "btn-disabled",
    },
    {
      id: "premium",
      name: "PREMIUM",
      price: formatCurrency(packagePrices.premium, true),
      period: "/bulan",
      note: "Bisa dibatalkan kapan saja",
      description: "Untuk penonton yang ingin fitur sosial dan watchlist penuh.",
      popular: true, // Untuk menandai kartu terpopuler
      features: [
        { text: "Lihat film & TV series", active: true },
        { text: "Search film & TV series", active: true },
        { text: "Watchlist unlimited", active: true, boldText: "unlimited" },
        { text: "Review film/series", active: true },
        { text: "Community post", active: true },
        { text: "Comment/reply community", active: true },
        { text: "Like/reaction/share community", active: true },
        { text: "Chat antar user", active: true },
        { text: "Add friend / friendlist", active: true },
        { text: "Badge premium di profil", active: true },
        { text: "Bebas iklan", active: true },
        { text: "Chatbot FLIX", active: false },
      ],
      buttonText: "Mulai Premium",
      buttonClass: "btn-primary",
      hasArrow: true,
    },
    {
      id: "annual",
      name: "EKSKLUSIF",
      price: formatCurrency(packagePrices.premium_yearly, true),
      period: "/bulan",
      note: "Pilihan terbaik untuk pengalaman penuh",
      description:
        "Semua fitur Premium + bonus eksklusif untuk pengguna setia.",
      features: [
        { text: "Semua fitur Premium", active: true },
        { text: "Badge Premium ✦ di profil", active: true },
        { text: "Early review film baru", active: true },
        { text: "Statistik tontonan tahunan", active: true },
        { text: "Prioritas support", active: true },
        { text: "Bebas sponsored", active: true },
        { text: "Hemat Rp 99K/tahun", active: true },
      ],
      buttonText: "Pilih Eksklusif",
      buttonClass: "btn-secondary",
      hasArrow: true,
    },
  ];

  const getPackageDescription = (pkg) => {
    if (pkg.id === "annual") {
      return "Semua fitur Premium dengan akses asisten FLIX untuk pengguna setia.";
    }

    return pkg.description;
  };

  const getVisiblePackageFeatures = (pkg) => {
    if (pkg.id === "annual") {
      return [
        { text: "Semua fitur Premium", active: true },
        { text: "Watchlist unlimited", active: true, boldText: "unlimited" },
        { text: "Community post", active: true },
        { text: "Chat antar user", active: true },
        { text: "Add friend / friendlist", active: true },
        { text: "Badge premium di profil", active: true },
        { text: "Bebas iklan", active: true },
        { text: "Chatbot FLIX", active: true },
      ];
    }

    return pkg.features;
  };

  return (
    <div className="upgrade-page">
      <PageLoadingOverlay visible={paymentSettingsLoading} />
      {/* 1. Header Halaman */}
      <header className="upgrade-header">
        <div className="upgrade-header__logo" onClick={() => navigate("/")}>
          <img src={flixLogo} alt="FLIX Logo" />
        </div>
        <button
          className="upgrade-header__close"
          onClick={() => navigate(-1)}
          aria-label="Tutup Halaman Upgrade"
        >
          {/* Ikon X */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>
      {/* 2. Hero Section */}
      <section className="upgrade-hero">
        <div className="upgrade-hero__badge">
          <span className="badge-dot"></span> UPGRADE AKUN
        </div>
        <h1 className="upgrade-hero__title">
          Nonton Lebih Cerdas <br /> dengan
          <span className="text-highlight"> FLIX Premium</span>
        </h1>
        <p className="upgrade-hero__subtitle">
          Buka watchlist unlimited, fitur community, chat antar user,
          dan akses Chatbot FLIX di paket Eksklusif.
        </p>
        <p className="upgrade-hero__stats">
          Sudah{" "}
          <strong className="text-white">
            {new Intl.NumberFormat("id-ID").format(subscriberCount)}
          </strong>{" "}
          user berlangganan FLIX - yuk bergabung!
        </p>
      </section>
      
      {/* 3. Kartu Paket */}
      <section className="upgrade-cards-container">
        <div className="upgrade-cards">
          {packages.map((pkg) => {
            const packageAction = getPackageAction(pkg);

            return (
            <div
              key={pkg.id}
              className={`upgrade-card ${pkg.popular ? "upgrade-card--popular" : ""} ${
                pkg.id === currentPackageId ? "upgrade-card--current" : ""
              }`}
            >
              {/* Badge Paling Populer di atas kartu Premium */}
              {pkg.popular && (
                <div className="popular-badge">
                  <span role="img" aria-label="diamond">
                    💎
                  </span>{" "}
                  Paling Populer
                </div>
              )}

              {/* Detail Paket */}
              <div className="card-header">
                <span className="card-header__name">{pkg.name}</span>
                <div className="card-header__price-wrapper">
                  <span className="card-header__price">{pkg.price}</span>
                  <span className="card-header__period">{pkg.period}</span>
                </div>
                <span className="card-header__note">{pkg.note}</span>
                <p className="card-header__desc">{getPackageDescription(pkg)}</p>
              </div>

              <div className="card-divider"></div>

              {/* Daftar Fitur */}
              <ul className="card-features">
                {getVisiblePackageFeatures(pkg).map((feat, index) => (
                  <li
                    key={index}
                    className={`feature-item ${!feat.active ? "feature-item--inactive" : ""}`}
                  >
                    {feat.active ? (
                      // Ikon Centang Hijau
                      <svg
                        className="icon-check"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      // Ikon Silang Merah
                      <svg
                        className="icon-cross"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    )}
                    <span>
                      {feat.boldText ? (
                        <>
                          {feat.text.replace(feat.boldText, "")}
                          <strong className="text-white">
                            {feat.boldText}
                          </strong>
                        </>
                      ) : (
                        feat.text
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Tombol Aksi */}
              <button
                className={`card-button ${packageAction.className}`}
                disabled={packageAction.disabled}
                onClick={() => {
                  if (packageAction.disabled || pkg.id === "free") return; // Paket free tidak perlu diarahkan ke pembayaran

                  if (hasPendingPayment) {
                    navigate("/payment");
                    return;
                  }

                  // Konfigurasi data paket untuk dibawa ke halaman pembayaran
                  const isExclusive = pkg.id === "annual";
                  const selectedPkg = {
                    packageCode: isExclusive ? "premium_yearly" : "premium",
                    name: isExclusive ? "Eksklusif" : "Premium Bulanan",
                    priceText: isExclusive
                      ? formatCurrency(packagePrices.premium_yearly)
                      : formatCurrency(packagePrices.premium),
                    price: isExclusive ? packagePrices.premium_yearly : packagePrices.premium,
                    durationMonths: 1,
                  };

                  navigate("/payment", { state: { package: selectedPkg } });
                }}
              >
                {packageAction.text}
                {packageAction.hasArrow && (
                  <svg
                    className="icon-arrow"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                )}
              </button>
            </div>
          );
          })}
        </div>
      </section>
    </div>
  );
}

export default UpgradePage;
