import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Subscription, SubscriptionTier } from 'shared'

interface SubscriptionContextProps {
  subscription: Subscription | null
  tier: SubscriptionTier
  isPremium: boolean
  isEnterprise: boolean
  loading: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextProps | undefined>(undefined)

export function SubscriptionProvider({ orgId, children }: { orgId: string | null; children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!orgId) {
      setSubscription(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const resp = await fetch(`/api/subscriptions/${orgId}`)
      const res = await resp.json()
      if (res.success) setSubscription(res.data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { refresh() }, [refresh])

  const tier = subscription?.tier || 'free'

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      tier,
      isPremium: ['pro', 'enterprise'].includes(tier),
      isEnterprise: tier === 'enterprise',
      loading,
      refresh,
    }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be wrapped in SubscriptionProvider')
  return ctx
}
