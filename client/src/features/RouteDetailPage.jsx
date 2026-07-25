import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'

const CONTACT_RE = /^\d{11}$/

function emptyForm() {
  return {
    shopName: '',
    address: '',
    ownerName: '',
    contactNumber: '',
  }
}

function RouteDetailPage() {
  const { slug } = useParams()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [route, setRoute] = useState(null)
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/routes/${slug}/customers`)
      const payload = data.data
      setRoute(payload.route)
      setItems(payload.items || [])
    } catch (err) {
      setRoute(null)
      setItems([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [slug, showToast])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm())
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setForm({
      shopName: item.shopName,
      address: item.address,
      ownerName: item.ownerName,
      contactNumber: item.contactNumber,
    })
    setShowForm(true)
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onContactChange(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
    setField('contactNumber', digits)
  }

  function validateClient() {
    const shopName = form.shopName.trim()
    const address = form.address.trim()
    const ownerName = form.ownerName.trim()
    const contactNumber = form.contactNumber.trim()

    if (!shopName || !address || !ownerName || !contactNumber) {
      return 'All fields are required'
    }
    if (!CONTACT_RE.test(contactNumber)) {
      return 'Contact number must be exactly 11 digits'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const clientError = validateClient()
    if (clientError) {
      showToast(clientError, 'error')
      return
    }

    setSaving(true)
    try {
      const body = {
        shopName: form.shopName.trim(),
        address: form.address.trim(),
        ownerName: form.ownerName.trim(),
        contactNumber: form.contactNumber.trim(),
      }
      if (editingId) {
        const { data } = await api.put(`/routes/${slug}/customers/${editingId}`, body)
        const item = data.data.item
        setItems((prev) => prev.map((row) => (row.id === editingId ? item : row)))
        showToast('Customer updated')
      } else {
        const { data } = await api.post(`/routes/${slug}/customers`, body)
        setItems((prev) => [...prev, data.data.item])
        showToast('Customer added')
      }
      closeForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: 'Delete customer',
      message: `Delete customer "${item.shopName}"? This cannot be undone.`,
    })
    if (!ok) return
    try {
      await api.delete(`/routes/${slug}/customers/${item.id}`)
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      if (editingId === item.id) closeForm()
      showToast('Customer deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <p className="help-muted">Loading customers…</p>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="page-shell">
        <p className="help-muted">Route not found.</p>
      </div>
    )
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>{route.name}</h1>
          <p>Customers on this route — shop, address, owner & contact.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
        >
          {showForm && !editingId ? 'Cancel' : 'Add Customer'}
        </button>
      </header>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label htmlFor="customer-shop">Shop Name</label>
              <input
                id="customer-shop"
                type="text"
                value={form.shopName}
                onChange={(e) => setField('shopName', e.target.value)}
                placeholder="Shop name"
                required
                maxLength={160}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="customer-address">Address</label>
              <input
                id="customer-address"
                type="text"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Full address"
                required
                maxLength={255}
              />
            </div>
            <div>
              <label htmlFor="customer-owner">Owner Name</label>
              <input
                id="customer-owner"
                type="text"
                value={form.ownerName}
                onChange={(e) => setField('ownerName', e.target.value)}
                placeholder="Owner name"
                required
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="customer-contact">Contact Number</label>
              <input
                id="customer-contact"
                type="tel"
                inputMode="numeric"
                pattern="\d{11}"
                value={form.contactNumber}
                onChange={(e) => onContactChange(e.target.value)}
                placeholder="03XXXXXXXXX"
                required
                maxLength={11}
                title="Exactly 11 digits"
              />
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Customer' : 'Save Customer'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="stock-table-wrap card">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Shop Name</th>
              <th>Address</th>
              <th>Owner Name</th>
              <th>Contact Number</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="stock-table__empty">
                  No customers yet. Click Add Customer to add the first one.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.shopName}</td>
                  <td>{item.address}</td>
                  <td>{item.ownerName}</td>
                  <td>{item.contactNumber}</td>
                  <td className="stock-table__actions">
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-compact"
                      onClick={() => handleDelete(item)}
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

export default RouteDetailPage
