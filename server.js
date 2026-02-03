const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); 

// PostgreSQL connection. Prefer `DATABASE_URL` when present (Render provides it).
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
} else {
  pool = new Pool({
    user: process.env.PGUSER || "postgres",
    host: process.env.PGHOST || "localhost",
    database: process.env.PGDATABASE || "db_icd_codes",
    password: process.env.PGPASSWORD || "Bliss@2005",
    port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
  });
}

// Search route — exact match
app.get("/search", async (req, res) => {
  const code = req.query.q;
  if (!code) {
    return res.status(400).json({ error: "Please provide an ICD code" });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM icd_codes_data
       WHERE LOWER(icd_10_code) = LOWER($1)`,
      [code]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Database error", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
