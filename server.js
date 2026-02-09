const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const path = require("path");
const cors = require("cors");
const { pool, initDb } = require("./db");

const app = express();
const port = process.env.PORT || 3000;

// Initialize Database
initDb();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "icd_secret_key_123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// Auth Middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized. Please sign in." });
  }
};

// --- AUTH ROUTES ---

// Register
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, hashedPassword]
    );
    res.status(201).json({ message: "User created", user: result.rows[0] });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Username or email already exists" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { identifier, password } = req.body; // identifier can be username or email
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1 OR email = $1",
      [identifier]
    );
    const user = result.rows[0];

    if (user && (await bcrypt.compare(password, user.password_hash))) {
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;
      res.json({ message: "Login successful", user: { id: user.id, username: user.username, email: user.email } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not log out" });
    res.json({ message: "Logged out" });
  });
});

// User Status
app.get("/api/user-status", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, user: { username: req.session.username, email: req.session.email } });
  } else {
    res.json({ loggedIn: false });
  }
});

// --- SEARCH ROUTE ---
app.get("/search", async (req, res) => {
  const code = req.query.q;
  if (!code) {
    return res.status(400).json({ error: "Please provide an ICD code" });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM icd_codes_data
       WHERE LOWER(icd_10_code) = LOWER($1) OR LOWER(original_condition) LIKE LOWER($2)`,
      [code, `%${code}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Database error", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// --- EDITOR ROUTES ---

// Get table columns
app.get("/api/table-columns", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'icd_codes_data'
      ORDER BY ordinal_position
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch columns" });
  }
});

// Add a column
app.post("/api/add-column", isAuthenticated, async (req, res) => {
  const { columnName, dataType } = req.body;
  // Basic sanitization (should be more robust in production)
  if (!/^[a-z0-9_]+$/.test(columnName)) {
    return res.status(400).json({ error: "Invalid column name" });
  }

  try {
    await pool.query(`ALTER TABLE icd_codes_data ADD COLUMN ${columnName} ${dataType || 'TEXT'}`);

    // Log the change
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, table_name, column_name, username, email) VALUES ($1, $2, $3, $4, $5, $6)",
      [req.session.userId, "ADD_COLUMN", "icd_codes_data", columnName, req.session.username, req.session.email]
    );

    res.json({ message: `Column ${columnName} added successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add column" });
  }
});

// Update a cell
app.post("/api/update-cell", isAuthenticated, async (req, res) => {
  const { id, columnName, newValue } = req.body;

  if (!/^[a-z0-9_]+$/.test(columnName)) {
    return res.status(400).json({ error: "Invalid column name" });
  }

  try {
    const trimmedNewValue = String(newValue || "").trim();

    // Get old value for comparison
    const oldValResult = await pool.query(`SELECT ${columnName} FROM icd_codes_data WHERE icd_10_code = $1`, [id]);
    const rawOldValue = oldValResult.rows[0] ? oldValResult.rows[0][columnName] : "";
    const oldValue = (rawOldValue === null ? "" : String(rawOldValue)).trim();

    // Skip if no actual change
    if (oldValue === trimmedNewValue) {
      return res.json({ message: "No change detected" });
    }

    // Update value
    await pool.query(`UPDATE icd_codes_data SET ${columnName} = $1 WHERE icd_10_code = $2`, [trimmedNewValue, id]);

    // Log the change
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, table_name, column_name, row_id, old_value, new_value, username, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [req.session.userId, "UPDATE_CELL", "icd_codes_data", columnName, id, oldValue, trimmedNewValue, req.session.username, req.session.email]
    );

    res.json({ message: "Updated successfully" });
  } catch (err) {
    console.error("Update Cell Error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

// Get all data (with pagination)
app.get("/api/all-codes", isAuthenticated, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || "";
  const limit = 50;
  const offset = (page - 1) * limit;

  console.log(`🔍 [Editor Search] Term: "${search}", Page: ${page}`);

  try {
    let query = `SELECT * FROM icd_codes_data`;
    const params = [];

    if (search) {
      // Restricted search to only ICD code and Condition Name as requested
      // Synonyms and Drugs are explicitly EXCLUDED to prevent unwanted matches
      query += ` WHERE icd_10_code ILIKE $1 OR original_condition ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY icd_10_code LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Search API Error:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Add a new row
app.post("/api/add-row", isAuthenticated, async (req, res) => {
  const rowData = req.body;

  if (!rowData.icd_10_code) {
    return res.status(400).json({ error: "ICD-10 Code is required" });
  }

  try {
    // Check if 'id' column exists to handle auto-incrementing if requested
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'icd_codes_data' AND column_name = 'id'
    `);

    if (columnCheck.rows.length > 0) {
      // Find the next ID
      // We cast id to ::TEXT because regexp_replace expects a string, avoiding errors if id is an INTEGER
      const maxIdResult = await pool.query("SELECT MAX(NULLIF(regexp_replace(id::text, '\\D', '', 'g'), '')::integer) as max_id FROM icd_codes_data");
      const nextId = (maxIdResult.rows[0].max_id || 0) + 1;
      rowData.id = nextId.toString();
      console.log(`📌 Generated Next ID: ${rowData.id}`);
    }

    const columns = Object.keys(rowData);
    const values = Object.values(rowData);
    const colNames = columns.join(", ");
    const colPlaceholders = columns.map((_, i) => `$${i + 1}`).join(", ");

    await pool.query(
      `INSERT INTO icd_codes_data (${colNames}) VALUES (${colPlaceholders})`,
      values
    );

    // Log the change
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, table_name, row_id, username, email, new_value) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [req.session.userId, "ADD_ROW", "icd_codes_data", rowData.icd_10_code, req.session.username, req.session.email, JSON.stringify(rowData)]
    );

    res.json({ message: "Row added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add row. Code might already exist." });
  }
});

// Delete a row
app.post("/api/delete-row", isAuthenticated, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "ID required" });

  try {
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, table_name, row_id, username, email) VALUES ($1, $2, $3, $4, $5, $6)",
      [req.session.userId, "DELETE_ROW", "icd_codes_data", id, req.session.username, req.session.email]
    );

    await pool.query("DELETE FROM icd_codes_data WHERE icd_10_code = $1", [id]);
    res.json({ message: "Record deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete record" });
  }
});

// Get audit logs
app.get("/api/audit-logs", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
