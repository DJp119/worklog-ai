/**
 * server/src/routes/webhooks/github.ts
 *
 * GitHub App webhook handler.
 * - Verifies signature using app-global GITHUB_APP_WEBHOOK_SECRET (Bug CF)
 * - Resolves org via installation.id → org_integrations lookup
 * - Records events idempotently via recordEvent
 * - Updates goal_links based on PR/issue status changes
 * - DB triggers handle progress recomputation (Issue CJ)
 *
 * Mounted at: /api/webhooks/github (with raw-body capture in index.ts)
 * Called from: server/src/index.ts
 */

import { Router } from 'express'
import { supabase } from '../../lib/database.js'
import { verifyGithubSignature, recordEvent, updateEventStatus } from '../../lib/webhookSecurity.js'
import { logger } from '../../lib/logger.js'

export const githubWebhookRoutes = Router()

githubWebhookRoutes.post('/', async (req, res) => {
  const rawBody = (req as any).rawBody as Buffer | undefined
  if (!rawBody) return res.status(400).json({ error: 'Missing raw body' })

  const sigHeader = req.headers['x-hub-signature-256'] as string
  if (!verifyGithubSignature(rawBody, sigHeader)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const payload = req.body
  const deliveryId = req.headers['x-github-delivery'] as string
  const event = req.headers['x-github-event'] as string

  // Idempotent event recording
  const eventId = await recordEvent(supabase, {
    provider: 'github',
    externalEventId: deliveryId,
    eventType: event,
    payload,
  })
  if (!eventId) return res.status(200).json({ message: 'Duplicate event' })

  try {
    await updateEventStatus(supabase, { eventId, status: 'processing' })

    // Resolve org from installation.id
    const installationId = payload.installation?.id
    if (!installationId) {
      await updateEventStatus(supabase, { eventId, status: 'done' })
      return res.status(200).json({ message: 'No installation context' })
    }

    const { data: orgInt } = await supabase
      .from('org_integrations')
      .select('org_id, is_active')
      .eq('provider', 'github_app')
      .eq('external_install_id', String(installationId))
      .eq('is_active', true)
      .single()

    if (!orgInt) {
      logger.with('installationId', installationId).warn('No matching org integration')
      await updateEventStatus(supabase, { eventId, status: 'done' })
      return res.status(200).json({ message: 'No matching org' })
    }

    const orgId = orgInt.org_id

    // Handle installation events (app lifecycle)
    if (event === 'installation' || event === 'installation_repositories') {
      logger.with('event', event).info('GitHub App installation event')
      await updateEventStatus(supabase, { eventId, status: 'done' })
      return res.status(200).json({ message: 'Installation event processed' })
    }

    // Only process events that change work-item status
    const statusEvents = ['pull_request', 'issues', 'pull_request_review']
    if (!statusEvents.includes(event)) {
      await updateEventStatus(supabase, { eventId, status: 'done' })
      return res.status(200).json({ message: 'Event type ignored' })
    }

    // MEDIUM-#17: filter on `action` so a `pull_request` event with
    // action: 'opened' or 'synchronize' doesn't re-flip a previously
    // completed goal back to in-progress. Only closure/meaningful
    // actions affect `is_done` / `state`.
    const action = (payload.action ?? '') as string
    const meaningfulActions = new Set([
      'closed',            // PR/issue closed (may also be merged for PRs)
      'reopened',          // back to in-progress
      'edited',            // title/state changed
      'submitted',         // PR review submitted
    ])
    if (!meaningfulActions.has(action)) {
      await updateEventStatus(supabase, { eventId, status: 'done' })
      return res.status(200).json({ message: 'Action ignored' })
    }

    // Extract node_id for the affected item (immutable, Bug fix in plan)
    let externalId: string | null = null
    let isDone = false
    let state: string | null = null
    let externalKey: string | null = null
    let externalUrl: string | null = null
    let title: string | null = null

    if (event === 'pull_request' && payload.pull_request) {
      const pr = payload.pull_request
      externalId = pr.node_id ?? null
      isDone = pr.merged === true || pr.state === 'closed'
      state = pr.merged ? 'merged' : pr.state
      externalKey = `${payload.repository?.full_name}#${pr.number}`
      externalUrl = pr.html_url ?? null
      title = pr.title ?? null
    } else if (event === 'issues' && payload.issue) {
      const issue = payload.issue
      externalId = issue.node_id ?? null
      isDone = issue.state === 'closed'
      state = issue.state
      externalKey = `${payload.repository?.full_name}#${issue.number}`
      externalUrl = issue.html_url ?? null
      title = issue.title ?? null
    } else if (event === 'pull_request_review' && payload.pull_request) {
      const pr = payload.pull_request
      externalId = pr.node_id ?? null
      isDone = pr.merged === true || pr.state === 'closed'
      state = pr.state
      externalKey = `${payload.repository?.full_name}#${pr.number}`
      externalUrl = pr.html_url ?? null
      title = pr.title ?? null
    }

    if (!externalId) {
      await updateEventStatus(supabase, { eventId, status: 'done' })
      return res.status(200).json({ message: 'No external ID extracted' })
    }

    // Update goal_links — org scoping prevents cross-org tampering
    const { data: affectedGoals } = await supabase
      .from('goal_links')
      .update({ is_done: isDone, state, external_key: externalKey, external_url: externalUrl, title })
      .eq('provider', 'github')
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
    logger.with('err', err).error('GitHub webhook processing error')
    await updateEventStatus(supabase, { eventId, status: 'error', error: err.message }).catch(() => {})
    res.status(200).json({ message: 'Processing error logged' })
  }
})
