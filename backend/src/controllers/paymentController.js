import pool from "../config/db.js";
import { initializePaymentTransactionsTable } from "../config/initPaymentTransactions.js";
import { initializePaymentMethodsTable } from "../config/initPaymentMethods.js";
import { fileToDataUrl } from "../utils/uploadDataUrl.js";

export const mapPaymentMethodRow = (row) => ({
  id: row.id_method,
  type: row.type,
  name: row.name,
  category: row.category || "",
  accountNumber: row.account_number || "",
  accountName: row.account_name || "",
  imageUrl: row.image_url || "",
  imageName: row.image_name || "",
  isActive: row.is_active !== false,
  sortOrder: Number(row.sort_order || 0),
});

export const mapPaymentPackageRow = (row) => ({
  code: row.package_code,
  name: row.package_name,
  durationMonths: Number(row.duration_months || 1),
  price: Number(row.price || 0),
  isActive: row.is_active !== false,
  sortOrder: Number(row.sort_order || 0),
});

export const getPaymentMethodRows = async () => {
  await initializePaymentMethodsTable();

  const result = await pool.query(
    `SELECT *
     FROM flix.payment_methods
     WHERE is_active = TRUE
     ORDER BY sort_order ASC, created_at ASC`,
  );

  return result.rows;
};

export const getPaymentPackageRows = async () => {
  await initializePaymentMethodsTable();

  const result = await pool.query(
    `SELECT *
     FROM flix.payment_packages
     WHERE is_active = TRUE
     ORDER BY sort_order ASC, duration_months ASC`,
  );

  return result.rows;
};

export const getPaymentSettings = async (req, res) => {
  try {
    const methods = (await getPaymentMethodRows()).map(mapPaymentMethodRow);
    const packages = (await getPaymentPackageRows()).map(mapPaymentPackageRow);
    await initializePaymentTransactionsTable();
    const subscriberResult = await pool.query(
      `SELECT COUNT(DISTINCT u.id_user) AS total
       FROM flix.users u
       LEFT JOIN flix.payment_transactions pt
         ON pt.id_user = u.id_user
        AND pt.status = 'approved'
        AND (
          pt.premium_expired_at IS NULL
          OR pt.premium_expired_at > CURRENT_TIMESTAMP
        )
       WHERE u.subscription_plan IN ('premium', 'exclusive')
          OR u.is_premium = TRUE
          OR pt.id_transaction IS NOT NULL`,
    );
    const subscriberCount = Number(subscriberResult.rows[0]?.total || 0);

    return res.json({ methods, packages, subscriberCount });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil pengaturan pembayaran.",
      error: error.message,
    });
  }
};

export const getCurrentPayment = async (req, res) => {
  try {
    const userId = req.user?.id_user || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "User tidak teridentifikasi. Silakan login kembali.",
      });
    }

    await initializePaymentTransactionsTable();

    const pendingResult = await pool.query(
      `SELECT *
       FROM flix.payment_transactions
       WHERE id_user = $1
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );

    const pendingPayment = pendingResult.rows[0];

    if (!pendingPayment) {
      return res.json({
        hasPendingPayment: false,
        pendingPayment: null,
      });
    }

    return res.json({
      hasPendingPayment: true,
      pendingPayment: {
        id: Number(pendingPayment.id_transaction),
        transactionId: formatTransactionId(
          pendingPayment.id_transaction,
          pendingPayment.created_at,
        ),
        status: pendingPayment.status,
        packageCode: pendingPayment.package_code,
        packageName: pendingPayment.package_name,
        durationMonths: Number(pendingPayment.duration_months || 1),
        amount: Number(pendingPayment.amount || 0),
        adminFee: Number(pendingPayment.admin_fee || 0),
        totalAmount: Number(pendingPayment.total_amount || 0),
        paymentMethod: pendingPayment.payment_method,
        paymentMethodDetail: pendingPayment.payment_method_detail,
        paymentProof: pendingPayment.payment_proof,
        createdAt: pendingPayment.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil status pembayaran.",
      error: error.message,
    });
  }
};

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
};

const normalizePackage = (body) => {
  const durationMonths = normalizeNumber(body.durationMonths ?? body.duration_months, 1) || 1;
  const rawName = String(body.packageName || body.package_name || "").trim();
  const packageCode =
    String(body.packageCode || body.package_code || "").trim() ||
    (durationMonths >= 12 ? "premium_yearly" : "premium");
  const packageName =
    rawName || (durationMonths >= 12 ? "Eksklusif" : "Premium Bulanan");

  return {
    packageCode,
    packageName,
    durationMonths,
  };
};

const formatTransactionId = (id, createdAt) => {
  const date = new Date(createdAt);
  const dateToken = Number.isNaN(date.getTime())
    ? "00000000"
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  return `#TRX-${dateToken}-${String(id).padStart(3, "0")}`;
};

