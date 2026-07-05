import express from "express";

const correlationRows = [
  { metric: "HRV", volume: -0.62, acwr: -0.58, wellness: 0.64, readiness: 0.77 },
  { metric: "RPE", volume: 0.71, acwr: 0.79, wellness: -0.54, readiness: -0.66 },
  { metric: "Monotonia", volume: 0.43, acwr: 0.67, wellness: -0.35, readiness: -0.48 },
  { metric: "Power CMJ", volume: -0.31, acwr: -0.39, wellness: 0.59, readiness: 0.74 },
  { metric: "Soreness", volume: 0.49, acwr: 0.45, wellness: -0.68, readiness: -0.63 },
];

const trainingStatusItems = [
  { id: "AT-001", name: "Luca Ferri", status: "green", acwr: 0.91, readiness: 86, nextSession: "Forza lower" },
  { id: "AT-002", name: "Marta Leone", status: "amber", acwr: 1.24, readiness: 68, nextSession: "Tecnica sprint" },
  { id: "AT-003", name: "Davide Moretti", status: "red", acwr: 1.58, readiness: 44, nextSession: "Recupero attivo" },
  { id: "AT-004", name: "Giulia Vanni", status: "green", acwr: 0.97, readiness: 82, nextSession: "Plyo breve" },
];

const weeklyVolumes = [
  { day: "Lun", load: 480 },
  { day: "Mar", load: 620 },
  { day: "Mer", load: 710 },
  { day: "Gio", load: 530 },
  { day: "Ven", load: 670 },
  { day: "Sab", load: 390 },
  { day: "Dom", load: 240 },
];

const runningSeries = [
  { km: 1, distanceSplit: 1.0, heartRate: 132 },
  { km: 2, distanceSplit: 1.0, heartRate: 138 },
  { km: 3, distanceSplit: 1.0, heartRate: 146 },
  { km: 4, distanceSplit: 1.0, heartRate: 151 },
  { km: 5, distanceSplit: 1.0, heartRate: 158 },
  { km: 6, distanceSplit: 1.0, heartRate: 164 },
  { km: 7, distanceSplit: 1.0, heartRate: 169 },
  { km: 8, distanceSplit: 1.0, heartRate: 166 },
  { km: 9, distanceSplit: 1.0, heartRate: 161 },
  { km: 10, distanceSplit: 1.0, heartRate: 156 },
];

export function createDashboardRouter() {
  const router = express.Router();

  router.get("/dashboard/correlation-matrix", (req, res) => {
    res.json({
      items: correlationRows,
      total: correlationRows.length,
      source: "mock",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/dashboard/training-status", (req, res) => {
    res.json({
      items: trainingStatusItems,
      total: trainingStatusItems.length,
      source: "mock",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/dashboard/training-volumes", (req, res) => {
    res.json({
      items: weeklyVolumes,
      total: weeklyVolumes.length,
      source: "mock",
      timestamp: new Date().toISOString(),
    });
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

  router.get("/dashboard/running-chart", (req, res) => {
    res.json({
      items: runningSeries,
      total: runningSeries.length,
      overlays: ["distanceSplit", "heartRate"],
      source: "mock",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
