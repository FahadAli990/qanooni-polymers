import { useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  digitsOnlyMax11,
  parseContactNumbers,
  serializeContactNumbers,
} from '../utils/contactNumbers'
import './PhoneNumbersField.css'

function focusNextControl(fromEl) {
  const form = fromEl?.closest?.('form')
  if (!form) return
  const focusable = Array.from(
    form.querySelectorAll(
      'input:not([disabled]):not([type="hidden"]):not(.phone-numbers-field__required-mirror), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    ),
  ).filter((el) => el.offsetParent !== null || el === fromEl)

  const idx = focusable.indexOf(fromEl)
  if (idx < 0) return
  const next = focusable[idx + 1]
  if (next) next.focus()
}

/**
 * Multi phone input: type 11 digits + Enter to add another.
 * Empty Enter moves focus to the next form control.
 */
function PhoneNumbersField({
  id,
  label = 'Contact',
  value = '',
  onChange,
  required = true,
  disabled = false,
  placeholder = '11 digits, Enter for next number',
}) {
  const autoId = useId()
  const inputId = id || autoId
  const inputRef = useRef(null)
  const draftRef = useRef('')
  const numbersRef = useRef([])
  const [draft, setDraft] = useState('')
  const numbers = parseContactNumbers(value)
  numbersRef.current = numbers

  useEffect(() => {
    setDraft('')
    draftRef.current = ''
  }, [value])

  function setDraftValue(next) {
    draftRef.current = next
    setDraft(next)
  }

  function emit(nextNumbers) {
    onChange?.(serializeContactNumbers(nextNumbers))
  }

  function addDigits(digits, baseNumbers = numbersRef.current) {
    if (digits.length !== 11) return false
    const next = baseNumbers.includes(digits) ? baseNumbers : [...baseNumbers, digits]
    emit(next)
    setDraftValue('')
    return true
  }

  function removeNumber(phone) {
    emit(numbers.filter((n) => n !== phone))
  }

  useEffect(() => {
    const input = inputRef.current
    const form = input?.closest('form')
    if (!form) return undefined

    function onSubmitCapture(e) {
      const digits = digitsOnlyMax11(draftRef.current)
      if (digits.length > 0 && digits.length < 11) {
        e.preventDefault()
        e.stopPropagation()
        input.setCustomValidity('Each number must be exactly 11 digits')
        input.reportValidity()
        input.setCustomValidity('')
        input.focus()
        return
      }
      if (digits.length === 11) {
        flushSync(() => {
          addDigits(digits, numbersRef.current)
        })
      }
    }

    form.addEventListener('submit', onSubmitCapture, true)
    return () => form.removeEventListener('submit', onSubmitCapture, true)
  }, [onChange])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const digits = digitsOnlyMax11(draft)
      if (!digits) {
        focusNextControl(e.currentTarget)
        return
      }
      if (digits.length === 11) {
        addDigits(digits)
        return
      }
      e.currentTarget.setCustomValidity('Each number must be exactly 11 digits')
      e.currentTarget.reportValidity()
      e.currentTarget.setCustomValidity('')
      return
    }

    if (e.key === 'Backspace' && !draft && numbers.length) {
      e.preventDefault()
      emit(numbers.slice(0, -1))
    }

    if (e.key === ',' || e.key === ';' || e.key === ' ') {
      const digits = digitsOnlyMax11(draft)
      if (digits.length === 11) {
        e.preventDefault()
        addDigits(digits)
      }
    }
  }

  function handleBlur() {
    const digits = digitsOnlyMax11(draft)
    if (digits.length === 11) addDigits(digits)
  }

  function handleChange(e) {
    setDraftValue(digitsOnlyMax11(e.target.value))
  }

  const hasValue = numbers.length > 0 || digitsOnlyMax11(draft).length === 11

  return (
    <div className="phone-numbers-field">
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <div
        className={`phone-numbers-field__box${disabled ? ' phone-numbers-field__box--disabled' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {numbers.map((phone) => (
          <span key={phone} className="phone-numbers-field__chip">
            {phone}
            {!disabled && (
              <button
                type="button"
                className="phone-numbers-field__chip-remove"
                aria-label={`Remove ${phone}`}
                onClick={(e) => {
                  e.stopPropagation()
                  removeNumber(phone)
                }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          type="tel"
          inputMode="numeric"
          className="phone-numbers-field__input"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={numbers.length ? 'Next number…' : placeholder}
          disabled={disabled}
          maxLength={11}
          aria-required={required}
          title="Type 11 digits, then Enter to add another. Empty Enter goes to next field."
        />
      </div>
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          className="phone-numbers-field__required-mirror"
          value={hasValue ? 'ok' : ''}
          required
          onChange={() => {}}
        />
      )}
    </div>
  )
}

export default PhoneNumbersField
