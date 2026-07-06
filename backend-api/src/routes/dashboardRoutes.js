import express from "express";
const WEEKDAY_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function listPayload(items, source) {
  return {
    items,
    total: items.length,
    source,
    timestamp: new Date().toISOString(),
  };
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildClickHouseConfig(raw) {
  return {
    host: raw?.host || process.env.CLICKHOUSE_HOST || "clickhouse",
    port: Number(raw?.port || process.env.CLICKHOUSE_PORT || 8123),
    database: raw?.database || process.env.CLICKHOUSE_DB || process.env.CLICKHOUSE_DATABASE || "bigintensive",
    user: raw?.user || process.env.CLICKHOUSE_USER || "default",
    password: raw?.password || process.env.CLICKHOUSE_PASSWORD || "",
  };
}

async function queryClickHouse(config, sql) {
  const query = `${sql.trim()} FORMAT JSON`;
  const url = `http://${config.host}:${config.port}/?database=${encodeURIComponent(config.database)}&query=${encodeURIComponent(query)}`;

  const headers = { Accept: "application/json" };
  if (config.user) {
    const auth = Buffer.from(`${config.user}:${config.password || ""}`).toString("base64");
    headers.Authorization = `Basic ${auth}`;
  }

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickHouse query failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

export function createDashboardRouter({ pool, clickhouseConfig } = {}) {
  const router = express.Router();
  const clickhouse = buildClickHouseConfig(clickhouseConfig);

  router.get("/dashboard/correlation-matrix", async (req, res) => {
    if (!pool) {
      return res.status(500).json({ error: "Database pool unavailable" });
    }

    try {
      const { rows } = await pool.query(
        `
        WITH base AS (
          SELECT
            acwr::float8 AS acwr,
            hrv::float8 AS hrv,
            readiness::float8 AS readiness,
            trimp_7d::float8 AS trimp_7d,
            injury_risk_pct::float8 AS injury_risk
          FROM training_status_results
        )
        SELECT * FROM (
          SELECT 'HRV'::text AS metric,
                 COALESCE(corr(hrv, trimp_7d), 0)::float8 AS volume,
                 COALESCE(corr(hrv, acwr), 0)::float8 AS acwr,
                 COALESCE(corr(hrv, injury_risk), 0)::float8 AS wellness,
                 COALESCE(corr(hrv, readiness), 0)::float8 AS readiness
          FROM base
          UNION ALL
          SELECT 'Readiness',
                 COALESCE(corr(readiness, trimp_7d), 0)::float8,
                 COALESCE(corr(readiness, acwr), 0)::float8,
                 COALESCE(corr(readiness, injury_risk), 0)::float8,
                 1::float8
          FROM base
          UNION ALL
          SELECT 'Injury Risk',
                 COALESCE(corr(injury_risk, trimp_7d), 0)::float8,
                 COALESCE(corr(injury_risk, acwr), 0)::float8,
                 1::float8,
                 COALESCE(corr(injury_risk, readiness), 0)::float8
          FROM base
          UNION ALL
          SELECT 'ACWR',
                 COALESCE(corr(acwr, trimp_7d), 0)::float8,
                 1::float8,
                 COALESCE(corr(acwr, injury_risk), 0)::float8,
                 COALESCE(corr(acwr, readiness), 0)::float8
          FROM base
          UNION ALL
          SELECT 'TRIMP 7d',
                 1::float8,
                 COALESCE(corr(trimp_7d, acwr), 0)::float8,
                 COALESCE(corr(trimp_7d, injury_risk), 0)::float8,
                 COALESCE(corr(trimp_7d, readiness), 0)::float8
          FROM base
        ) x
        `,
      );

      const items = rows.map((row) => ({
        metric: row.metric,
        volume: parseNumber(row.volume),
        acwr: parseNumber(row.acwr),
        wellness: parseNumber(row.wellness),
        readiness: parseNumber(row.readiness),
      }));

      return res.json(listPayload(items, "citus"));
    } catch (err) {
      console.error("Correlation matrix query error:", err.message);
      return res.status(500).json({ error: "Correlation query failed", details: err.message });
    }
  });

  router.get("/dashboard/training-status", async (req, res) => {
    if (!pool) {
      return res.status(500).json({ error: "Database pool unavailable" });
    }

    try {
      const { rows } = await pool.query(
        `
        SELECT
          CONCAT('AT-', LPAD(a.athlete_id::text, 3, '0')) AS id,
          CONCAT(a.nome, ' ', a.cognome) AS name,
          LOWER(COALESCE(tsr.status, 'amber')) AS status,
          COALESCE(tsr.acwr::float8, 0) AS acwr,
          COALESCE(tsr.readiness::int, 0) AS readiness,
          CASE
            WHEN LOWER(COALESCE(tsr.status, 'amber')) = 'red' THEN 'Recupero attivo'
            WHEN LOWER(COALESCE(tsr.status, 'amber')) = 'amber' THEN 'Carico controllato'
            ELSE 'Sessione progressiva'
          END AS "nextSession"
        FROM athletes a
        LEFT JOIN LATERAL (
          SELECT status, acwr, readiness
          FROM training_status_results t
          WHERE t.athlete_id = a.athlete_id
          ORDER BY t.result_date DESC, t.created_at DESC
          LIMIT 1
        ) tsr ON TRUE
        ORDER BY a.athlete_id
        `,
      );

      return res.json(listPayload(rows, "citus"));
    } catch (err) {
      console.error("Training status query error:", err.message);
      return res.status(500).json({ error: "Training status query failed", details: err.message });
    }
  });

  router.get("/dashboard/training-volumes", async (req, res) => {
    if (!pool) {
      return res.status(500).json({ error: "Database pool unavailable" });
    }

    try {
      const { rows } = await pool.query(
        `
        WITH latest_week AS (
          SELECT MAX(week_id) AS week_id
          FROM weekly_cardio_aggregates
        )
        SELECT
          w.athlete_id,
          w.total_trimp::float8 AS load,
          EXTRACT(DOW FROM TO_DATE(SPLIT_PART(w.week_id, '-', 1) || '-' || SPLIT_PART(w.week_id, '-', 2) || '-1', 'IYYY-IW-ID'))::int AS dow
        FROM weekly_cardio_aggregates w
        JOIN latest_week lw ON w.week_id = lw.week_id
        ORDER BY w.athlete_id
        LIMIT 7
        `,
      );

      const items = rows.map((row, index) => ({
        day: WEEKDAY_IT[(parseNumber(row.dow, index % 7) + 7) % 7],
        load: Math.round(parseNumber(row.load)),
      }));

      return res.json(listPayload(items, "citus"));
    } catch (err) {
      console.error("Training volumes query error:", err.message);
      return res.status(500).json({ error: "Training volumes query failed", details: err.message });
    }
  });

  router.post("/dashboard/workout/simulate", (req, res) => {
    const { athlete, sessionType, duration, intensity, notes } = req.body || {};

    res.status(202).json({
      status: "accepted",
      simulated: true,
      payload: {
        athlete: athlete || "AT-001",
        sessionType: sessionType || "Forza",
        duration: Number(duration) || 60,
        intensity: Number(intensity) || 7,
        notes: notes || "",
      },
      message: "Workout simulation accepted (mock endpoint).",
      timestamp: new Date().toISOString(),
    });
  });

  router.post("/dashboard/workouts/week/simulate", (req, res) => {
    const { athlete, phase, targetLoad, focus } = req.body || {};
    const normalizedTargetLoad = Number(targetLoad) || 3200;

    res.status(202).json({
      status: "accepted",
      simulated: true,
      payload: {
        athlete: athlete || "AT-002",
        phase: phase || "Costruzione",
        targetLoad: normalizedTargetLoad,
        focus: focus || "Tolleranza lattato",
      },
      estimatedDailyLoad: Math.round(normalizedTargetLoad / 7),
      message: "Weekly workout plan simulation accepted (mock endpoint).",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/dashboard/running-chart", async (req, res) => {
    try {
      const rows = await queryClickHouse(
        clickhouse,
        `
        SELECT
          toInt32(intDiv(secondo, 300) + 1) AS km,
          round(avg(speed_kmh) * 0.0833333, 3) AS distanceSplit,
          round(avg(heart_rate_bpm), 2) AS heartRate
        FROM corsa_endurance_campioni
        GROUP BY km
        ORDER BY km
        LIMIT 10
        `,
      );

      const items = rows.map((row) => ({
        km: parseNumber(row.km),
        distanceSplit: parseNumber(row.distanceSplit),
        heartRate: parseNumber(row.heartRate),
      }));

      return res.json({
        ...listPayload(items, "clickhouse"),
        overlays: ["distanceSplit", "heartRate"],
      });
    } catch (err) {
      console.error("Running chart query error:", err.message);
      return res.status(500).json({ error: "Running chart query failed", details: err.message });
    }
  });

  return router;
}
