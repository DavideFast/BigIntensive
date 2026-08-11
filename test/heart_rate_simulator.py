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

    def _cadence_profile(self, t_norm: float) -> float:
        # Steps per minute trend during endurance run.
        if t_norm < 0.15:
            cadence = 150 + (168 - 150) * (t_norm / 0.15)
        elif t_norm < 0.85:
            cadence = 168 + 4 * (t_norm - 0.15) / 0.70
        else:
            cadence = 172 - 10 * (t_norm - 0.85) / 0.15

        return max(130.0, cadence + random.uniform(-2.0, 2.0))

    def _speed_profile(self, t_norm: float) -> float:
        # Speed in km/h for progressive endurance pacing.
        if t_norm < 0.20:
            speed = 8.5 + (11.2 - 8.5) * (t_norm / 0.20)
        elif t_norm < 0.80:
            speed = 11.2 + 0.8 * (t_norm - 0.20) / 0.60
        else:
            speed = 12.0 - 1.8 * (t_norm - 0.80) / 0.20

        return max(5.0, speed + random.uniform(-0.25, 0.25))

    def _altitude_profile(self, t_norm: float) -> float:
        # Rolling route with mild climb then descent.
        if t_norm < 0.50:
            altitude = 120 + 24 * (t_norm / 0.50)
        else:
            altitude = 144 - 20 * (t_norm - 0.50) / 0.50

        return max(0.0, altitude + random.uniform(-1.2, 1.2))

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
            cadence_spm = round(self._cadence_profile(t_norm), 1)
            speed_kmh = round(self._speed_profile(t_norm), 2)
            altitude_m = round(self._altitude_profile(t_norm), 1)

            sample = {
                "athlete_id": self.athlete_id,
                "sport": "running_endurance",
                "heart_rate_bpm": bpm,
                "heart_rate_zone": self._zone(bpm),
                "cadence_spm": cadence_spm,
                "speed_kmh": speed_kmh,
                "altitude_m": altitude_m,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "sample_index": i,
            }
            samples.append(sample)

        return samples
