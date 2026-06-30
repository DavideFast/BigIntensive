import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const requestFailures = new Counter("request_failures");

const BASE_URL = __ENV.BASE_URL || "http://backend-api:3001";
const ENDPOINT_MODE = (__ENV.ENDPOINT_MODE || "events").toLowerCase();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function eventsPayload() {
  return JSON.stringify({
    topic: "load-events",
    source: "k6-load-tester",
    status: "queued",
    payload: `sim-request-${__VU}-${__ITER}-${Date.now()}`,
  });
}

function forcePlatePayload() {
  const exercisePool = ["squat", "jump", "leg_press"];
  const exercise = exercisePool[randomInt(0, exercisePool.length - 1)];

  return JSON.stringify({
    athlete_id: `athlete-${String(randomInt(1, 3000)).padStart(4, "0")}`,
    exercise,
    duration_ms: randomInt(1200, 4500),
    repeat: randomInt(1, 4),
    interval_s: randomInt(1, 3),
  });
}

export default function () {
  let endpoint = "/events";
  let payload = eventsPayload();
  let expectedStatus = 201;

  if (ENDPOINT_MODE === "force-plate") {
    endpoint = "/force-plate/start";
    payload = forcePlatePayload();
    expectedStatus = 200;
  }

  const response = http.post(`${BASE_URL}${endpoint}`, payload, {
    headers: {
      "Content-Type": "application/json",
      "X-Load-Test": "k6",
    },
    timeout: "15s",
  });

  const ok = check(response, {
    "status is expected": (r) => r.status === expectedStatus,
  });

  if (!ok) {
    requestFailures.add(1);
  }

  sleep(Math.random() * 0.25);
}
