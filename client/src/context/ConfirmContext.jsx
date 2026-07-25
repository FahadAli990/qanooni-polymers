import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)

  const close = useCallback((result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setDialog(null)
  }, [])

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string'
      ? { message: options }
      : options || {}

    return new Promise((resolve) => {
      if (resolverRef.current) resolverRef.current(false)
      resolverRef.current = resolve
      setDialog({
        title: opts.title || 'Confirm delete',
        message: opts.message || 'Are you sure you want to delete this?',
        confirmLabel: opts.confirmLabel || 'Delete',
        cancelLabel: opts.cancelLabel || 'Cancel',
      })
    })
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog && (
        <div className="confirm-overlay" role="presentation" onClick={() => close(false)}>
          <div
            className="confirm-dialog card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title">{dialog.title}</h2>
            <p id="confirm-message">{dialog.message}</p>
            <div className="confirm-dialog__actions">
              <button type="button" className="btn-secondary" onClick={() => close(false)}>
                {dialog.cancelLabel}
              </button>
              <button type="button" className="btn-danger" onClick={() => close(true)} autoFocus>
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
