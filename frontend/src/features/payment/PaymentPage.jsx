import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import flixLogo from "@/assets/flix-logo.png";
import blueDiamondIcon from "@/assets/icon/bluediamond-icon.png";
import PageLoadingOverlay from "@/components/ui/PageLoadingOverlay";
import { showToast } from "@/utils/alerts";
import { resolveMediaUrl } from "@/utils/media";
import "./PaymentPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const fallbackPaymentMethods = [
  {
    id: "qris",
    type: "qris",
    name: "QRIS All Payment",
    category: "QRIS",
    accountNumber: "00020101021126680014ID.CO.QRIS.WWW01189360029314817",
    accountName: "FLIX Entertainment",
    imageUrl: "",
  },
  {
    id: "bca",
    type: "bank",
    name: "Bank BCA",
    category: "Bank",
    accountNumber: "1234567890",
    accountName: "FLIX Entertainment",
    imageUrl: "",
  },
  {
    id: "dana",
    type: "ewallet",
    name: "Dana",
    category: "E-Wallet",
    accountNumber: "08123456789",
    accountName: "FLIX Entertainment",
    imageUrl: "",
  },
];

const paymentTypeLabels = {
  bank: "Transfer Bank",
  qris: "QR Code",
  ewallet: "E-Wallet",
};

const fallbackPaymentPackages = [
  {
    code: "premium",
    name: "Premium Bulanan",
    durationMonths: 1,
    price: 29000,
  },
  {
    code: "premium_yearly",
    name: "Eksklusif",
    durationMonths: 12,
    price: 249000,
  },
];

const getMethodIcon = (type) => {
  if (type === "bank") return "🏦";
  if (type === "ewallet") return "💳";
  return "📱";
};

const inferPackageCode = (paymentPackage = {}) => {
  const packageCode = String(paymentPackage.packageCode || paymentPackage.code || "").toLowerCase();
  const packageName = String(paymentPackage.packageName || paymentPackage.name || "").toLowerCase();

  if (
    packageCode === "premium_yearly" ||
    packageCode === "exclusive" ||
    packageName.includes("eksklusif") ||
    packageName.includes("exclusive")
  ) {
    return "premium_yearly";
  }

  return "premium";
};

