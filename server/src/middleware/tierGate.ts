/**
 * server/src/middleware/tierGate.ts
 *
 * Subscription-tier and feature-gate middleware. Reads orgId ONLY from the URL
 * path param (`req.params.orgId`), matching the security model in authz.ts:
 * body and query are attacker-controlled and must not be trusted for
 * authorization. For routes that carry orgId in the body but not the path
 * (e.g. POST /api/goals), the route handler should call the subscription
 * service directly instead of using this middleware.
 */

import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { getOrgTier, isFeatureEnabled } from '../services/subscriptionService.js'
import type { Tier } from '../services/subscriptionService.js'

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, enterprise: 2 }

/** Resolve the orgId to gate on. Only the trusted URL path param is used. */
function resolveOrgId(req: AuthRequest): string | null {
  const orgId = req.params.orgId
  if (typeof orgId === 'string' && orgId.length > 0) return orgId
  return null
}

/**
 * Middleware: require at least the given tier for the org in :orgId.
 * Emits 403 with an upgradeUrl on insufficient tier.
 */
export function requireTier(minTier: 'pro' | 'enterprise') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.supabase) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
      const orgId = resolveOrgId(req)
      if (!orgId) {
        res.status(400).json({ success: false, error: 'orgId required in URL path' })
        return
      }

      const tier = await getOrgTier(req.supabase, orgId)
      if (TIER_RANK[tier] < TIER_RANK[minTier]) {
        res.status(403).json({
          success: false,
          error: `Feature requires upgrade. Minimum plan: ${minTier}`,
          upgradeUrl: '/billing',
        })
        return
      }
      next()
    } catch {
      res.status(500).json({ success: false, error: 'Billing authorization error' })
    }
  }
}

/**
 * Middleware: require the given feature be enabled for the org in :orgId.
 */
export function requireFeature(feature: 'goals' | 'integrations' | 'aiReports') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.supabase) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
      const orgId = resolveOrgId(req)
      if (!orgId) {
        res.status(400).json({ success: false, error: 'orgId required in URL path' })
        return
      }
      const enabled = await isFeatureEnabled(req.supabase, orgId, feature)
      if (!enabled) {
        res.status(403).json({ success: false, error: 'Feature is disabled on your plan.', upgradeUrl: '/billing' })
        return
      }
      next()
    } catch {
      res.status(500).json({ success: false, error: 'Authorization gate error' })
    }
  }
}
