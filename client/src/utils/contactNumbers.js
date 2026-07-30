const PHONE_RE = /^\d{11}$/

/** Parse stored / typed contact into unique 11-digit numbers (order kept). */
export function parseContactNumbers(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return []

  const parts = text
    .split(/[,;\s|/]+/)
    .map((part) => String(part).replace(/\D/g, ''))
    .filter(Boolean)

  const numbers = []
  for (const part of parts) {
    if (PHONE_RE.test(part)) {
      if (!numbers.includes(part)) numbers.push(part)
      continue
    }
    if (part.length > 11 && part.length % 11 === 0) {
      for (let i = 0; i < part.length; i += 11) {
        const chunk = part.slice(i, i + 11)
        if (PHONE_RE.test(chunk) && !numbers.includes(chunk)) numbers.push(chunk)
      }
    }
  }
  return numbers
}

export function serializeContactNumbers(numbers) {
  return (Array.isArray(numbers) ? numbers : [])
    .map((n) => String(n).replace(/\D/g, ''))
    .filter((n) => PHONE_RE.test(n))
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .join(',')
}

/** Validate stored value; returns error string or null. */
export function validateContactNumbers(raw, { fieldLabel = 'Contact' } = {}) {
  const numbers = parseContactNumbers(raw)
  if (!numbers.length) return `${fieldLabel} is required`
  const allDigits = String(raw || '').replace(/\D/g, '')
  if (allDigits !== numbers.join('')) {
    return `Each ${fieldLabel.toLowerCase()} number must be exactly 11 digits`
  }
  return null
}

export function formatContactDisplay(raw) {
  const numbers = parseContactNumbers(raw)
  if (!numbers.length) return String(raw || '—')
  return numbers.join(' · ')
}

export function digitsOnlyMax11(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
}
