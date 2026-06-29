import time
import random
from datetime import datetime


class ForceProfileSimulator:
    """Simulates realistic force plate measurements with dual sensors (left/right foot)"""

    def __init__(self, athlete_id, exercise, duration_ms=3000):
        self.athlete_id = athlete_id
        self.exercise = exercise
        self.duration_ms = duration_ms
        self.start_time = datetime.utcnow()

    def squat_profile(self, t_norm):
        """
        Squat: loading phase, plateau, unloading
        Left/right can have slight asymmetry
        """
        if t_norm < 0.3:  # Loading
            base_force = 800 * (t_norm / 0.3)
        elif t_norm < 0.7:  # Plateau
            base_force = 800
        else:  # Unloading
            base_force = 800 * (1 - (t_norm - 0.7) / 0.3)

        # Add asymmetry and noise
        left_factor = 0.95 + random.uniform(-0.05, 0.1)
        right_factor = 1.05 + random.uniform(-0.05, 0.05)
        noise = random.uniform(-10, 10)

        left_force = max(0, base_force * left_factor + noise)
        right_force = max(0, base_force * right_factor + noise)

        return left_force, right_force

    def jump_profile(self, t_norm):
        """
        Jump: rapid loading, brief peak, quick unloading
        Both feet should be more symmetric during explosive movement
        """
        if t_norm < 0.15:  # Rapid loading
            base_force = 1200 * (t_norm / 0.15)
        elif t_norm < 0.25:  # Peak
            base_force = 1200
        else:  # Rapid unloading
            base_force = 1200 * (1 - (t_norm - 0.25) / 0.75)

        # More symmetric for jump
        symmetry = 0.98 + random.uniform(-0.02, 0.02)
        left_factor = symmetry
        right_factor = 1 / symmetry if symmetry > 0 else 1.0
        noise = random.uniform(-15, 15)

        left_force = max(0, base_force * left_factor + noise)
        right_force = max(0, base_force * right_factor + noise)

        return left_force, right_force

    def leg_press_profile(self, t_norm):
        """
        Leg press: slow ramp, long plateau, decay
        Can show side dominance
        """
        if t_norm < 0.4:  # Slow ramp
            base_force = 1500 * (t_norm / 0.4)
        elif t_norm < 0.65:  # Plateau
            base_force = 1500
        else:  # Decay
            base_force = 1500 * (1 - (t_norm - 0.65) / 0.35)

        # Dominant leg (right, typically)
        left_factor = 0.92 + random.uniform(-0.08, 0.08)
        right_factor = 1.08 + random.uniform(-0.08, 0.08)
        noise = random.uniform(-20, 20)

        left_force = max(0, base_force * left_factor + noise)
        right_force = max(0, base_force * right_factor + noise)

        return left_force, right_force

    def get_force_pair(self, t_norm):
        """Get left and right foot forces based on exercise profile"""
        if self.exercise == "squat":
            return self.squat_profile(t_norm)
        elif self.exercise == "jump":
            return self.jump_profile(t_norm)
        elif self.exercise == "leg_press":
            return self.leg_press_profile(t_norm)
        else:
            return 0, 0

    def generate_samples(self, sample_rate_hz=100):
        """Generate force plate samples at specified rate"""
        samples = []
        num_samples = int(self.duration_ms / 1000 * sample_rate_hz)

        for i in range(num_samples):
            # Normalized time (0 to 1)
            t_norm = i / max(1, num_samples - 1)

            # Get force values
            left_force, right_force = self.get_force_pair(t_norm)

            # Calculate actual timestamp
            elapsed_ms = (i / sample_rate_hz) * 1000
            sample_time = datetime.utcnow()

            sample = {
                "athlete_id": self.athlete_id,
                "exercise": self.exercise,
                "left_foot_force_newtons": round(left_force, 2),
                "right_foot_force_newtons": round(right_force, 2),
                "total_force_newtons": round(left_force + right_force, 2),
                "timestamp": sample_time.isoformat() + "Z",
                "sample_index": i,
            }
            samples.append(sample)

        return samples
