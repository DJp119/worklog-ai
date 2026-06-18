/**
 * server/src/lib/webhookSecurity.ts
 *
 * Webhook signature verification + idempotent event recording.
 * GitHub: HMAC-SHA256 with app-global GITHUB_APP_WEBHOOK_SECRET (Bug CF fix).
 * JIRA: token query parameter (Bug CE fix — JIRA Cloud webhooks lack HMAC headers).
 * Slack: v0 signing signature with 5-min clock skew.
 *
 * All timing-safe comparisons use SHA-256 pre-hash to guarantee 32-byte
 * buffers — avoids RangeError crash from crypto.timingSafeEqual on
 * mismatched lengths.
 *
 * Called from: server/src/routes/webhooks/github.ts, jira.ts, slack.ts
 */

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from './crypto.js'
import { logger } from './logger.js'

// ---------------------------------------------------------------------------
// GitHub webhook verification (app-global secret, Bug CF)
// ---------------------------------------------------------------------------

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET

export function verifyGithubSignature(
  rawBody: Buffer, signatureHeader: string
): boolean {
  if (!GITHUB_WEBHOOK_SECRET) {
    logger.error('GITHUB_APP_WEBHOOK_SECRET not configured')
    return false
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const expected = crypto
    .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest()

  const received = Buffer.from(signatureHeader.slice(7), 'hex')

  // Pre-hash both to 32 bytes for safe timingSafeEqual
  const expectedHash = crypto.createHash('sha256').update(expected).digest()
  const receivedHash = crypto.createHash('sha256').update(received).digest()

  return crypto.timingSafeEqual(expectedHash, receivedHash)
}

// ---------------------------------------------------------------------------
// JIRA webhook verification (token query param, Bug CE)
// ---------------------------------------------------------------------------

/**
 * Verify JIRA webhook token. The JIRA webhook URL includes ?token=<secret>.
 * We compare against the decrypted webhook_secret_enc from org_integrations
 * using timing-safe comparison of SHA-256 hashes (Bug CE + timing-attack fix).
 */
export function verifyJiraWebhookToken(
  incomingToken: string, storedSecretEnc: string
): boolean {
  const storedSecret = decryptSecret(storedSecretEnc)
  if (!storedSecret || !incomingToken) return false

  const incomingHash = crypto.createHash('sha256').update(incomingToken).digest()
  const storedHash = crypto.createHash('sha256').update(storedSecret).digest()

  return crypto.timingSafeEqual(incomingHash, storedHash)
}

// ---------------------------------------------------------------------------
// Slack webhook verification (v0 signature + 5-min skew)
// ---------------------------------------------------------------------------

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET
const SLACK_SKEW_MS = 5 * 60 * 1000 // 5 minutes

export function verifySlackSignature(
  rawBody: Buffer, timestamp: string, signature: string
): boolean {
  if (!SLACK_SIGNING_SECRET) {
    logger.error('SLACK_SIGNING_SECRET not configured')
    return false
  }

  if (!timestamp || !signature || !signature.startsWith('v0=')) return false

  // Clock skew check
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > SLACK_SKEW_MS / 1000) {
    return false
  }

  const baseString = `v0:${timestamp}:${rawBody.toString('utf8')}`
  const expected = crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest()

  const received = Buffer.from(signature.slice(3), 'hex')

  const expectedHash = crypto.createHash('sha256').update(expected).digest()
  const receivedHash = crypto.createHash('sha256').update(received).digest()

  return crypto.timingSafeEqual(expectedHash, receivedHash)
}

// ---------------------------------------------------------------------------
// Idempotent event recording
// ---------------------------------------------------------------------------

type EventStatus = 'received' | 'processing' | 'done' | 'error'

/**
 * Record a webhook event idempotently.
 * Returns the event ID if this is a new/retryable event, or null if it's
 * a duplicate that should be acked and ignored.
 *
 * Retryable: status='error' OR stuck in 'processing' for >5 min.
 */
export async function recordEvent(
  db: SupabaseClient, params: {
    provider: string, externalEventId: string,
    eventType: string, payload: Record<string, any>,
  }
): Promise<string | null> {
  const { data, error } = await db.rpc('record_integration_event', {
    p_provider: params.provider,
    p_external_event_id: params.externalEventId,
    p_event_type: params.eventType,
    p_payload: params.payload,
  })
  if (error) {
    logger.with('err', error).error('recordEvent failed')
    return null
  }
  return data as string | null
}

/**
 * Update event status after processing.
 */
export async function updateEventStatus(
  db: SupabaseClient, params: {
    eventId: string, status: EventStatus, error?: string,
  }
) {
  const updates: Record<string, any> = {
    status: params.status,
    processed_at: params.status === 'done' || params.status === 'error' ? new Date().toISOString() : null,
  }
  if (params.error) updates.error = params.error

  await db.from('integration_events').update(updates).eq('id', params.eventId)
}
