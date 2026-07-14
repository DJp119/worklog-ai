import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'

/**
 * useHasOrg — returns true if the current user belongs to at least one
 * organization. Used by Layout to gate team/integrations nav items.
 */
export function useHasOrg(): boolean {
  const [hasOrg, setHasOrg] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiRequest<unknown[]>('/api/orgs')
      .then((rows) => {
        if (cancelled) return
        setHasOrg(Array.isArray(rows) && rows.length > 0)
      })
      .catch(() => {
        if (cancelled) return
        setHasOrg(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return hasOrg
}
