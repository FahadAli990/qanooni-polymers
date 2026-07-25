/** ISO `YYYY-MM-DD` → display `DD-MM-YYYY` */
export function formatDateDisplay(value) {
  const raw = String(value || '').slice(0, 10)
  const [y, m, d] = raw.split('-')
  if (!y || !m || !d) return String(value || '')
  return `${d}-${m}-${y}`
}

export function formatNum(value, maxFractionDigits = 2) {
  const n = Number(value || 0)
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits })
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
