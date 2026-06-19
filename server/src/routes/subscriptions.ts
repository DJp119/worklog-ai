/**
 * server/src/routes/subscriptions.ts
 *
 * Subscription read endpoint (org member+) + Paddle webhook receiver.
 * Mounted at /api/subscriptions. The webhook is also mounted at
 * /api/webhooks/paddle via index.ts (raw-body capture configured there).
 *
 * SECURITY: the GET handler uses the per-request service-role client
 * (req.supabase) scoped by orgId, and requires org membership via
 * requireOrgRole('member'). The webhook handler is unauthenticated — it relies
 * entirely on HMAC signature verification of the raw request body.
 */

import { Router, type Request, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireOrgRole } from '../services/authz.js'
import { verifyPaddleSignature } from '../lib/paddle.js'
import { handlePaddleWebhook, clearTierCache } from '../services/subscriptionService.js'
import { supabase } from '../lib/database.js'
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

/**
 * POST /api/subscriptions/webhook — Paddle Billing webhook receiver.
 * Signature verified against the raw body (captured in index.ts).
 */
subscriptionRoutes.post('/webhook', async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody != null ? (req as any).rawBody.toString() : JSON.stringify(req.body)
  const sigHeader = req.headers['paddle-signature'] as string | undefined

  if (!verifyPaddleSignature(rawBody, sigHeader ?? '')) {
    return res.status(401).json({ success: false, error: 'Invalid signature verification' })
  }

  let event: any
  try {
    // rawBody was captured from the JSON stream; the parsed body may already be
    // available as req.body. If not, parse rawBody defensively.
    event = req.body ?? JSON.parse(rawBody)
  } catch {
    return res.status(400).json({ success: false, error: 'Malformed JSON body' })
  }

  const eventId = event.event_id
  if (!eventId) {
    return res.status(400).json({ success: false, error: 'Missing event_id' })
  }

  try {
    // Idempotency check — skip if this event was already processed.
    const { data: existing } = await supabase
      .from('paddle_events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle()

    if (existing) {
      return res.json({ success: true, message: 'Already processed' })
    }

    // Process webhook details.
    await handlePaddleWebhook(supabase, event)

    // Save event log for idempotency.
    await supabase.from('paddle_events').insert({
      id: eventId,
      event_type: event.event_type,
      payload: event,
    })

    return res.json({ success: true, message: 'Processed event' })
  } catch (err: any) {
    logger.with('err', err).with('eventId', eventId).error('Paddle webhook handling failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** Re-export for test/util use. */
export { clearTierCache }
