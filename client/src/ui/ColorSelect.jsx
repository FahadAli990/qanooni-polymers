import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatNum } from '../utils/format'

function ColorSelect({ id, materials, value, onChange, required = false }) {
  const listId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => materials.find((m) => m.slug === value) || null,
    [materials, value],
  )

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="color-select" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="color-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <>
            <span className="material-card__swatch" style={{ backgroundColor: selected.swatch }} />
            <span className="color-select__label">
              {selected.name}
              <span className="color-select__meta"> · {formatNum(selected.totalKg)} kg available</span>
            </span>
          </>
        ) : (
          <span className="color-select__placeholder">Select color</span>
        )}
        <span className="color-select__caret" aria-hidden>▾</span>
      </button>

      {open && (
        <ul id={listId} className="color-select__menu" role="listbox">
          {materials.length === 0 ? (
            <li className="color-select__empty">No colors yet</li>
          ) : (
            materials.map((m) => (
              <li key={m.id} role="option" aria-selected={m.slug === value}>
                <button
                  type="button"
                  className={`color-select__option${m.slug === value ? ' color-select__option--active' : ''}`}
                  onClick={() => {
                    onChange(m.slug)
                    setOpen(false)
                  }}
                >
                  <span className="material-card__swatch" style={{ backgroundColor: m.swatch }} />
                  <span className="color-select__label">
                    {m.name}
                    <span className="color-select__meta"> · {formatNum(m.totalKg)} kg</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          className="color-select__required"
          value={value || ''}
          onChange={() => {}}
          required
        />
      )}
    </div>
  )
}

export default ColorSelect
