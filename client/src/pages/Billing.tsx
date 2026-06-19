import { useEffect, useState } from 'react'
import { listMyOrgs, type MyOrgRow } from '../lib/teamsApi'
import { apiRequest } from '../lib/api'
import { SubscriptionProvider, useSubscription } from '../context/SubscriptionContext'
import { PaddleCheckoutButton } from '../components/premium/PaddleCheckout'
import { useAuth } from '../context/AuthContext'
import type { OrgMember } from 'shared'

const PRICE_IDS: Record<string, string> = {
  pro: import.meta.env.VITE_PADDLE_PRO_PRICE_ID || '',
  enterprise: import.meta.env.VITE_PADDLE_ENTERPRISE_PRICE_ID || '',
}

const TIER_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' }
const TIER_DESCRIPTIONS: Record<string, string> = {
  free: 'For solo users. 1 member, no integrations, no goals.',
  pro: 'For growing teams. Up to 25 members, integrations, goals.',
  enterprise: 'For organizations. Unlimited members, AI reports, everything.',
}

function BillingInner() {
  const { user } = useAuth()
  const { subscription, tier, isPremium, isEnterprise, loading, refresh } = useSubscription()
  const [org, setOrg] = useState<MyOrgRow | null>(null)
  const [orgRole, setOrgRole] = useState<string | null>(null)

  useEffect(() => {
    listMyOrgs().then((list) => {
      if (list.length > 0) {
        setOrg(list[0])
        loadOrgRole(list[0].org_id)
      }
    })
  }, [])

  async function loadOrgRole(orgId: string) {
    try {
      const members = await apiRequest<OrgMember[]>(`/api/orgs/${orgId}/members`)
      const me = members.find((m) => m.user_id === user?.id)
      if (me) setOrgRole(me.role)
    } catch {
      // ignore
    }
  }

  const handleUpgradeSuccess = () => {
    refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Billing & Plan</h1>
        <p className="text-gray-400 mt-1">Manage your organization subscription</p>
      </div>

      {org && (
        <div className="glass-strong border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Current Plan</h2>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-indigo-400">{TIER_LABELS[tier]}</span>
              <p className="text-gray-400 text-sm mt-1">{TIER_DESCRIPTIONS[tier]}</p>
            </div>
            {subscription && (
              <div className="text-right text-sm text-gray-400">
                {subscription.current_period_end && (
                  <p>Renewal: {new Date(subscription.current_period_end).toLocaleDateString()}</p>
                )}
                <p>Status: <span className="capitalize">{subscription.status}</span></p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {['free', 'pro', 'enterprise'].map((planTier) => {
          const isCurrent = tier === planTier
          const isUpgrade = planTier === 'pro' && !isPremium
            || planTier === 'enterprise' && !isEnterprise
          return (
            <div
              key={planTier}
              className={`glass-strong border rounded-2xl p-6 space-y-4 ${
                isCurrent ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-gray-800'
              }`}
            >
              <h3 className="text-xl font-bold text-white">{TIER_LABELS[planTier]}</h3>
              <p className="text-gray-400 text-sm">{TIER_DESCRIPTIONS[planTier]}</p>
              {isCurrent && (
                <span className="inline-block px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">
                  Current Plan
                </span>
              )}
              {isUpgrade && org && orgRole && ['admin', 'owner'].includes(orgRole) && PRICE_IDS[planTier] && (
                <PaddleCheckoutButton
                  orgId={org.org_id}
                  priceId={PRICE_IDS[planTier]}
                  userEmail={user?.email || ''}
                  onSuccess={handleUpgradeSuccess}
                  label={`Upgrade to ${TIER_LABELS[planTier]}`}
                />
              )}
              {isUpgrade && orgRole && !['admin', 'owner'].includes(orgRole) && (
                <p className="text-xs text-gray-500">Contact an org admin to upgrade</p>
              )}
            </div>
          )
        })}
      </div>

      {subscription && (
        <div className="glass-strong border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Usage</h2>
          <div className="text-gray-400 text-sm">
            {subscription.max_members != null ? (
              <p>Member limit: up to {subscription.max_members} members</p>
            ) : (
              <p>Members: Unlimited</p>
            )}
            <p>AI Reports: {subscription.ai_reports_enabled ? 'Enabled' : 'Not available on your plan'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Billing() {
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)

  useEffect(() => {
    listMyOrgs().then((list) => {
      if (list.length > 0) setActiveOrgId(list[0].org_id)
    })
  }, [])

  return (
    <SubscriptionProvider orgId={activeOrgId}>
      <BillingInner />
    </SubscriptionProvider>
  )
}
