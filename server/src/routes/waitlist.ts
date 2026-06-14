import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { supabase } from '../lib/database.js'
import { isValidEmail } from '../lib/auth-utils.js'
import { captureEvent, captureException } from '../lib/posthog.js'
import { logger } from '../lib/logger.js'

export const waitlistRoutes = Router()

// Public endpoint — apply a dedicated limiter so anonymous submissions can't be
// abused to spam the table or enumerate.
const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * POST /api/waitlist
 * Capture an email for the Corporate Teams waitlist. Public, unauthenticated.
 * Idempotent: a duplicate email returns success without erroring.
 */
waitlistRoutes.post('/', waitlistLimiter, async (req: Request, res: Response) => {
  try {
    const { email, source } = req.body ?? {}

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'A valid email is required' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const safeSource = typeof source === 'string' ? source.slice(0, 64) : null

    const { error } = await supabase
      .from('waitlist')
      .insert({ email: normalizedEmail, source: safeSource })

    // 23505 = unique violation: the email is already on the list. Treat as success.
    if (error && error.code !== '23505') {
      logger.error('Waitlist insert error: {}', error.message, error)
      return res.status(500).json({ success: false, error: 'Failed to join the waitlist' })
    }

    if (!error) {
      captureEvent(normalizedEmail, 'waitlist_joined', { source: safeSource })
    }

    logger.info('Waitlist signup recorded')
    return res.status(201).json({ success: true, data: { ok: true } })
  } catch (error) {
    logger.error('Waitlist error: {}', error instanceof Error ? error.message : String(error), error)
    captureException(error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