export const upgradeToPremium = async (req, res) => {
  try {
    // Ambil ID User dari token login yang didekode oleh middleware verifyToken
    const userId = req.user?.id_user || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "User tidak teridentifikasi. Silakan login kembali.",
      });
    }

    const paymentProofPath = req.file ? fileToDataUrl(req.file) : null;

    if (!paymentProofPath) {
      return res.status(400).json({
        message: "Bukti pembayaran wajib diunggah!",
      });
    }

    await initializePaymentTransactionsTable();

    const { packageCode, packageName, durationMonths } = normalizePackage(req.body || {});
    const amount = normalizeNumber(req.body.amount, 0);
    const adminFee = normalizeNumber(req.body.adminFee ?? req.body.admin_fee, 0);
    const totalAmount = normalizeNumber(req.body.totalAmount ?? req.body.total_amount, amount + adminFee);
    const paymentMethod = String(req.body.paymentMethod || req.body.payment_method || "qris").trim();
    const paymentMethodDetail = String(
      req.body.paymentMethodDetail || req.body.payment_method_detail || "",
    ).trim();

    const userResult = await pool.query(
      `SELECT id_user, username, email
       FROM flix.users
       WHERE id_user = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    const transactionResult = await pool.query(
      `INSERT INTO flix.payment_transactions (
         id_user,
         package_code,
         package_name,
         duration_months,
         payment_method,
         payment_method_detail,
         amount,
         admin_fee,
         total_amount,
         payer_name,
         payer_email,
         payer_phone,
         ewallet_phone,
         payment_proof,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
       RETURNING *`,
      [
        userId,
        packageCode,
        packageName,
        durationMonths,
        paymentMethod,
        paymentMethodDetail,
        amount,
        adminFee,
        totalAmount,
        String(req.body.payerName || req.body.payer_name || userResult.rows[0].username || "").trim(),
        String(req.body.payerEmail || req.body.payer_email || userResult.rows[0].email || "").trim(),
        String(req.body.payerPhone || req.body.payer_phone || "").trim(),
        String(req.body.ewalletPhone || req.body.ewallet_phone || "").trim(),
        paymentProofPath,
      ],
    );

    const transaction = transactionResult.rows[0];

    return res.status(201).json({
      message: "Bukti pembayaran berhasil dikirim. Transaksi menunggu verifikasi admin.",
      transaction: {
        id: Number(transaction.id_transaction),
        transactionId: formatTransactionId(transaction.id_transaction, transaction.created_at),
        package: transaction.package_name,
        packageCode: transaction.package_code,
        method: transaction.payment_method,
        amount: Number(transaction.amount || 0),
        adminFee: Number(transaction.admin_fee || 0),
        totalAmount: Number(transaction.total_amount || 0),
        status: "Pending",
        paymentProof: transaction.payment_proof,
        createdAt: transaction.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengirim bukti pembayaran premium.",
      error: error.message,
    });
  }
};
