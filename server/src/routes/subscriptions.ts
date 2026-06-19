/**
 * server/src/routes/subscriptions.ts
 *
 * Subscription read endpoint (org member+).
 * Mounted at /api/subscriptions.
 *
 * SECURITY: the handler uses the per-request service-role client
 * (req.supabase) scoped by orgId, and requires org membership via
 * requireOrgRole('member').
 */

import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireOrgRole } from '../services/authz.js'
import { clearTierCache } from '../services/subscriptionService.js'
import { logger } from '../lib/logger.js'

export const subscriptionRoutes = Router()

/**
 * GET /api/subscriptions/:orgId — current subscription for the org.
 * Org member+ only.
 */
subscriptionRoutes.get('/:orgId', requireAuth, requireOrgRole('member'), async (req: AuthRequest, res) => {
  try {
    const { data, error } = await req.supabase!
      .from('subscriptions')
      .select('*')
      .eq('org_id', req.params.orgId)
      .maybeSingle()

    if (error) throw error
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET subscription failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** Re-export for test/util use. */
export { clearTierCache }
