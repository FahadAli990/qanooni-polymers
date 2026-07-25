import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'

const RouteContext = createContext(null)

function sortByName(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}

export function RouteProvider({ children }) {
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
      const { data } = await api.get('/routes')
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
    const { data } = await api.post('/routes', { name })
    const created = data.data
    setItems((prev) => sortByName([...prev.filter((i) => i.id !== created.id), created]))
    return created
  }, [])

  const update = useCallback(async (slug, name) => {
    const { data } = await api.put(`/routes/${slug}`, { name })
    const updated = data.data
    setItems((prev) => sortByName([
      ...prev.filter((i) => i.id !== updated.id),
      updated,
    ]))
    return updated
  }, [])

  const remove = useCallback(async (slug) => {
    await api.delete(`/routes/${slug}`)
    setItems((prev) => prev.filter((i) => i.slug !== slug))
  }, [])

  const value = useMemo(
    () => ({ items, loading, refresh, create, update, remove }),
    [items, loading, refresh, create, update, remove],
  )

  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>
}

export function useRoutes() {
  const ctx = useContext(RouteContext)
  if (!ctx) throw new Error('useRoutes must be used within RouteProvider')
  return ctx
}
