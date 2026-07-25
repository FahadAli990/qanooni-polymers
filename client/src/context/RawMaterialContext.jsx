import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'

const RawMaterialContext = createContext(null)

function sortById(list) {
  return [...list].sort((a, b) => Number(a.id) - Number(b.id))
}

function emptyTotals() {
  return { totalBags: 0, totalKg: 0, kgPerBag: 40 }
}

function normalizeItem(item) {
  return {
    ...item,
    totalBags: Number(item.totalBags || 0),
    totalKg: Number(item.totalKg || 0),
  }
}

function computeTotals(list) {
  const totals = list.reduce(
    (acc, item) => ({
      totalBags: acc.totalBags + Number(item.totalBags || 0),
      totalKg: acc.totalKg + Number(item.totalKg || 0),
    }),
    { totalBags: 0, totalKg: 0 },
  )
  return {
    totalBags: Number(totals.totalBags.toFixed(2)),
    totalKg: Number(totals.totalKg.toFixed(2)),
    kgPerBag: 40,
  }
}

export function RawMaterialProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState(emptyTotals)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([])
      setTotals(emptyTotals())
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get('/raw-materials')
      const payload = data.data
      const list = (Array.isArray(payload) ? payload : payload?.items || []).map(normalizeItem)
      setItems(list)
      setTotals(payload?.totals ? { ...emptyTotals(), ...payload.totals } : computeTotals(list))
    } catch {
      setItems([])
      setTotals(emptyTotals())
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (name) => {
    const { data } = await api.post('/raw-materials', { name })
    const created = normalizeItem(data.data)
    setItems((prev) => {
      const next = sortById([...prev.filter((i) => i.id !== created.id), created])
      setTotals(computeTotals(next))
      return next
    })
    return created
  }, [])

  const update = useCallback(async (slug, name) => {
    const { data } = await api.put(`/raw-materials/${slug}`, { name })
    const updated = normalizeItem(data.data)
    setItems((prev) => {
      const next = sortById([...prev.filter((i) => i.id !== updated.id), updated])
      setTotals(computeTotals(next))
      return next
    })
    return updated
  }, [])

  const remove = useCallback(async (slug) => {
    await api.delete(`/raw-materials/${slug}`)
    setItems((prev) => {
      const next = prev.filter((i) => i.slug !== slug)
      setTotals(computeTotals(next))
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ items, totals, loading, refresh, create, update, remove }),
    [items, totals, loading, refresh, create, update, remove],
  )

  return <RawMaterialContext.Provider value={value}>{children}</RawMaterialContext.Provider>
}

export function useRawMaterials() {
  const ctx = useContext(RawMaterialContext)
  if (!ctx) throw new Error('useRawMaterials must be used within RawMaterialProvider')
  return ctx
}
