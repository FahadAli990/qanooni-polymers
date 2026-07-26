import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateDisplay } from '../utils/format'

function emptyForm() {
  return { username: '', password: '' }
}

function ManagersPage() {
  const { isAdmin } = useAuth()
  const { canManageUsers } = usePermissions()
  const { confirm } = useConfirm()
  const { showToast } = useToast()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [resetId, setResetId] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/managers')
      setItems(Array.isArray(data.data) ? data.data : [])
    } catch (err) {
      setItems([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (canManageUsers) load()
  }, [canManageUsers, load])

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  async function handleCreate(e) {
    e.preventDefault()
    const username = form.username.trim()
    const password = form.password
    if (username.length < 3) {
      showToast('Username must be at least 3 characters', 'error')
      return
    }
    if (password.length < 4) {
      showToast('Password must be at least 4 characters', 'error')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post('/managers', { username, password })
      setItems((prev) => [...prev, data.data])
      setForm(emptyForm())
      setShowForm(false)
      showToast('Manager created')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    if (resetPassword.length < 4) {
      showToast('Password must be at least 4 characters', 'error')
      return
    }
    setResetting(true)
    try {
      await api.put(`/managers/${resetId}/password`, { password: resetPassword })
      setResetId(null)
      setResetPassword('')
      showToast('Password updated')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setResetting(false)
    }
  }

  async function handleToggleActive(row) {
    try {
      const { data } = await api.put(`/managers/${row.id}/active`, { active: !row.active })
      setItems((prev) => prev.map((m) => (m.id === row.id ? data.data : m)))
      showToast(row.active ? 'Manager deactivated' : 'Manager activated')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  async function handleDelete(row) {
    const ok = await confirm({
      title: 'Delete manager',
      message: `Delete manager "${row.username}"? They will no longer be able to log in.`,
    })
    if (!ok) return
    try {
      await api.delete(`/managers/${row.id}`)
      setItems((prev) => prev.filter((m) => m.id !== row.id))
      if (resetId === row.id) {
        setResetId(null)
        setResetPassword('')
      }
      showToast('Manager deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Managers</h1>
          <p>
            Admin yahan manager accounts bana sakta hai. Manager login ke baad sirf naya record{' '}
            <strong>add</strong> kar sakta hai — edit / delete bilkul nahi.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setShowForm((v) => !v)
            setForm(emptyForm())
          }}
        >
          {showForm ? 'Cancel' : 'Add Manager'}
        </button>
      </header>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleCreate}>
          <div className="form-grid form-grid--order">
            <div>
              <label htmlFor="mgr-username">Username</label>
              <input
                id="mgr-username"
                type="text"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                required
                minLength={3}
                maxLength={80}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="mgr-password">Password</label>
              <input
                id="mgr-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                required
                minLength={4}
              />
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Manager'}
            </button>
          </div>
        </form>
      )}

      {resetId && (
        <form className="card panel-form panel-form--stock" onSubmit={handleResetPassword}>
          <div className="form-grid form-grid--order">
            <div>
              <label htmlFor="mgr-reset-password">New password</label>
              <input
                id="mgr-reset-password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
                minLength={4}
                autoFocus
              />
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={resetting}>
              {resetting ? 'Saving…' : 'Update Password'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setResetId(null)
                setResetPassword('')
              }}
              disabled={resetting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="stock-table-wrap card">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Status</th>
              <th>Created</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="stock-table__empty">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="stock-table__empty">
                  No managers yet. Click Add Manager.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>{row.username}</td>
                  <td>
                    <span className={`status-pill status-pill--${row.active ? 'paid' : 'unpaid'}`}>
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{row.createdAt ? formatDateDisplay(String(row.createdAt).slice(0, 10)) : '—'}</td>
                  <td className="stock-table__actions">
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => {
                        setResetId(row.id)
                        setResetPassword('')
                      }}
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => handleToggleActive(row)}
                    >
                      {row.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-compact"
                      onClick={() => handleDelete(row)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ManagersPage
