import express from "express";

export function createBusinessRouter({ pool, correlationMatrices }) {
  const router = express.Router();

  router.get("/athletes", async (req, res) => {
    try {
      const result = await pool.query("SELECT athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at FROM athletes ORDER BY created_at DESC");
      res.json({ items: result.rows, total: result.rows.length });
    } catch (err) {
      console.error("Database error:", err.message);
      res.status(500).json({ error: "Database error", details: err.message });
    }
  });

  router.get("/athletes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query("SELECT athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at FROM athletes WHERE athlete_id = $1", [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Athlete not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Database error:", err.message);
      res.status(500).json({ error: "Database error", details: err.message });
    }
  });

  router.post("/athletes", async (req, res) => {
    const { nome, cognome, eta, sesso, altezza_cm, peso_kg } = req.body || {};

    if (!nome || !cognome || !eta || !sesso || !altezza_cm || !peso_kg) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["nome", "cognome", "eta", "sesso", "altezza_cm", "peso_kg"],
      });
    }

    try {
      const result = await pool.query("INSERT INTO athletes (nome, cognome, eta, sesso, altezza_cm, peso_kg) VALUES ($1, $2, $3, $4, $5, $6) RETURNING athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at", [nome, cognome, eta, sesso, altezza_cm, peso_kg]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Database error:", err.message);
      res.status(500).json({ error: "Database error", details: err.message });
    }
  });

  router.put("/athletes/:id", async (req, res) => {
    const { id } = req.params;
    const { nome, cognome, eta, sesso, altezza_cm, peso_kg } = req.body || {};

    if (!nome && !cognome && !eta && !sesso && !altezza_cm && !peso_kg) {
      return res.status(400).json({ error: "No fields to update" });
    }

    try {
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (nome !== undefined) {
        updates.push(`nome = $${paramIndex++}`);
        values.push(nome);
      }
      if (cognome !== undefined) {
        updates.push(`cognome = $${paramIndex++}`);
        values.push(cognome);
      }
      if (eta !== undefined) {
        updates.push(`eta = $${paramIndex++}`);
        values.push(eta);
      }
      if (sesso !== undefined) {
        updates.push(`sesso = $${paramIndex++}`);
        values.push(sesso);
      }
      if (altezza_cm !== undefined) {
        updates.push(`altezza_cm = $${paramIndex++}`);
        values.push(altezza_cm);
      }
      if (peso_kg !== undefined) {
        updates.push(`peso_kg = $${paramIndex++}`);
        values.push(peso_kg);
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);

      const query = `UPDATE athletes SET ${updates.join(", ")} WHERE athlete_id = $${paramIndex} RETURNING athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, updated_at`;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Athlete not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Database error:", err.message);
      res.status(500).json({ error: "Database error", details: err.message });
    }
  });

  router.get("/correlations", (req, res) => {
    const items = [...correlationMatrices.values()].map((entry) => ({
      atleta: entry.atleta,
      rows: entry.rows,
      columnsCount: entry.columns.length,
      updatedAt: entry.updatedAt,
    }));

    res.json({ items, total: items.length });
  });

  router.get("/correlations/:atleta", (req, res) => {
    const atleta = String(req.params.atleta);
    const matrix = correlationMatrices.get(atleta);

    if (!matrix) {
      return res.status(404).json({ error: "Correlation matrix not found" });
    }

    return res.json(matrix);
  });

  router.post("/correlations/:atleta", (req, res) => {
    const atleta = String(req.params.atleta);
    const { columns, matrix, rows } = req.body || {};

    if (!Array.isArray(columns) || columns.length < 2) {
      return res.status(400).json({
        error: "Invalid columns",
        details: "columns must be an array with at least 2 items",
      });
    }

    if (!Array.isArray(matrix) || matrix.length !== columns.length) {
      return res.status(400).json({
        error: "Invalid matrix",
        details: "matrix must be a square array with the same size as columns",
      });
    }

    const validSquare = matrix.every((row) => Array.isArray(row) && row.length === columns.length);
    if (!validSquare) {
      return res.status(400).json({
        error: "Invalid matrix shape",
        details: "each matrix row must have the same size as columns",
      });
    }

    const payload = {
      atleta,
      columns,
      matrix,
      rows: Number(rows) || 0,
      updatedAt: new Date().toISOString(),
    };

    correlationMatrices.set(atleta, payload);
    return res.status(201).json(payload);
  });

  router.delete("/correlations/:atleta", (req, res) => {
    const atleta = String(req.params.atleta);
    const removed = correlationMatrices.delete(atleta);

    if (!removed) {
      return res.status(404).json({ error: "Correlation matrix not found" });
    }

    return res.status(204).send();
  });

  return router;
}
