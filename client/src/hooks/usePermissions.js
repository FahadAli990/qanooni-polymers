import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

/** Central RBAC flags for UI. Server still enforces the same rules. */
export function usePermissions() {
  const { user } = useAuth()
  return useMemo(() => {
    const role = user?.role === 'manager' ? 'manager' : user ? 'admin' : null
    const isAdmin = role === 'admin'
    const isManager = role === 'manager'
    return {
      role,
      isAdmin,
      isManager,
      canCreate: Boolean(user),
      canEdit: isAdmin,
      canDelete: isAdmin,
      canManageUsers: isAdmin,
    }
  }, [user])
}
