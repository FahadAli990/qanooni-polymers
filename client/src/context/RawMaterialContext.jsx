import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'

const RawMaterialContext = createContext(null)

function sortByName(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}

export function RawMaterialProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get('/raw-materials')
      setItems(data.data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (name) => {
    const { data } = await api.post('/raw-materials', { name })
    const created = data.data
    setItems((prev) => sortByName([...prev.filter((i) => i.id !== created.id), created]))
    return created
  }, [])

  const update = useCallback(async (slug, name) => {
    const { data } = await api.put(`/raw-materials/${slug}`, { name })
    const updated = data.data
    setItems((prev) => sortByName([
      ...prev.filter((i) => i.id !== updated.id),
      updated,
    ]))
    return updated
  }, [])

  const remove = useCallback(async (slug) => {
    await api.delete(`/raw-materials/${slug}`)
    setItems((prev) => prev.filter((i) => i.slug !== slug))
  }, [])

  const value = useMemo(
    () => ({ items, loading, refresh, create, update, remove }),
    [items, loading, refresh, create, update, remove],
  )

  return <RawMaterialContext.Provider value={value}>{children}</RawMaterialContext.Provider>
}

export function useRawMaterials() {
  const ctx = useContext(RawMaterialContext)
  if (!ctx) throw new Error('useRawMaterials must be used within RawMaterialProvider')
  return ctx
}
