import pool from "./db.js";

const defaultPaymentMethods = [
  {
    id: "bca",
    type: "bank",
    name: "Bank BCA",
    category: "Bank",
    accountNumber: "1234567890",
    accountName: "FLIX Entertainment",
    imageName: "bank-bca.png",
    sortOrder: 1,
  },
  {
    id: "qris",
    type: "qris",
    name: "QRIS All Payment",
    category: "QRIS",
    accountNumber: "00020101021126680014ID.CO.QRIS.WWW01189360029314817",
    accountName: "FLIX Entertainment",
    imageName: "qris-flix.png",
    sortOrder: 2,
  },
  {
    id: "dana",
    type: "ewallet",
    name: "Dana",
    category: "E-Wallet",
    accountNumber: "08123456789",
    accountName: "FLIX Entertainment",
    imageName: "dana-flix.png",
    sortOrder: 3,
  },
];

const defaultPaymentPackages = [
  {
    code: "premium",
    name: "Premium Bulanan",
    durationMonths: 1,
    price: 29000,
    sortOrder: 1,
  },
  {
    code: "premium_yearly",
    name: "Eksklusif",
    durationMonths: 12,
    price: 249000,
    sortOrder: 2,
  },
];

export const initializePaymentMethodsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.payment_methods (
      id_method VARCHAR(80) PRIMARY KEY,
      type VARCHAR(30) NOT NULL,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(80),
      account_number TEXT,
      account_name VARCHAR(160),
      image_url TEXT,
      image_name VARCHAR(180),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT payment_methods_type_check
        CHECK (type IN ('bank', 'qris', 'ewallet'))
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flix.payment_packages (
      package_code VARCHAR(40) PRIMARY KEY,
      package_name VARCHAR(120) NOT NULL,
      duration_months INTEGER NOT NULL DEFAULT 1,
      price INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const method of defaultPaymentMethods) {
    await pool.query(
      `INSERT INTO flix.payment_methods (
         id_method,
         type,
         name,
         category,
         account_number,
         account_name,
         image_name,
         sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id_method) DO NOTHING`,
      [
        method.id,
        method.type,
        method.name,
        method.category,
        method.accountNumber,
        method.accountName,
        method.imageName,
        method.sortOrder,
      ],
    );
  }

  for (const paymentPackage of defaultPaymentPackages) {
    await pool.query(
      `INSERT INTO flix.payment_packages (
         package_code,
         package_name,
         duration_months,
         price,
         sort_order
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (package_code) DO NOTHING`,
      [
        paymentPackage.code,
        paymentPackage.name,
        paymentPackage.durationMonths,
        paymentPackage.price,
        paymentPackage.sortOrder,
      ],
    );
  }
};
