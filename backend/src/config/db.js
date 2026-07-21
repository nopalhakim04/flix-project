import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();

const getSslMode = (connectionString = "") => {
  try {
    return new URL(connectionString).searchParams.get("sslmode")?.toLowerCase() ?? "";
  } catch {
    return connectionString.match(/[?&]sslmode=([^&]+)/i)?.[1]?.toLowerCase() ?? "";
  }
};

const normalizeDatabaseUrl = (connectionString) => {
  if (!connectionString) {
    return connectionString;
  }

  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

    // pg parses sslmode from connectionString after merging the explicit ssl object.
    // Supabase pooler URLs use sslmode=require, which should behave like libpq SSL.
    if (
      (sslMode === "prefer" || sslMode === "require") &&
      !url.searchParams.has("uselibpqcompat")
    ) {
      url.searchParams.set("uselibpqcompat", "true");
    }

    return url.toString();
  } catch {
    return connectionString;
  }
};

const databaseSslMode = getSslMode(databaseUrl);

const useSsl =
  process.env.DB_SSL === "true" ||
  (databaseSslMode && databaseSslMode !== "disable");

const poolConfig = databaseUrl
  ? {
      connectionString: normalizeDatabaseUrl(databaseUrl),
      ssl: useSsl ? { rejectUnauthorized: false } : undefined
    }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined
    };

const pool = new Pool(poolConfig);

export default pool;
