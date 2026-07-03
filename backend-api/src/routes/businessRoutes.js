import express from "express";
import { createAthletesRepository } from "../repositories/athletesRepository.js";
import { validateCorrelationPayload } from "../validators/correlationValidators.js";

export function createBusinessRouter({ pool, correlationStore }) {
  const router = express.Router();
  const athletesRepository = createAthletesRepository(pool);

  router.get("/athletes", async (req, res) => {
    try {
      const items = await athletesRepository.list();
      res.json({ items, total: items.length });
    } catch (err) {
      console.error("Database error:", err.message);
      res.status(500).json({ error: "Database error", details: err.message });
    }
  });

  router.get("/athletes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const athlete = await athletesRepository.getById(id);

      if (!athlete) {
        return res.status(404).json({ error: "Athlete not found" });
      }

      res.json(athlete);
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
      const athlete = await athletesRepository.create({ nome, cognome, eta, sesso, altezza_cm, peso_kg });
      res.status(201).json(athlete);
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
      const updated = await athletesRepository.update(id, {
        nome,
        cognome,
        eta,
        sesso,
        altezza_cm,
        peso_kg,
      });

      if (!updated) {
        return res.status(404).json({ error: "Athlete not found" });
      }

      res.json(updated);
    } catch (err) {
      console.error("Database error:", err.message);
      res.status(500).json({ error: "Database error", details: err.message });
    }
  });

  router.get("/correlations", (req, res) => {
    const items = correlationStore.list().map((entry) => ({
      atleta: entry.atleta,
      rows: entry.rows,
      columnsCount: entry.columns.length,
      updatedAt: entry.updatedAt,
    }));

    res.json({ items, total: items.length });
  });

  router.get("/correlations/:atleta", (req, res) => {
    const atleta = String(req.params.atleta);
    const matrix = correlationStore.get(atleta);

    if (!matrix) {
      return res.status(404).json({ error: "Correlation matrix not found" });
    }

    return res.json(matrix);
  });

  router.post("/correlations/:atleta", (req, res) => {
    const atleta = String(req.params.atleta);
    const { columns, matrix, rows } = req.body || {};

    const validation = validateCorrelationPayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json(validation.payload);
    }

    const payload = {
      atleta,
      columns,
      matrix,
      rows: Number(rows) || 0,
      updatedAt: new Date().toISOString(),
    };

    correlationStore.set(atleta, payload);
    return res.status(201).json(payload);
  });

  router.delete("/correlations/:atleta", (req, res) => {
    const atleta = String(req.params.atleta);
    const removed = correlationStore.delete(atleta);

    if (!removed) {
      return res.status(404).json({ error: "Correlation matrix not found" });
    }

    return res.status(204).send();
  });

  return router;
}
