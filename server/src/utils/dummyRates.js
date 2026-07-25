/** Temporary per-kg rates until real material prices exist. Stable by material id. */
const DUMMY_RATES = [185, 195, 210, 225, 240, 255, 270, 290]

export function dummyRatePerKg(materialId) {
  const id = Number(materialId)
  if (!Number.isInteger(id) || id <= 0) return DUMMY_RATES[0]
  return DUMMY_RATES[(id - 1) % DUMMY_RATES.length]
}
