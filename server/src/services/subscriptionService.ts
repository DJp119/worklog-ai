/**
 * server/src/services/subscriptionService.ts
 *
 * Subscription tier resolution, feature gating, member-limit checks, and
 * integration channel preferences. All enforcement in Node via the service-role
 * Supabase client (RLS is defense-in-depth; service role bypasses it). Reads
 * are scoped by orgId.
 *
 * Pricing tiers and limits:
 *   free:        1 member (temp: all features enabled)
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
  free: { goals: true, integrations: true, aiReports: false },
  pro: { goals: true, integrations: true, aiReports: false },
  enterprise: { goals: true, integrations: true, aiReports: true },
}

export type Feature = 'goals' | 'integrations' | 'aiReports'

/** Per-tier member cap; null means unlimited (enterprise). */
const MAX_MEMBERS: Record<Tier, number | null> = { free: 1, pro: 25, enterprise: null }

/** Clear the in-memory tier cache for an org (call after a subscription change). */
export function clearTierCache(orgId: string): void {
  tierCache.delete(orgId)
}

/**
 * Fetch the user's channel preference sync filters (repo filter for GitHub,
 * project keys for Jira). Returns null if no preference row exists.
 */
export async function getUserSyncFilters(
  db: SupabaseClient,
  userId: string,
  provider: 'github' | 'jira'
): Promise<Record<string, any> | null> {
  const { data, error } = await db
    .from('integration_channel_preferences')
    .select('channel_config')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('channel_type', 'sync')
    .maybeSingle()

  if (error || !data) return null
  return data.channel_config as Record<string, any>
}

/**
 * Fetch the Slack notification channel preferences for a team.
 * Returns the list of channel IDs to notify, or an empty array.
 */
export async function getTeamSlackChannels(
  db: SupabaseClient,
  orgId: string,
  teamId: string
): Promise<string[]> {
  const { data, error } = await db
    .from('integration_channel_preferences')
    .select('channel_config')
    .eq('org_id', orgId)
    .eq('team_id', teamId)
    .eq('provider', 'slack')
    .eq('channel_type', 'notification')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return []
  const cfg = data.channel_config as { channel_ids?: string[] } | null
  return cfg?.channel_ids ?? []
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


