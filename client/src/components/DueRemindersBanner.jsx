import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import './DueRemindersBanner.css'

const DISMISS_KEY = 'utility-due-reminders-dismissed'

function readDismissed() {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDismissed(ids) {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

function DueRemindersBanner() {
  const [reminders, setReminders] = useState([])
  const [dismissed, setDismissed] = useState(() => readDismissed())

  const loadReminders = useCallback(async () => {
    try {
      const { data } = await api.get('/utility/due-reminders')
      const list = Array.isArray(data.data?.reminders) ? data.data.reminders : []
      setReminders(list)
    } catch {
      setReminders([])
    }
  }, [])

  useEffect(() => {
    loadReminders()
    const timer = setInterval(loadReminders, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [loadReminders])

  const visible = reminders.filter((item) => !dismissed.includes(item.id))
  if (visible.length === 0) return null

  function dismissOne(id) {
    setDismissed((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id]
      writeDismissed(next)
      return next
    })
  }

  function dismissAll() {
    const ids = visible.map((item) => item.id)
    setDismissed((prev) => {
      const next = Array.from(new Set([...prev, ...ids]))
      writeDismissed(next)
      return next
    })
  }

  return (
    <aside className="due-reminders" aria-live="polite">
      <div className="due-reminders__head">
        <div>
          <strong className="due-reminders__title">Payment reminders</strong>
          <p className="due-reminders__sub">
            Unpaid bills due within 2 days (or already overdue)
          </p>
        </div>
        <div className="due-reminders__actions">
          <Link to="/utility-bills" className="btn-secondary btn-compact">
            Open Utility Bills
          </Link>
          <button type="button" className="btn-secondary btn-compact" onClick={dismissAll}>
            Dismiss all
          </button>
        </div>
      </div>
      <ul className="due-reminders__list">
        {visible.map((item) => (
          <li
            key={item.id}
            className={`due-reminders__item${item.overdue ? ' due-reminders__item--overdue' : ''}`}
          >
            <p>{item.message}</p>
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => dismissOne(item.id)}
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export default DueRemindersBanner
