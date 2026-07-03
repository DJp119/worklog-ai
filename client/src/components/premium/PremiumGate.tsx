import { useSubscription } from '../../context/SubscriptionContext'

interface PremiumGateProps {
  requiredTier: 'pro' | 'enterprise'
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PremiumGate({ requiredTier, children, fallback }: PremiumGateProps) {
  const { tier, loading } = useSubscription()
  const rankMap: Record<string, number> = { free: 0, pro: 1, enterprise: 2 }

  if (loading) return null

  if (rankMap[tier] >= rankMap[requiredTier]) {
    return <>{children}</>
  }

  if (fallback) return <>{fallback}</>

  return (
    <div className="glass-strong border border-indigo-500/20 rounded-2xl p-8 text-center space-y-4 max-w-lg mx-auto">
      <div className="inline-flex p-3 rounded-full bg-indigo-500/10 text-indigo-400">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-white">Feature Locked</h3>
      <p className="text-gray-400 text-sm">
        This feature requires the <span className="capitalize font-semibold text-indigo-300">{requiredTier}</span> plan.
        Upgrade your organization to get access.
      </p>
      <a
        href="/billing"
        className="inline-block px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-all"
      >
        View Pricing Plans
      </a>
    </div>
  )
}
