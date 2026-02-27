import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";
import multer from "multer";
import cloudinary from "./cloudinary.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

/* TEST ROOT */
app.get("/", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json({
    ok: true,
    dbTime: result.rows[0],
  });
});

/* GET PRODUCTS (OPTIONAL FILTER BY category_slug) */
app.get("/products", async (req, res) => {
  try {
    const { category_slug } = req.query;

    if (category_slug) {
      const result = await pool.query(
        "SELECT * FROM products WHERE category_slug = $1 ORDER BY created_at DESC",
        [category_slug]
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      "SELECT * FROM products ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ADD PRODUCT (NO IMAGE YET) */
app.post("/products", async (req, res) => {
  try {
    const { image_url, category_slug } = req.body;

    if (!image_url || !category_slug) {
      return res.status(400).json({
        error: "image_url and category_slug are required",
      });
    }

    const result = await pool.query(
      "INSERT INTO products (image_url, category_slug) VALUES ($1, $2) RETURNING *",
      [image_url, category_slug]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* UPLOAD PRODUCT IMAGE */
app.post("/upload/product", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const b64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "coverly/products",
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* UPLOAD PAYMENT IMAGE */
app.post("/upload/payment", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const b64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "coverly/payments",
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* UPLOAD CUSTOM DESIGN */
app.post("/upload/design", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const b64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "coverly/designs",
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE PRODUCT */
app.delete("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const result = await pool.query(
      "DELETE FROM products WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "product not found" });
    }

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET ALL ORDERS */
app.get("/orders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* CREATE ORDER */
app.post("/orders", async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_address,
      custom_design_url,
      governorate,
      shipping_fee,
      notes,
      payment_image,
      total_amount,
      products,
    } = req.body;

    if (
      !customer_name ||
      !customer_phone ||
      !customer_address ||
      !total_amount ||
      !products
    ) {
      return res.status(400).json({ error: "missing required fields" });
    }

    const result = await pool.query(
    `INSERT INTO orders 
    (customer_name, customer_phone, customer_address, governorate, shipping_fee, notes, payment_image, custom_design_url, total_amount, products)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *`,
    [
        customer_name,
        customer_phone,
        customer_address,
        governorate || null,
        shipping_fee || 0,
        notes || null,
        payment_image || null,
        custom_design_url || null,
        total_amount,
        JSON.stringify(products),
    ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ORDERS STATS */
app.get("/orders/stats", async (req, res) => {
  try {
    const totalResult = await pool.query(
      "SELECT COUNT(*) FROM orders"
    );

    const pendingResult = await pool.query(
      "SELECT COUNT(*) FROM orders WHERE status = 'pending'"
    );

    res.json({
      total: Number(totalResult.rows[0].count),
      pending: Number(pendingResult.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* LATEST ORDERS */
app.get("/orders/latest", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 5), 50);

    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC LIMIT $1",
      [limit]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE ALL ORDERS */
app.delete("/orders", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM orders");
    res.json({ ok: true, deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET ORDER BY ID */
app.get("/orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* UPDATE ORDER STATUS */
app.put("/orders/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: "invalid id or status" });
    }

    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* VALIDATE PROMO CODE */
app.get("/promo_codes/validate", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ ok: false, reason: "EMPTY" });

    const { rows } = await pool.query(
      "SELECT * FROM promo_codes WHERE UPPER(code) = $1 LIMIT 1",
      [code]
    );

    if (rows.length === 0) return res.json({ ok: false, reason: "NOT_FOUND" });

    const promo = rows[0];

    if (!promo.is_active) return res.json({ ok: false, reason: "INACTIVE" });

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.json({ ok: false, reason: "EXPIRED" });
    }

    if (promo.usage_limit != null && promo.used_count >= promo.usage_limit) {
      return res.json({ ok: false, reason: "LIMIT_REACHED" });
    }

    return res.json({
      ok: true,
      discount_percent: promo.discount_percent,
      promo_id: promo.id,
      code: promo.code,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* LIST PROMO CODES */
app.get("/promo_codes", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM promo_codes ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* CREATE PROMO CODE */
app.post("/promo_codes", async (req, res) => {
  try {
    const { code, discount_percent, is_active, expires_at, usage_limit } =
      req.body;

    const c = String(code || "").trim().toUpperCase();
    const d = Number(discount_percent);

    if (!c || !Number.isFinite(d)) {
      return res.status(400).json({ error: "code and discount_percent required" });
    }

    const result = await pool.query(
      `INSERT INTO promo_codes (code, discount_percent, is_active, expires_at, usage_limit)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        c,
        d,
        is_active ?? true,
        expires_at || null,
        usage_limit ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    // لو الكود مكرر
    if (String(err.message || "").toLowerCase().includes("duplicate")) {
      return res.status(409).json({ error: "code already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

/* TOGGLE PROMO ACTIVE */
app.patch("/promo_codes/:id/active", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_active } = req.body;

    if (!id || typeof is_active !== "boolean") {
      return res.status(400).json({ error: "invalid id or is_active" });
    }

    const result = await pool.query(
      "UPDATE promo_codes SET is_active = $1 WHERE id = $2 RETURNING *",
      [is_active, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "promo not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE PROMO CODE */
app.delete("/promo_codes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const result = await pool.query(
      "DELETE FROM promo_codes WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "promo not found" });
    }

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/feedbacks", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM feedbacks ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/upload/feedback", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const b64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "coverly/feedbacks",
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/feedbacks", async (req, res) => {
  try {
    const { image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: "image_url is required" });
    }

    const result = await pool.query(
      "INSERT INTO feedbacks (image_url) VALUES ($1) RETURNING *",
      [image_url]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/feedbacks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const result = await pool.query(
      "DELETE FROM feedbacks WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "feedback not found" });
    }

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port", PORT));