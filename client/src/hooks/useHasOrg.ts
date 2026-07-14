import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'

/**
 * useHasOrg — returns true if the current user belongs to at least one
 * organization. Used by Layout to gate team/integrations nav items.
 */
export function useHasOrg(enabled = true): boolean {
  const [hasOrg, setHasOrg] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setHasOrg(false)
      return
    }

    let cancelled = false
    apiRequest<unknown[]>('/api/orgs', { ignoreAuthRedirect: true })
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
  }, [enabled])

  return hasOrg
}
