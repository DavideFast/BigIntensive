export function validateLoadtestPayload(body) {
  const { mode, vus, duration } = body || {};
  const endpointMode = String(mode || "events").toLowerCase();
  const parsedVus = Math.max(1, Number(vus) || 1);
  const parsedDuration = String(duration || "60s").trim();

  if (!["events", "force-plate"].includes(endpointMode)) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid mode",
        valid: ["events", "force-plate"],
      },
    };
  }

  if (!/^\d+[smh]$/.test(parsedDuration)) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid duration format",
        expected: "Examples: 30s, 2m, 1h",
      },
    };
  }

  return { ok: true, endpointMode, parsedVus, parsedDuration };
}
