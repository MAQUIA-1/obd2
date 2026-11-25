// Demo readings based on research/fixtures/verified-poll-examples.json.
// RPM is overridden for the visual mockup; the recorded stationary RPM was 0.
// These are demo readings, not a live vehicle connection or inferred vehicle status.
export const DEMO_READINGS = {
  batterySocPct: 55.5,
  fuelPct: 24.705882352941178,
  rpm: 1500,
  outsideTempC: 4,
  coolantTempC: 34,
  batteryCurrentA: 1.3,
} as const
