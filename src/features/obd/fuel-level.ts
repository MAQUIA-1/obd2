type FuelSample = { value: number; at: number }

const SMOOTHING_TIME_MS = 60_000

export function smoothFuelPct(value: number, at: number, previous: FuelSample | undefined, maxGapMs: number) {
  if (!previous || at - previous.at > maxGapMs) return value

  const elapsed = Math.max(0, at - previous.at)
  const weight = -Math.expm1(-elapsed / SMOOTHING_TIME_MS)
  return previous.value + (value - previous.value) * weight
}