function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const pendingDurationMonths = Number(storedUser.pending_payment_duration_months || 0);
  const storedPendingPayment =
    String(storedUser.pending_payment_status || "").toLowerCase() === "pending"
      ? {
          status: "pending",
          packageCode: storedUser.pending_payment_package_code,
          packageName: storedUser.pending_payment_package_name || "Premium Bulanan",
          durationMonths: pendingDurationMonths || 1,
          totalAmount: Number(storedUser.pending_payment_total_amount || 0),
          createdAt: storedUser.pending_payment_created_at,
        }
      : null;

  // 1. Ambil data paket yang diteruskan dari halaman UpgradePremium
  const selectedPackage =
    location.state?.package ||
    (String(storedUser.pending_payment_status || "").toLowerCase() === "pending"
      ? {
          packageCode: storedUser.pending_payment_package_code,
          name: storedUser.pending_payment_package_name || "Premium Bulanan",
          priceText: storedUser.pending_payment_total_amount
            ? new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              }).format(Number(storedUser.pending_payment_total_amount || 0))
            : "Rp 29.000",
          price: Number(storedUser.pending_payment_total_amount || 29000),
          durationMonths: pendingDurationMonths || 1,
        }
      : {
          name: "Premium Bulanan",
          priceText: "Rp 29.000",
          price: 29000,
          durationMonths: 1,
        });

  // 2. State untuk Data Diri Pembayar
  const [fullName, setFullName] = useState(storedUser.username || "");
  const [email, setEmail] = useState(storedUser.email || "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [durationMonths, setDurationMonths] = useState(selectedPackage.durationMonths);
  const [selectedPackageCode, setSelectedPackageCode] = useState(() =>
    inferPackageCode(selectedPackage),
  );

  // 3. State Metode Pembayaran & Saluran
  const [paymentMethods, setPaymentMethods] = useState(fallbackPaymentMethods);
  const [paymentPackages, setPaymentPackages] = useState(fallbackPaymentPackages);
  const [paymentMethod, setPaymentMethod] = useState("qris");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("qris");
  const [ewalletPhone, setEwalletPhone] = useState("");

  // 4. State Modal Upload & Status Keberhasilan
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState("");
  const [currentPendingPayment, setCurrentPendingPayment] = useState(storedPendingPayment);
  const [checkingCurrentPayment, setCheckingCurrentPayment] = useState(Boolean(token));
  const [paymentSettingsLoading, setPaymentSettingsLoading] = useState(true);
  
  // 5. State Tambahan
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const paymentMethodsByType = useMemo(
    () => ({
      qris: paymentMethods.filter((method) => method.type === "qris"),
      bank: paymentMethods.filter((method) => method.type === "bank"),
      ewallet: paymentMethods.filter((method) => method.type === "ewallet"),
    }),
    [paymentMethods],
  );

  const availablePaymentTypes = useMemo(
    () =>
      [
        {
          id: "qris",
          title: "QR Code",
          description: "Bayar menggunakan QRIS",
        },
        {
          id: "bank",
          title: "Transfer Bank",
          description: "Pilih rekening bank tujuan",
        },
        {
          id: "ewallet",
          title: "E-Wallet",
          description: "Pilih dompet digital tujuan",
        },
      ].filter((type) => paymentMethodsByType[type.id]?.length),
    [paymentMethodsByType],
  );

  const selectedTypeMethods = paymentMethodsByType[paymentMethod] || [];
  const selectedPaymentMethod = useMemo(
    () =>
      selectedTypeMethods.find((method) => method.id === selectedPaymentMethodId) ||
      selectedTypeMethods[0] ||
      paymentMethods[0] ||
      fallbackPaymentMethods[0],
    [paymentMethods, selectedPaymentMethodId, selectedTypeMethods],
  );

  useEffect(() => {
    let isMounted = true;

    const loadPaymentSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/payment/settings`);
        const methods = Array.isArray(response.data?.methods)
          ? response.data.methods
          : fallbackPaymentMethods;
        const packages = Array.isArray(response.data?.packages)
          ? response.data.packages
          : fallbackPaymentPackages;

        if (!isMounted) {
          return;
        }

        const nextMethods = methods.length ? methods : fallbackPaymentMethods;
        const nextType = nextMethods.some((method) => method.type === "qris")
          ? "qris"
          : nextMethods[0]?.type || "qris";

        setPaymentMethods(nextMethods);
        setPaymentPackages(packages.length ? packages : fallbackPaymentPackages);
        setPaymentMethod(nextType);
        setSelectedPaymentMethodId(
          nextMethods.find((method) => method.type === nextType)?.id ||
            nextMethods[0]?.id ||
            "qris",
        );
      } catch {
        if (isMounted) {
          setPaymentMethods(fallbackPaymentMethods);
          setPaymentPackages(fallbackPaymentPackages);
          setPaymentMethod("qris");
          setSelectedPaymentMethodId("qris");
        }
      } finally {
        if (isMounted) {
          setPaymentSettingsLoading(false);
        }
      }
    };

    loadPaymentSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentPayment = async () => {
      if (!token) {
        setCheckingCurrentPayment(false);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/payment/current`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!isMounted) {
          return;
        }

        const pendingPayment = response.data?.pendingPayment;

        if (response.data?.hasPendingPayment && pendingPayment) {
          setCurrentPendingPayment(pendingPayment);
          setDurationMonths(Number(pendingPayment.durationMonths || 1));
          setSelectedPackageCode(inferPackageCode(pendingPayment));
          setTransactionId(pendingPayment.transactionId || "");
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...storedUser,
              pending_payment_status: "pending",
              pending_payment_package_code: pendingPayment.packageCode,
              pending_payment_package_name: pendingPayment.packageName,
              pending_payment_duration_months: Number(pendingPayment.durationMonths || 1),
              pending_payment_total_amount: Number(pendingPayment.totalAmount || 0),
              pending_payment_created_at: pendingPayment.createdAt,
            }),
          );
          return;
        }

        setCurrentPendingPayment(null);
        const nextStoredUser = { ...storedUser };
        delete nextStoredUser.pending_payment_status;
        delete nextStoredUser.pending_payment_package_code;
        delete nextStoredUser.pending_payment_package_name;
        delete nextStoredUser.pending_payment_duration_months;
        delete nextStoredUser.pending_payment_total_amount;
        delete nextStoredUser.pending_payment_created_at;
        localStorage.setItem("user", JSON.stringify(nextStoredUser));
      } catch (error) {
        if (isMounted && storedPendingPayment) {
          setCurrentPendingPayment(storedPendingPayment);
        }
      } finally {
        if (isMounted) {
          setCheckingCurrentPayment(false);
        }
      }
    };

    loadCurrentPayment();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const currentMethods = paymentMethodsByType[paymentMethod] || [];

    if (!currentMethods.length) {
      const nextType = availablePaymentTypes[0]?.id || "qris";
      const nextMethodId =
        paymentMethodsByType[nextType]?.[0]?.id || fallbackPaymentMethods[0].id;

      if (paymentMethod !== nextType) {
        setPaymentMethod(nextType);
      }
      if (selectedPaymentMethodId !== nextMethodId) {
        setSelectedPaymentMethodId(nextMethodId);
      }
      return;
    }

    if (!currentMethods.some((method) => method.id === selectedPaymentMethodId)) {
      setSelectedPaymentMethodId(currentMethods[0].id);
    }
  }, [
    availablePaymentTypes,
    paymentMethod,
    paymentMethodsByType,
    selectedPaymentMethodId,
  ]);

  // Salin teks ke Clipboard
  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    showToast({ title: "Berhasil disalin ke clipboard." });
  };

  // Kalkulasi Harga secara Dinamis berdasarkan Durasi Bulan
  const monthlyPackage =
    paymentPackages.find((paymentPackage) => paymentPackage.code === "premium") ||
    fallbackPaymentPackages[0];
  const yearlyPackage =
    paymentPackages.find((paymentPackage) => paymentPackage.code === "premium_yearly") ||
    fallbackPaymentPackages[1];
  const monthlyPrice = Number(monthlyPackage.price || fallbackPaymentPackages[0].price || 0);
  const yearlyPrice = Number(yearlyPackage.price || fallbackPaymentPackages[1].price || 0);
  const isExclusivePackage = selectedPackageCode === "premium_yearly";
  const packageUnitPrice = isExclusivePackage ? yearlyPrice : monthlyPrice;
  const packageDisplayName = isExclusivePackage ? "Eksklusif" : "Premium Bulanan";
  const baseSubtotal = Number(durationMonths) * packageUnitPrice;
  const subtotal = baseSubtotal;
  const adminFee = 2500; // Biaya admin Rp2.500 sesuai mockup Anda
  const totalPayment = subtotal + adminFee;

  // Format angka ke format Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(number);
  };

  // Hitung Tanggal Aktif Langganan
  const getPeriodText = () => {
    const today = new Date();
    const expiry = new Date();
    expiry.setMonth(today.getMonth() + Number(durationMonths));

    const options = { day: "numeric", month: "long", year: "numeric" };
    return `${today.toLocaleDateString("id-ID", options)} - ${expiry.toLocaleDateString("id-ID", options)}`;
  };

  // Tanggal kedaluwarsa untuk struk berhasil
  const getExpiryDate = () => {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + Number(durationMonths));
    const options = { day: "numeric", month: "long", year: "numeric" };
    return expiry.toLocaleDateString("id-ID", options);
  };

  const getPackageCode = () => selectedPackageCode;
  const getPackageName = () => packageDisplayName;

  const getPaymentMethodLabel = () => {
    return selectedPaymentMethod?.name || paymentTypeLabels[paymentMethod] || "QRIS";
  };

  const pendingActivationFeatures = useMemo(() => {
    const premiumFeatures = [
      "Watchlist unlimited",
      "Buat post, comment, dan reply Community",
      "Like, reaction, dan share Community",
      "Chat antar user",
      "Add friend dan friendlist",
      "Badge Premium di profil",
      "Bebas iklan",
    ];

    if (isExclusivePackage) {
      return [
        ...premiumFeatures.filter((feature) => feature !== "Badge Premium di profil"),
        "Badge Eksklusif di profil",
        "Chatbot FLIX",
      ];
    }

    return premiumFeatures;
  }, [isExclusivePackage]);

  // Ketika klik tombol "Bayar Sekarang"
  const handleOpenUploadModal = () => {
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim()) {
      setError("Mohon lengkapi Data Diri Pembayar terlebih dahulu!");
      return;
    }
    setError("");
    setShowUploadModal(true);
  };

  // Proses upload file bukti pembayaran ke server
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentProofFile(file);
      setPaymentProofPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadAndConfirm = async (e) => {
    e.preventDefault();
    if (!paymentProofFile) {
      setError("Silakan pilih file bukti pembayaran terlebih dahulu.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Siapkan FormData untuk dikirim ke API Express
      const formData = new FormData();
      formData.append("payment_proof", paymentProofFile);
      formData.append("packageCode", getPackageCode());
      formData.append("packageName", getPackageName());
      formData.append("durationMonths", String(durationMonths));
      formData.append("paymentMethod", paymentMethod);
      formData.append("paymentMethodDetail", getPaymentMethodLabel());
      formData.append("amount", String(subtotal));
      formData.append("adminFee", String(adminFee));
      formData.append("totalAmount", String(totalPayment));
      formData.append("payerName", fullName);
      formData.append("payerEmail", email);
      formData.append("payerPhone", phoneNumber);
      formData.append("ewalletPhone", ewalletPhone);

      const res = await axios.post(
        `${API_URL}/api/payment/checkout`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setTransactionId(res.data?.transaction?.transactionId || "-");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...storedUser,
          pending_payment_status: "pending",
          pending_payment_package_code: getPackageCode(),
          pending_payment_package_name: getPackageName(),
          pending_payment_duration_months: Number(durationMonths),
          pending_payment_total_amount: totalPayment,
        }),
      );

      // Tutup modal upload, lalu tampilkan status pending verifikasi admin.
      setShowUploadModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "Gagal mengunggah bukti pembayaran."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingCurrentPayment || paymentSettingsLoading) {
    return (
      <div className="payment-page">
        <PageLoadingOverlay visible />
        <header className="payment-header">
          <img
            className="payment-header__logo"
            src={flixLogo}
            alt="FLIX"
            onClick={() => navigate("/")}
          />
          <button className="payment-header__close" onClick={() => navigate(-1)}>
            ✕
          </button>
        </header>

        <main className="payment-pending-container">
          <div className="payment-success-card payment-success-card--inline">
            <div className="success-checkmark-circle">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00E082" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h2>Memuat Data Pembayaran</h2>
            <p className="success-subtext">
              Mohon tunggu sebentar. FLIX sedang mengambil harga paket dan metode pembayaran terbaru.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (currentPendingPayment) {
    const pendingPackageName =
      currentPendingPayment.packageName ||
      packageDisplayName;
    const pendingTotalAmount = Number(currentPendingPayment.totalAmount || totalPayment);

    return (
      <div className="payment-page">
        <header className="payment-header">
          <img
            className="payment-header__logo"
            src={flixLogo}
            alt="FLIX"
            onClick={() => navigate("/")}
          />
          <button className="payment-header__close" onClick={() => navigate("/profile")}>
            ✕
          </button>
        </header>

        <main className="payment-pending-container">
          <div className="payment-success-card payment-success-card--inline">
            <div className="success-checkmark-circle">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00E082" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <h2>Pembayaran Menunggu Konfirmasi</h2>
            <p className="success-subtext">
              Bukti pembayaran kamu sudah terkirim. Akses premium akan aktif setelah disetujui admin.
            </p>

            <div className="premium-active-badge-card">
              <span className="premium-star-icon">💎</span> Status: Pending Verifikasi
            </div>

            <div className="success-transaction-table">
              <div className="table-row">
                <span>ID Transaksi</span>
                <strong>{currentPendingPayment.transactionId || transactionId || "-"}</strong>
              </div>
              <div className="table-row">
                <span>Paket</span>
                <strong>{pendingPackageName}</strong>
              </div>
              <div className="table-row">
                <span>Metode</span>
                <strong>{currentPendingPayment.paymentMethodDetail || "-"}</strong>
              </div>
              <div className="table-row">
                <span>Total Bayar</span>
                <strong>{formatRupiah(pendingTotalAmount)}</strong>
              </div>
              <div className="table-row">
                <span>Status</span>
                <strong>Menunggu Admin</strong>
              </div>
            </div>

            <div className="features-checklist-group">
              <h5>FITUR AKAN AKTIF SETELAH DISETUJUI:</h5>
              <ul>
                {pendingActivationFeatures.map((feature) => (
                  <li key={feature}>
                    <span className="feat-check-icon">✓</span> {feature}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              className="btn-success-modal-continue"
              onClick={() => navigate("/profile")}
            >
              Kembali ke Profil
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <header className="payment-header">
        <img
          className="payment-header__logo"
          src={flixLogo}
          alt="FLIX"
          onClick={() => navigate("/")}
        />
        <button className="payment-header__close" onClick={() => navigate(-1)}>
          ✕
        </button>
      </header>

      <div className="payment-container">
        {/* PANEL KIRI: FORMULIR UTAMA */}
        <main className="payment-main-form">
          
          {/* 1. DATA DIRI PEMBAYAR */}
          <section className="payment-section-card">
            <div className="section-title-wrapper">
              <span className="section-badge">1</span>
              <h2>Data Diri Pembayar</h2>
            </div>
            <div className="form-group-grid">
              <div className="form-input-box">
                <label>Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="form-input-box">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Masukkan email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-input-box">
                <label>Nomor Handphone</label>
                <input
                  type="tel"
                  placeholder="Masukkan nomor handphone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="form-input-box">
                <label>Durasi Pembelian Paket (Bulan)</label>
                <select
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(Number(e.target.value))}
                >
                  <option value={1}>1 Bulan ({packageDisplayName})</option>
                  <option value={3}>3 Bulan ({packageDisplayName})</option>
                  <option value={6}>6 Bulan ({packageDisplayName})</option>
                  <option value={12}>12 Bulan ({packageDisplayName})</option>
                </select>
              </div>
            </div>
          </section>

          {/* 2. PILIH METODE PEMBAYARAN */}
          <section className="payment-section-card">
            <div className="section-title-wrapper">
              <span className="section-badge">2</span>
              <h2>Pilih Metode Pembayaran</h2>
            </div>
            
            <div className="payment-method-selector-list">
              {availablePaymentTypes.map((type) => (
                <label
                  key={type.id}
                  className={`payment-method-row${
                    paymentMethod === type.id ? " is-active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="main_method"
                    checked={paymentMethod === type.id}
                    onChange={() => {
                      setPaymentMethod(type.id);
                      setSelectedPaymentMethodId(
                        paymentMethodsByType[type.id]?.[0]?.id || "",
                      );
                    }}
                  />
                  <div className="method-row-content">
                    <div className="method-icon-text">
                      <span className="icon-method-logo">
                        {type.id === "bank" ? "BNK" : type.id === "ewallet" ? "EW" : "QR"}
                      </span>
                      <div>
                        <strong>{type.title}</strong>
                        <p>{type.description}</p>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>
          {/* 3. DETAIL METODE PEMBAYARAN (DINAMIS) */}
          <section className="payment-section-card">
            <div className="section-title-wrapper">
              <span className="section-badge">3</span>
              <h2>Detail Pembayaran</h2>
            </div>

            {selectedTypeMethods.length > 1 && (
              <div className="payment-channel-selector">
                {selectedTypeMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`payment-channel-btn${
                      selectedPaymentMethod.id === method.id ? " is-selected" : ""
                    }`}
                    onClick={() => setSelectedPaymentMethodId(method.id)}
                  >
                    <span className="payment-channel-icon">
                      {method.imageUrl ? (
                        <img src={resolveMediaUrl(method.imageUrl)} alt="" />
                      ) : (
                        method.type === "bank" ? "BNK" : method.type === "ewallet" ? "EW" : "QR"
                      )}
                    </span>
                    <span>{method.name}</span>
                  </button>
                ))}
              </div>
            )}

            {paymentMethod === "qris" && (
              <div className="payment-detail-box animated-fade">
                <h4>{selectedPaymentMethod.name}</h4>
                <p className="detail-subtext">Scan QR code atau salin kode pembayaran QRIS berikut.</p>
                
                <div className="qris-qr-container">
                  {selectedPaymentMethod.imageUrl ? (
                    <img
                      src={resolveMediaUrl(selectedPaymentMethod.imageUrl)}
                      alt={selectedPaymentMethod.name}
                      className="qris-image-code"
                    />
                  ) : (
                    <svg width="160" height="160" viewBox="0 0 29 29" className="qris-svg-code">
                      <path d="M0 0h7v7H0zm2 2v3h3V2zm0 8h1v1H2zm0 2h3v1H2zm3 2h2v1H5zm6-6h1v1h-1zm1 2h1v2h-1zm0 3h1v1h-1zM0 22h7v7H0zm2 2v3h3v-3zm20-22h7v7h-7zm2 2v3h3V2zm-9 20h2v1h-2zm1 2h3v1h-3zm2-4h2v1h-2zm-6-2h1v1h-1zm5 2h1v1h-1zm0 2h1v1h-1zm-6-2h1v1h-1zm1 2h1v1h-1zm2 1h1v1h-1zm1 1h1v1h-1z" fill="#000000"/>
                    </svg>
                  )}
                </div>

                <div className="copy-code-group">
                  <label>Kode pembayaran QRIS</label>
                  <div className="copy-input-row">
                    <input
                      type="text"
                      readOnly
                      value={selectedPaymentMethod.accountNumber || "-"}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedPaymentMethod.accountNumber || "")}
                      disabled={!selectedPaymentMethod.accountNumber}
                    >
                      Salin
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === "bank" && (
              <div className="payment-detail-box animated-fade">
                <h4>{selectedPaymentMethod.name}</h4>
                <p className="detail-subtext">Transfer ke rekening tujuan berikut.</p>

                <div className="bank-account-details">
                  <div className="bank-info-card">
                    <div className="bank-logo-row payment-method-logo-row">
                      {selectedPaymentMethod.imageUrl ? (
                        <img src={resolveMediaUrl(selectedPaymentMethod.imageUrl)} alt={selectedPaymentMethod.name} />
                      ) : (
                        selectedPaymentMethod.name
                      )}
                    </div>
                    <div className="bank-num-label">Nomor Rekening / Virtual Account</div>
                    <div className="bank-num-value-row">
                      <strong>{selectedPaymentMethod.accountNumber || "-"}</strong>
                      <button
                        type="button"
                        onClick={() => handleCopyText(selectedPaymentMethod.accountNumber || "")}
                        disabled={!selectedPaymentMethod.accountNumber}
                      >
                        Salin
                      </button>
                    </div>
                    <div className="bank-holder-label">Atas Nama: <strong>{selectedPaymentMethod.accountName || "-"}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === "ewallet" && (
              <div className="payment-detail-box animated-fade">
                <h4>{selectedPaymentMethod.name}</h4>
                <p className="detail-subtext">Transfer e-wallet ke kode/nomor tujuan berikut.</p>

                <div className="bank-info-card">
                  <div className="bank-logo-row payment-method-logo-row">
                    {selectedPaymentMethod.imageUrl ? (
                      <img src={resolveMediaUrl(selectedPaymentMethod.imageUrl)} alt={selectedPaymentMethod.name} />
                    ) : (
                      selectedPaymentMethod.name
                    )}
                  </div>
                  <div className="bank-num-label">Kode / Nomor Tujuan</div>
                  <div className="bank-num-value-row">
                    <strong>{selectedPaymentMethod.accountNumber || "-"}</strong>
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedPaymentMethod.accountNumber || "")}
                      disabled={!selectedPaymentMethod.accountNumber}
                    >
                      Salin
                    </button>
                  </div>
                  <div className="bank-holder-label">Atas Nama: <strong>{selectedPaymentMethod.accountName || "-"}</strong></div>
                </div>
              </div>
            )}
          </section>
          {/* 5. TOMBOL BAYAR UTAMA */}
          {error && <p className="payment-error-msg">{error}</p>}
          <button
            type="button"
            className="btn-pay-now-large"
            onClick={handleOpenUploadModal}
          >
            🔒 Bayar Sekarang
          </button>
        </main>

        {/* PANEL KANAN: RINGKASAN PESANAN */}
        <aside className="payment-summary">
          <div className="summary-card">
            <div className="section-title-wrapper">
              <span className="section-badge">4</span>
              <h2>Ringkasan Pembayaran</h2>
            </div>

            <div className="package-hero">
              <span className="badge-popular">Paling Populer</span>
              <h4>FLIX PREMIUM</h4>
              <p>Langganan premium dengan fitur tak terbatas</p>
            </div>

            <div className="summary-details">
              <div className="summary-row">
                <span>Nama Produk / Layanan</span>
                <strong>
                  {isExclusivePackage ? "FLIX Eksklusif" : "FLIX Premium"} ({durationMonths} Bulan)
                </strong>
              </div>
              <div className="summary-row">
                <span>Nama Akun</span>
                <strong>{fullName || "Marsyanda"}</strong>
              </div>
              <div className="summary-row">
                <span>Email</span>
                <strong>{email || "marsyanda@gmail.com"}</strong>
              </div>
              <div className="summary-row">
                <span>Paket</span>
                <strong>
                  <img src={blueDiamondIcon} alt="" className="pro-icon" />{" "}
                  {packageDisplayName}
                </strong>
              </div>
              <div className="summary-row">
                <span>Harga per Bulan</span>
                <strong>{formatRupiah(packageUnitPrice)}</strong>
              </div>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatRupiah(subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Biaya Admin</span>
                <strong>{formatRupiah(adminFee)}</strong>
              </div>
              <div className="summary-row">
                <span>Periode Aktif</span>
                <strong>{getPeriodText()}</strong>
              </div>
              <div className="summary-row">
                <span>Metode Pembayaran</span>
                <strong>{selectedPaymentMethod.name}</strong>
              </div>

              <div className="summary-total">
                <span>Total Pembayaran</span>
                <span className="price-total">{formatRupiah(totalPayment)}</span>
              </div>
            </div>

            <div className="promo-group">
              <input
                type="text"
                placeholder="Masukkan kode promo"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
              />
              <button type="button">Pakai</button>
            </div>

            <div className="secure-badge">
              <span className="shield-icon">🛡️</span> Pembayaran aman &
              terenkripsi. Bisa dibatalkan kapan saja.
            </div>
          </div>
        </aside>
      </div>

      {/* POPUP MODAL 1: UPLOAD BUKTI PEMBAYARAN */}
      {showUploadModal && (
        <div className="modal-backdrop-blur">
          <div className="upload-payment-modal-card">
            <h3>Bukti Pembayaran</h3>
            <p>Silakan upload foto/gambar bukti pembayaran atau transfer untuk diproses verifikasi.</p>

            <form onSubmit={handleUploadAndConfirm}>
              <div className="upload-dropzone-wrapper">
                <input
                  type="file"
                  id="payment_proof"
                  accept="image/*"
                  onChange={handleFileChange}
                  required
                />
                <label htmlFor="payment_proof" className="dropzone-label">
                  {paymentProofPreview ? (
                    <img src={paymentProofPreview} alt="Preview Bukti" className="proof-img-preview" />
                  ) : (
                    <div className="dropzone-placeholder">
                      <span className="upload-cloud-icon">📤</span>
                      <strong>Klik untuk mencari gambar</strong>
                      <p>Mendukung JPG, PNG atau WEBP (Maks. 2MB)</p>
                    </div>
                  )}
                </label>
              </div>

              {error && <p className="payment-error-msg modal-err">{error}</p>}

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowUploadModal(false)}
                  disabled={loading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={loading}
                >
                  {loading ? "Mengunggah..." : "Unggah & Konfirmasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL 2: BUKTI PEMBAYARAN TERKIRIM */}
      {showSuccessModal && (
        <div className="modal-backdrop-blur">
          <div className="payment-success-card">
            {/* Green Checkmark */}
            <div className="success-checkmark-circle">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00E082" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <h2>Bukti Pembayaran Terkirim</h2>
            <p className="success-subtext">
              Transaksi kamu sedang menunggu verifikasi admin. Akses premium akan aktif setelah pembayaran disetujui.
            </p>

            {/* Badge Premium */}
            <div className="premium-active-badge-card">
              <span className="premium-star-icon">💎</span> Status: Pending Verifikasi
            </div>

            {/* Tabel Detail Transaksi */}
            <div className="success-transaction-table">
              <div className="table-row">
                <span>ID Transaksi</span>
                <strong>{transactionId}</strong>
              </div>
              <div className="table-row">
                <span>Paket</span>
                <strong>{packageDisplayName}</strong>
              </div>
              <div className="table-row">
                <span>Metode</span>
                <strong className="text-uppercase">{getPaymentMethodLabel()}</strong>
              </div>
              <div className="table-row">
                <span>Total Bayar</span>
                <strong>{formatRupiah(totalPayment)}</strong>
              </div>
              <div className="table-row">
                <span>Status</span>
                <strong>Menunggu Admin</strong>
              </div>
            </div>

            {/* Fitur Akan Aktif */}
            <div className="features-checklist-group">
              <h5>FITUR AKAN AKTIF SETELAH DISETUJUI:</h5>
              <ul>
                {pendingActivationFeatures.map((feature) => (
                  <li key={feature}>
                    <span className="feat-check-icon">✓</span> {feature}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              className="btn-success-modal-continue"
              onClick={() => {
                setShowSuccessModal(false);
                navigate("/profile");
              }}
            >
              Lihat Profil →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentPage;

