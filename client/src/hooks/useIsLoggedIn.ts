import { useEffect, useState } from 'react'

/**
 * useIsLoggedIn — Lightweight check for whether a JWT exists in storage.
 * Used on the public landing page to swap the CTA copy without pulling in
 * the full AuthProvider (Supabase client, profile fetch, token refresh, etc.).
 */
export function useIsLoggedIn(): boolean {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const hasToken =
      typeof window !== 'undefined' &&
      (localStorage.getItem('accessToken') !== null ||
        sessionStorage.getItem('accessToken') !== null)
    setLoggedIn(hasToken)
  }, [])

  return loggedIn
}
