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
