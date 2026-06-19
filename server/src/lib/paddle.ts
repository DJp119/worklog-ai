/**
 * server/src/lib/paddle.ts
 *
 * Paddle Billing (v2) webhook signature verification and read-only API helper.
 *
 * Paddle Billing sends HMAC-SHA256 signatures in the `Paddle-Signature` header
 * formatted as `t=TIMESTAMP;h1=SIGNATURE`. The signed payload is
 * `${timestamp}:${rawBody}`. See:
 * https://developer.paddle.com/webhooks/overview
 *
 * This module is read-only against Paddle's API (no subscription mutations are
 * initiated from the backend — checkouts are launched client-side via Paddle.js,
 * and subscription state is reconciled from signed webhooks).
 */

import crypto from 'crypto'
import { logger } from './logger.js'

const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || ''
const PADDLE_API_KEY = process.env.PADDLE_API_KEY || ''
const PADDLE_API_URL = process.env.PADDLE_ENVIRONMENT === 'sandbox'
  ? 'https://sandbox-api.paddle.com'
  : 'https://api.paddle.com'

if (!PADDLE_WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
  logger.error('Missing PADDLE_WEBHOOK_SECRET env variable!')
}

/**
 * Verifies the signature of an incoming Paddle webhook event (Paddle v2 Billing
 * format). Returns false on any malformed input or signature mismatch — callers
 * MUST treat a false result as an unauthenticated request and reject it.
 */
export function verifyPaddleSignature(rawBody: string, signatureHeader: string): boolean {
  if (!signatureHeader || !PADDLE_WEBHOOK_SECRET) return false

  try {
    const parts = signatureHeader.split(';')
    const tPart = parts.find(p => p.startsWith('t='))
    const h1Part = parts.find(p => p.startsWith('h1='))

    if (!tPart || !h1Part) return false

    const timestamp = tPart.split('=')[1]
    const signature = h1Part.split('=')[1]

    if (!timestamp || !signature) return false

    // Construct validation string: ts:rawBody
    const payload = `${timestamp}:${rawBody}`
    const expectedSignature = crypto
      .createHmac('sha256', PADDLE_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')

    const provided = Buffer.from(signature, 'hex')
    const expected = Buffer.from(expectedSignature, 'hex')
    // Guard against length-mismatched buffers — timingSafeEqual throws on
    // unequal lengths, which would surface as a false-negative rather than an
    // exception here.
    if (provided.length !== expected.length || expected.length === 0) return false

    return crypto.timingSafeEqual(provided, expected)
  } catch (err) {
    logger.with('err', err).error('Error verifying Paddle signature')
    return false
  }
}

/**
 * Fetch subscription details directly from the Paddle API. Used for
 * reconciliation/debugging — normal flow is webhook-driven.
 */
export async function getPaddleSubscription(subscriptionId: string): Promise<any> {
  const resp = await fetch(`${PADDLE_API_URL}/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000)
  })
  if (!resp.ok) {
    throw new Error(`Paddle API responded with status ${resp.status}: ${await resp.text()}`)
  }
  const result = (await resp.json()) as { data?: unknown }
  return result.data
}
