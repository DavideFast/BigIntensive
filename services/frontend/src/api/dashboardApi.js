const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload;
}

function normalizeListPayload(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    items,
    total: Number.isFinite(Number(payload?.total)) ? Number(payload.total) : items.length,
    source: payload?.source || "backend",
    timestamp: payload?.timestamp || null,
  };
}

export function getCorrelationMatrix() {
  return request("/dashboard/correlation-matrix").then(normalizeListPayload);
}

export function getTrainingStatus() {
  return request("/dashboard/training-status").then(normalizeListPayload);
}

export function getTrainingVolumes() {
  return request("/dashboard/training-volumes").then(normalizeListPayload);
}

export function getRunningChart() {
  return request("/dashboard/running-chart").then(normalizeListPayload);
}

export function getWorkoutsClickhouseChart() {
  return request("/dashboard/workouts-clickhouse-chart").then(normalizeListPayload);
}

export function simulateWorkout(payload) {
  return request("/dashboard/workout/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function simulateWeeklyPlan(payload) {
  return request("/dashboard/workouts/week/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startSmartwatchSession(payload) {
  return request("/simulation/session/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendSmartwatchSamples(sessionId, payload) {
  return request(`/simulation/session/${sessionId}/samples`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function endSmartwatchSession(sessionId, payload = {}) {
  return request(`/simulation/session/${sessionId}/end`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startLoadtest(payload) {
  return request("/loadtest/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLoadtestJob(jobId) {
  return request(`/loadtest/jobs/${jobId}`);
}
