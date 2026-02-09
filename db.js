const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    user: process.env.PGUSER || "postgres",
    host: process.env.PGHOST || "localhost",
    database: process.env.PGDATABASE || "db_icd_codes",
    password: process.env.PGPASSWORD || "Bliss@2005",
    port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
});

const initDb = async () => {
    try {
        // Create icd_codes_data table if not exists
        await pool.query(`
      CREATE TABLE IF NOT EXISTS icd_codes_data (
        icd_10_code VARCHAR(20) PRIMARY KEY,
        original_condition TEXT,
        billability VARCHAR(50),
        years VARCHAR(50),
        synonyms TEXT,
        drugs TEXT
      );
    `);

        // Create users table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Create audit_logs table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL,
        table_name VARCHAR(50),
        column_name VARCHAR(50),
        row_id TEXT,
        old_value TEXT,
        new_value TEXT,
        username VARCHAR(50),
        email VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        console.log("✅ Database tables initialized");
    } catch (err) {
        console.error("❌ Error initializing database:", err);
    }
};

module.exports = { pool, initDb };
