const { Pool } = require("pg");

const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined }
  : { host: process.env.DB_HOST || "localhost", port: process.env.DB_PORT || 5432, database: process.env.DB_NAME || "netrax_db", user: process.env.DB_USER || process.env.USER, password: process.env.DB_PASSWORD || undefined };
const pool = new Pool(connection);

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err);
});

module.exports = pool;
