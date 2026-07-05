export const correlationRows = [
  { metric: "HRV", volume: -0.62, acwr: -0.58, wellness: 0.64, readiness: 0.77 },
  { metric: "RPE", volume: 0.71, acwr: 0.79, wellness: -0.54, readiness: -0.66 },
  { metric: "Monotonia", volume: 0.43, acwr: 0.67, wellness: -0.35, readiness: -0.48 },
  { metric: "Power CMJ", volume: -0.31, acwr: -0.39, wellness: 0.59, readiness: 0.74 },
  { metric: "Soreness", volume: 0.49, acwr: 0.45, wellness: -0.68, readiness: -0.63 },
];

export const athletes = [
  {
    id: "AT-001",
    name: "Luca Ferri",
    status: "green",
    acwr: 0.91,
    readiness: 86,
    nextSession: "Forza lower",
  },
  {
    id: "AT-002",
    name: "Marta Leone",
    status: "amber",
    acwr: 1.24,
    readiness: 68,
    nextSession: "Tecnica sprint",
  },
  {
    id: "AT-003",
    name: "Davide Moretti",
    status: "red",
    acwr: 1.58,
    readiness: 44,
    nextSession: "Recupero attivo",
  },
  {
    id: "AT-004",
    name: "Giulia Vanni",
    status: "green",
    acwr: 0.97,
    readiness: 82,
    nextSession: "Plyo breve",
  },
];

export const weeklyVolumes = [
  { day: "Lun", load: 480 },
  { day: "Mar", load: 620 },
  { day: "Mer", load: 710 },
  { day: "Gio", load: 530 },
  { day: "Ven", load: 670 },
  { day: "Sab", load: 390 },
  { day: "Dom", load: 240 },
];

export const starterWorkout = {
  athlete: "AT-001",
  sessionType: "Forza",
  duration: 65,
  intensity: 7,
  notes: "",
};

export const starterWeek = {
  athlete: "AT-002",
  phase: "Costruzione",
  targetLoad: 3200,
  focus: "Tolleranza lattato",
};

export function getCorrelationTone(value) {
  const score = Math.min(1, Math.abs(value));
  if (value >= 0) {
    return `rgba(45, 127, 120, ${0.2 + score * 0.62})`;
  }
  return `rgba(175, 45, 45, ${0.2 + score * 0.62})`;
}
