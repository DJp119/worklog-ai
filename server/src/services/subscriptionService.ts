/**
 * server/src/services/subscriptionService.ts
 *
 * Subscription tier resolution, feature gating, member-limit checks, and Paddle
 * webhook reconciliation. All enforcement in Node via the service-role Supabase
 * client (RLS is defense-in-depth; service role bypasses it). Reads are scoped
 * by orgId.
 *
 * Pricing tiers and limits (per the approved plan):
 *   free:        1 member, no goals, no integrations, no AI reports
 *   pro:         25 members, goals + integrations, no AI reports
 *   enterprise:  unlimited members, goals + integrations + AI reports
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../lib/logger.js'

export type Tier = 'free' | 'pro' | 'enterprise'

// Simple 60-second in-memory tier cache. Webhook reconciliation and explicit
// refresh both clear the entry for the affected org.
const tierCache = new Map<string, { tier: Tier, expires: number }>()
const TIER_CACHE_TTL_MS = 60_000

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

const FEATURE_GATES: Record<Tier, { goals: boolean, integrations: boolean, aiReports: boolean }> = {
  free: { goals: false, integrations: false, aiReports: false },
  pro: { goals: true, integrations: true, aiReports: false },
  enterprise: { goals: true, integrations: true, aiReports: true },
}

export type Feature = 'goals' | 'integrations' | 'aiReports'

/** Map a Paddle Price ID to a tier via env-configured price IDs. */
export function resolveTierFromPriceId(priceId: string | null | undefined): Tier {
  if (!priceId) return 'free'
  if (priceId === process.env.PADDLE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.PADDLE_ENTERPRISE_PRICE_ID) return 'enterprise'
  return 'free'
}

/** Map a Paddle subscription status to our DB enum (subscription_status). */
export function mapPaddleStatus(paddleStatus: string | null | undefined): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    paused: 'paused',
    canceled: 'canceled',
    unpaid: 'unpaid',
  }
  return statusMap[paddleStatus ?? ''] || 'canceled'
}

/** Per-tier member cap; null means unlimited (enterprise). */
const MAX_MEMBERS: Record<Tier, number | null> = { free: 1, pro: 25, enterprise: null }

/** Clear the in-memory tier cache for an org (call after a subscription change). */
export function clearTierCache(orgId: string): void {
  tierCache.delete(orgId)
}

/**
 * Resolve the effective tier for an org. A subscription row whose status is not
 * active/trialing is downgraded to 'free' (treats inactive billing as free).
 */
export async function getOrgTier(db: SupabaseClient, orgId: string): Promise<Tier> {
  const cached = tierCache.get(orgId)
  if (cached && cached.expires > Date.now()) {
    return cached.tier
  }

  const { data, error } = await db
    .from('subscriptions')
    .select('tier, status')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error || !data) {
    // Fail-open to free — a missing/erroring subscription row never grants
    // paid features. Logged for visibility but treated as free.
    if (error) logger.with('err', error).with('orgId', orgId).warn('subscription lookup failed; defaulting to free')
    tierCache.set(orgId, { tier: 'free', expires: Date.now() + TIER_CACHE_TTL_MS })
    return 'free'
  }

  const tier: Tier = ACTIVE_STATUSES.has(data.status) ? (data.tier as Tier) : 'free'
  tierCache.set(orgId, { tier, expires: Date.now() + TIER_CACHE_TTL_MS })
  return tier
}

/** Whether a feature is enabled for the org's current tier. */
export async function isFeatureEnabled(db: SupabaseClient, orgId: string, feature: Feature): Promise<boolean> {
  const tier = await getOrgTier(db, orgId)
  return FEATURE_GATES[tier][feature]
}

/**
 * Check whether the org may add another member. Returns the current count, the
 * tier cap (null = unlimited), and whether another member is allowed.
 */
export async function checkMemberLimit(
  db: SupabaseClient,
  orgId: string
): Promise<{ allowed: boolean, current: number, max: number | null }> {
  const tier = await getOrgTier(db, orgId)
  const max = MAX_MEMBERS[tier]

  const { count, error } = await db
    .from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (error) throw error
  const current = count || 0

  return {
    allowed: max === null || current < max,
    current,
    max,
  }
}

interface PaddleEvent {
  event_id?: string
  event_type?: string
  data?: any
}

/**
 * Reconcile a signed Paddle webhook event into the subscriptions table.
 * Processes subscription.created / .updated / .canceled; ignores other types.
 * The route layer is responsible for idempotency (paddle_events log) before
 * calling this.
 */
export async function handlePaddleWebhook(db: SupabaseClient, event: PaddleEvent): Promise<void> {
  const eventType = event.event_type
  const payload = event.data ?? {}

  if (!['subscription.created', 'subscription.updated', 'subscription.canceled'].includes(eventType ?? '')) {
    return
  }

  const paddleSubId = payload.id
  const customData = payload.custom_data || {}
  const orgId = customData.orgId

  if (!orgId) {
    logger.with('eventId', event.event_id).warn('Paddle webhook missing orgId custom_data; cannot process')
    return
  }

  // Resolve tier from Price ID / Product ID in payload
  const priceId = payload.items?.[0]?.price?.id ?? null
  const tier = resolveTierFromPriceId(priceId)
  const status = mapPaddleStatus(payload.status)

  const currentPeriodStart = payload.current_billing_period?.starts_at ?? null
  const currentPeriodEnd = payload.current_billing_period?.ends_at ?? null

  const { error } = await db
    .from('subscriptions')
    .upsert({
      org_id: orgId,
      tier,
      status,
      paddle_subscription_id: paddleSubId,
      paddle_customer_id: payload.customer_id ?? null,
      paddle_price_id: priceId,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      max_members: MAX_MEMBERS[tier],
      ai_reports_enabled: tier === 'enterprise',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })

  if (error) {
    throw new Error(`Failed to update subscription for org ${orgId}: ${error.message}`)
  }

  // Clear tier cache so the new tier is visible immediately.
  clearTierCache(orgId)
}
