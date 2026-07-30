const PHONE_RE = /^\d{11}$/
const MAX_STORED_LEN = 255

/**
 * Normalize one or more 11-digit phones from free text / comma lists.
 * Stored form: "03001234567,03007654321"
 */
export function normalizeContactNumbers(raw, { fieldLabel = 'Contact' } = {}) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return { ok: false, error: `${fieldLabel} is required`, value: null }
  }

  const parts = text
    .split(/[,;\s|/]+/)
    .map((part) => String(part).replace(/\D/g, ''))
    .filter(Boolean)

  const numbers = []
  for (const part of parts) {
    if (PHONE_RE.test(part)) {
      numbers.push(part)
      continue
    }
    if (part.length > 11 && part.length % 11 === 0) {
      for (let i = 0; i < part.length; i += 11) {
        const chunk = part.slice(i, i + 11)
        if (!PHONE_RE.test(chunk)) {
          return {
            ok: false,
            error: `Each ${fieldLabel.toLowerCase()} number must be exactly 11 digits`,
            value: null,
          }
        }
        numbers.push(chunk)
      }
      continue
    }
    return {
      ok: false,
      error: `Each ${fieldLabel.toLowerCase()} number must be exactly 11 digits`,
      value: null,
    }
  }

  if (!numbers.length) {
    return { ok: false, error: `${fieldLabel} is required`, value: null }
  }

  const unique = []
  for (const n of numbers) {
    if (!unique.includes(n)) unique.push(n)
  }

  const value = unique.join(',')
  if (value.length > MAX_STORED_LEN) {
    return { ok: false, error: `Too many ${fieldLabel.toLowerCase()} numbers`, value: null }
  }

  return { ok: true, error: null, value }
}
