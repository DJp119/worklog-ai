import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import type { TeamRole } from 'shared'

/**
 * useTeamRole — Resolves the current user's role on a given team.
 * Returns { role, loading, error }. Returns null role when the user is
 * not a member of the team (or the team does not exist).
 *
 * Used by TeamGoals.tsx and any team-scoped UI to gate write actions.
 * Server still re-validates via requireTeamRole middleware; this hook is
 * purely for UX (hiding controls the user can't use).
 */
export function useTeamRole(teamId: string | null | undefined): {
  role: TeamRole | null
  loading: boolean
  error: string | null
} {
  const [role, setRole] = useState<TeamRole | null>(null)
  const [loading, setLoading] = useState<boolean>(!!teamId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!teamId) {
      setRole(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    apiRequest<{ role: TeamRole | null }>(`/api/teams/${teamId}/my-role`)
      .then((resp) => {
        if (cancelled) return
        setRole(resp?.role ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message ?? 'Failed to load team role')
        setRole(null)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  return { role, loading, error }
}
