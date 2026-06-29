from __future__ import annotations

import random
from datetime import datetime


class HeartRateSimulator:
    """Simulate heart-rate traces for endurance running sessions."""

    def __init__(self, athlete_id: str, duration_ms: int = 30_000) -> None:
        self.athlete_id = athlete_id
        self.duration_ms = duration_ms

    def _heart_rate_profile(self, t_norm: float) -> float:
        # Endurance run profile: warm-up, steady-state, slight fatigue drift, cooldown.
        if t_norm < 0.15:
            bpm = 95 + (145 - 95) * (t_norm / 0.15)
        elif t_norm < 0.75:
            bpm = 145 + 8 * (t_norm - 0.15) / 0.60
        elif t_norm < 0.90:
            bpm = 153 + 4 * (t_norm - 0.75) / 0.15
        else:
            bpm = 157 - 35 * (t_norm - 0.90) / 0.10

        breathing_wave = 2.5 * random.uniform(-1.0, 1.0)
        sensor_noise = random.uniform(-1.5, 1.5)
        return max(70.0, bpm + breathing_wave + sensor_noise)

    def _zone(self, bpm: float) -> str:
        if bpm < 120:
            return "z1_recovery"
        if bpm < 140:
            return "z2_aerobic"
        if bpm < 160:
            return "z3_tempo"
        if bpm < 175:
            return "z4_threshold"
        return "z5_vo2max"

    def generate_samples(self, sample_rate_hz: int = 1) -> list[dict]:
        samples: list[dict] = []
        num_samples = max(1, int(self.duration_ms / 1000 * sample_rate_hz))

        for i in range(num_samples):
            t_norm = i / max(1, num_samples - 1)
            bpm = round(self._heart_rate_profile(t_norm), 1)

            sample = {
                "athlete_id": self.athlete_id,
                "sport": "running_endurance",
                "heart_rate_bpm": bpm,
                "heart_rate_zone": self._zone(bpm),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "sample_index": i,
            }
            samples.append(sample)

        return samples
