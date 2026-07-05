const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

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

export function getCorrelationMatrix() {
  return request("/dashboard/correlation-matrix");
}

export function getTrainingStatus() {
  return request("/dashboard/training-status");
}

export function getTrainingVolumes() {
  return request("/dashboard/training-volumes");
}

export function getRunningChart() {
  return request("/dashboard/running-chart");
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
