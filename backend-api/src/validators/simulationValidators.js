const VALID_EXERCISES = ["squat", "jump", "leg_press"];

export function validateEventPayload(body) {
  const { topic, source, status, payload } = body || {};
  if (!topic || !source || !status || !payload) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Missing fields",
        required: ["topic", "source", "status", "payload"],
      },
    };
  }

  return { ok: true };
}

export function validateForcePlatePayload(body) {
  const { athlete_id, exercise } = body || {};

  if (!athlete_id || !exercise) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Missing required fields",
        required: ["athlete_id", "exercise"],
      },
    };
  }

  if (!VALID_EXERCISES.includes(exercise)) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid exercise",
        valid: VALID_EXERCISES,
      },
    };
  }

  return { ok: true };
}

export function validateHeartRatePayload(body) {
  const { athlete_id, session_id } = body || {};
  if (!athlete_id) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Missing required fields",
        required: ["athlete_id"],
      },
    };
  }

  if (session_id !== undefined) {
    const parsedSessionId = Number(session_id);
    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      return {
        ok: false,
        status: 400,
        payload: {
          error: "Invalid session_id",
          details: "session_id must be a positive integer",
        },
      };
    }
  }

  return { ok: true };
}

export function validateSmartwatchSessionStartPayload(body) {
  const { athlete_id } = body || {};
  if (!athlete_id) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Missing required fields",
        required: ["athlete_id"],
      },
    };
  }

  return { ok: true };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateSmartwatchSamplesPayload(body) {
  const { samples } = body || {};

  if (!Array.isArray(samples) || samples.length === 0) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid samples payload",
        details: "samples must be a non-empty array",
      },
    };
  }

  for (let i = 0; i < samples.length; i += 1) {
    const item = samples[i] || {};
    if (!isFiniteNumber(Number(item.heart_rate_bpm)) || !isFiniteNumber(Number(item.cadence_spm)) || !isFiniteNumber(Number(item.speed_kmh)) || !isFiniteNumber(Number(item.altitude_m))) {
      return {
        ok: false,
        status: 400,
        payload: {
          error: "Invalid sample item",
          details: `samples[${i}] must contain numeric heart_rate_bpm, cadence_spm, speed_kmh, altitude_m`,
        },
      };
    }
  }

  return { ok: true };
}

export function validateSmartwatchSessionEndPayload(body) {
  const { reason } = body || {};
  if (reason !== undefined && typeof reason !== "string") {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid reason",
        details: "reason must be a string when provided",
      },
    };
  }

  return { ok: true };
}
