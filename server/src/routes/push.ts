import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getVapidPublicKey, isPushConfigured } from '../lib/webPush.js'
import { logger } from '../lib/logger.js'

export const pushRoutes = Router()

/**
 * GET /api/push/vapid-public-key
 */
pushRoutes.get('/vapid-public-key', (req, res) => {
  if (!isPushConfigured) {
    return res.status(503).json({ success: false, error: 'Push notifications are not configured' })
  }
  res.json({ success: true, publicKey: getVapidPublicKey() })
})

/**
 * POST /api/push/subscribe
 */
pushRoutes.post('/subscribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!
    const subscription = req.body.subscription

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ success: false, error: 'Invalid subscription object' })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'endpoint' } // Upsert based on endpoint
      )

    if (error) {
      logger.error('Error saving push subscription: {}', error.message, error)
      return res.status(500).json({ success: false, error: 'Failed to save subscription' })
    }

    res.status(201).json({ success: true })
  } catch (error) {
    logger.error('Subscribe push error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /api/push/unsubscribe
 */
pushRoutes.post('/unsubscribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!
    const { endpoint } = req.body

    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'Missing endpoint' })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    if (error) {
      logger.error('Error deleting push subscription: {}', error.message, error)
      return res.status(500).json({ success: false, error: 'Failed to delete subscription' })
    }

    res.json({ success: true })
  } catch (error) {
    logger.error('Unsubscribe push error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
