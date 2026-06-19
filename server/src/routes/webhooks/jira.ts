/**
 * server/src/routes/webhooks/jira.ts
 *
 * JIRA webhook handler.
 * - Verifies via token query parameter (Bug CE — JIRA Cloud lacks HMAC headers)
 * - Resolves org from org_id query param
 * - Records events idempotently; uses SHA-256 of payload as external_event_id
 *   (JIRA payloads lack unique delivery IDs)
 * - Updates goal_links on issue status transitions
 * - DB triggers handle progress recomputation (Issue CJ)
 *
 * Mounted at: /api/webhooks/jira (with raw-body capture in index.ts)
 * Called from: server/src/index.ts
 */

import { Router } from 'express'
import crypto from 'crypto'
import { supabase } from '../../lib/database.js'
import { verifyJiraWebhookToken, recordEvent, updateEventStatus } from '../../lib/webhookSecurity.js'
import { logger } from '../../lib/logger.js'

export const jiraWebhookRoutes = Router()

jiraWebhookRoutes.post('/', async (req, res) => {
  const orgId = req.query.org_id as string
  // SECURITY (Bug CE follow-up): reject URL-embedded ?token= secrets. The
  // JIRA webhook URL surfaced in the admin UI is org_id-only; the secret
  // is HMAC-signed in the X-Hub-Signature-256 header and never travels
  // in the URL (where it would leak via CDN/proxy access logs and
  // browser history).
  const sigHeader = req.headers['x-hub-signature-256'] as string | undefined
  const providedSignature = sigHeader

  if (!orgId || !providedSignature) {
    return res.status(400).json({ error: 'Missing org_id or X-Hub-Signature-256 header' })
  }

  // Load org integration for this JIRA connection (.maybeSingle — no row
  // is not an error condition to throw on).
  const { data: orgInt } = await supabase
    .from('org_integrations')
    .select('id, webhook_secret_enc, is_active')
    .eq('org_id', orgId)
    .eq('provider', 'jira')
    .eq('is_active', true)
    .maybeSingle()

  if (!orgInt || !orgInt.webhook_secret_enc) {
    return res.status(403).json({ error: 'No JIRA integration found for this org' })
  }

  // Verify HMAC signature against the encrypted secret. Strip the
  // "sha256=" prefix from the header.
  const provided = providedSignature.startsWith('sha256=')
    ? providedSignature.slice('sha256='.length)
    : providedSignature
  if (!verifyJiraWebhookToken(provided, orgInt.webhook_secret_enc)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const payload = req.body

  // JIRA lacks unique delivery IDs — hash payload for deterministic external_event_id
  const rawBody = (req as any).rawBody as Buffer | undefined
  const payloadHash = rawBody
    ? crypto.createHash('sha256').update(rawBody).digest('hex')
    : crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')

  const eventType = payload.webhookEvent ?? 'unknown'

  const eventId = await recordEvent(supabase, {
    provider: 'jira',
    externalEventId: payloadHash,
    eventType,
    payload,
  })
  if (!eventId) return res.status(200).json({ message: 'Duplicate event' })

  try {
    await updateEventStatus(supabase, { eventId, status: 'processing' })

    // Only process issue events with status changes
    const issueEvents = ['jira:issue_updated', 'jira:issue_created']
    if (!issueEvents.includes(eventType) || !payload.issue) {
      await updateEventStatus(supabase, { eventId, status: 'done' })
      return res.status(200).json({ message: 'Event type ignored' })
    }

    const issue = payload.issue
    // Use immutable numeric ID, not the mutable key
    const externalId = String(issue.id)
    const statusCategory = issue.fields?.status?.statusCategory?.key
    const isDone = statusCategory === 'done'
    const state = issue.fields?.status?.name ?? null
    const externalKey = issue.key ?? null
    const externalUrl = issue.self ?? null
    const title = issue.fields?.summary ?? null

    // Update goal_links — org scoping prevents cross-org tampering
    const { data: affectedGoals } = await supabase
      .from('goal_links')
      .update({ is_done: isDone, state, external_key: externalKey, external_url: externalUrl, title })
      .eq('provider', 'jira')
      .eq('external_id', externalId)
      .eq('org_id', orgId)
      .select('goal_id')

    if (affectedGoals && affectedGoals.length > 0) {
      const goalIds = [...new Set(affectedGoals.map(g => g.goal_id))]
      logger.with('goalIds', goalIds).info('Updated goal_links for goals')
    }

    await updateEventStatus(supabase, { eventId, status: 'done' })
    res.status(200).json({ message: 'Processed' })
  } catch (err: any) {
    logger.with('err', err).error('JIRA webhook processing error')
    await updateEventStatus(supabase, { eventId, status: 'error', error: err.message }).catch(() => {})
    res.status(200).json({ message: 'Processing error logged' })
  }
})
