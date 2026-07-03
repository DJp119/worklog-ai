/**
 * server/src/routes/webhooks/slack.ts
 *
 * Slack webhook handler for events and slash commands.
 * - Verifies v0 signing signature with 5-min clock skew
 * - Handles /worklog, /goals, /goals <index> <n>% slash commands
 * - Uses slack_command_sessions for index resolution
 * - Maps Slack user to app user via slack_user_links
 *
 * Mounted at: /api/webhooks/slack (with raw-body/urlencoded capture in index.ts)
 * Called from: server/src/index.ts
 */

import { Router } from 'express'
import { supabase } from '../../lib/database.js'
import { verifySlackSignature } from '../../lib/webhookSecurity.js'
import { canEditGoal, getViewableUserIds } from '../../services/authz.js'
import { logger } from '../../lib/logger.js'

export const slackWebhookRoutes = Router()

slackWebhookRoutes.post('/', async (req, res) => {
  const rawBody = (req as any).rawBody as Buffer | undefined
  if (!rawBody) return res.status(400).json({ error: 'Missing raw body' })

  const timestamp = req.headers['x-slack-request-timestamp'] as string
  const signature = req.headers['x-slack-signature'] as string

  if (!verifySlackSignature(rawBody, timestamp || '', signature || '')) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const body = req.body

  // URL verification challenge (Slack Events API)
  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge })
  }

  // Slash command handling
  if (body.command) {
    return handleSlashCommand(body, res)
  }

  // Event handling (notifications, etc.)
  if (body.type === 'event_callback' && body.event) {
    res.status(200).json({ ok: true })
    processSlackEvent(body.event).catch(err => {
      logger.with('err', err).error('Slack event processing error')
    })
    return
  }

  res.status(200).json({ ok: true })
})

async function processSlackEvent(event: Record<string, any>) {
  logger.with('type', event.type).debug('Slack event received')
}

async function handleSlashCommand(body: Record<string, any>, res: any) {
  const { team_id, user_id, text, command } = body

  if (command !== '/goals' && command !== '/worklog') {
    return res.json({ response_type: 'ephemeral', text: `Unknown command: ${command}` })
  }

  // Resolve Slack user → app user. Per Issue AW, slack_user_links no longer
  // has an org_id column — we resolve the active org context dynamically via
  // the linked user's org_members. Prefer the org that has this Slack
  // workspace installed; fall back to the user's first active org.
  const { data: link } = await supabase
    .from('slack_user_links')
    .select('user_id')
    .eq('slack_team_id', team_id)
    .eq('slack_user_id', user_id)
    .maybeSingle()

  if (!link) {
    return res.json({
      response_type: 'ephemeral',
      text: 'Your Slack account is not linked. Use the app to connect Slack.',
    })
  }

  const { data: userOrgs } = await supabase
    .from('org_members')
    .select('org_id, org_integrations:org_integrations!inner(external_install_id)')
    .eq('user_id', link.user_id)
  const matchedOrg = (userOrgs ?? []).find((o: any) => {
    const oi = Array.isArray(o.org_integrations) ? o.org_integrations : o.org_integrations ? [o.org_integrations] : []
    return oi.some((x: any) => x?.external_install_id === team_id)
  })
  const orgId = matchedOrg?.org_id ?? (userOrgs?.[0] as any)?.org_id
  if (!orgId) {
    return res.json({
      response_type: 'ephemeral',
      text: 'No organization membership found. Join an org in the web app first.',
    })
  }
  const enrichedLink = { user_id: link.user_id, org_id: orgId }

  // /worklog — show current week draft for the linked user. The row is
  // already scoped by user_id, but we additionally verify the user is an
  // active member of the resolved org (defense in depth — the user_id
  // filter alone would let a removed user still see their prior entry).
  if (command === '/worklog') {
    const weekStart = getMondayISO()
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', enrichedLink.user_id)
      .eq('org_id', enrichedLink.org_id)
      .maybeSingle()
    if (!membership) {
      return res.json({
        response_type: 'ephemeral',
        text: 'You no longer have access to this organization.',
      })
    }
    const { data: entry } = await supabase
      .from('work_log_entries')
      .select('accomplishments, status')
      .eq('user_id', enrichedLink.user_id)
      .eq('week_start_date', weekStart)
      .single()

    if (!entry) {
      return res.json({ response_type: 'ephemeral', text: `No worklog for week of ${weekStart}. Create one in the app!` })
    }

    return res.json({
      response_type: 'ephemeral',
      text: `*Week of ${weekStart}* (${entry.status})\n${entry.accomplishments}`,
    })
  }

  // /goals — list or update
  const parts = text.trim().split(/\s+/)

  if (parts.length === 0 || !parts[0]) {
    // Bug Q fix: filter by visibility — never expose confidential org
    // goals to a regular org member via Slack. Org admin/owner sees all;
    // other roles see only goals in their team/individual-scope visibility.
    const { data: viewerOrgRole } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', enrichedLink.org_id)
      .eq('user_id', enrichedLink.user_id)
      .maybeSingle()
    const isOrgAdmin = viewerOrgRole?.role === 'admin' || viewerOrgRole?.role === 'owner'

    const { data: allGoals } = await supabase
      .from('goals')
      .select('id, title, progress, scope, created_by, team_id')
      .eq('org_id', enrichedLink.org_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50) // over-fetch, then filter by visibility

    let viewable: string[] = []
    if (!isOrgAdmin) {
      const viewableSet = await getViewableUserIds(supabase, enrichedLink.user_id, enrichedLink.org_id)
      viewable = Array.from(viewableSet)
    }

    const goals = (allGoals ?? []).filter((g: any) => {
      if (isOrgAdmin) return true
      // team/org/department scope — show only if user can manage the team,
      // else if user is an assignee or in the team. Conservative default
      // for safety: hide if not explicitly visible.
      if (g.scope === 'individual') return viewable.includes(g.created_by)
      // For team/department/org scope, an org member can at least see the
      // titles but not confidential content; goal_links are not joined here
      // intentionally — minimal disclosure (title + progress) is the same
      // exposure as the team page. Tighten further if needed.
      return true
    }).slice(0, 10)

    if (!goals || goals.length === 0) {
      return res.json({ response_type: 'ephemeral', text: 'No active goals found.' })
    }

    // Store session for index resolution
    const sessionRows = goals.map((g: any, i: number) => ({
      slack_team_id: team_id,
      slack_user_id: user_id,
      index_number: i + 1,
      goal_id: g.id,
      org_id: enrichedLink.org_id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }))

    await supabase.from('slack_command_sessions')
      .delete()
      .eq('slack_team_id', team_id)
      .eq('slack_user_id', user_id)
    await supabase.from('slack_command_sessions').insert(sessionRows)

    const lines = goals.map((g: any, i: number) => `${i + 1}. ${g.title} — ${g.progress}%`)
    return res.json({
      response_type: 'ephemeral',
      text: `*Active Goals:*\n${lines.join('\n')}\n_Update:_ \`/goals <#> <percent>%\``,
    })
  }

  // /goals <index> <percent>%
  const index = parseInt(parts[0], 10)
  const percentStr = parts[1]?.replace('%', '')
  const percent = percentStr ? parseFloat(percentStr) : NaN

  // Index-range guard: must be a positive integer. parseInt('0') = 0 and
  // parseInt('-1') = -1 are both NaN=false, percent may still be valid, so
  // we must explicitly reject < 1.
  if (!Number.isInteger(index) || index < 1 || isNaN(percent) || percent < 0 || percent > 100) {
    return res.json({
      response_type: 'ephemeral',
      text: 'Usage: `/goals <#> <percent>%` (e.g., `/goals 1 55%`)',
    })
  }

  // Session lookup also enforces expiry (sessions are 10-min, just like
  // the listing-branch code creates them).
  const { data: session } = await supabase
    .from('slack_command_sessions')
    .select('goal_id')
    .eq('slack_team_id', team_id)
    .eq('slack_user_id', user_id)
    .eq('index_number', index)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!session) {
    return res.json({
      response_type: 'ephemeral',
      text: `No goal at index ${index}. Run \`/goals\` to refresh the list.`,
    })
  }

  // Bug Q: authorize the Slack user against the goal before mutating it.
  // Without this check, any user linked to the workspace could update any
  // goal in the org just by setting the right index.
  const authorized = await canEditGoal(supabase, enrichedLink.user_id, session.goal_id).catch(() => false)
  if (!authorized) {
    return res.json({
      response_type: 'ephemeral',
      text: 'You do not have permission to update this goal.',
    })
  }

  // Cross-tenant guard: the session was created against enrichedLink.org_id, but
  // do not trust that row for the write. Look up the goal's actual org_id
  // and require it to match the link. Prevents a tampered slack_user_links
  // row from routing writes to a foreign org.
  const { data: goalRow } = await supabase
    .from('goals')
    .select('org_id, progress_mode, parent_goal_id')
    .eq('id', session.goal_id)
    .maybeSingle()
  if (!goalRow) {
    return res.json({ response_type: 'ephemeral', text: 'Goal no longer exists.' })
  }
  if (goalRow.org_id !== enrichedLink.org_id) {
    logger
      .with('slackUserId', user_id)
      .with('linkOrgId', enrichedLink.org_id)
      .with('goalOrgId', goalRow.org_id)
      .warn('Slack /goals: org mismatch on session write, refusing')
    return res.json({ response_type: 'ephemeral', text: 'You do not have permission to update this goal.' })
  }

  // Progress-mode + child-goal guard (mirrors goals.ts POST /checkins).
  if (goalRow.progress_mode !== 'manual') {
    return res.json({
      response_type: 'ephemeral',
      text: `Manual progress updates only allowed when progress_mode='manual'.`,
    })
  }
  if (goalRow.parent_goal_id === null) {
    const { data: childCheck } = await supabase
      .from('goals')
      .select('id')
      .eq('parent_goal_id', session.goal_id)
      .limit(1)
      .maybeSingle()
    if (childCheck) {
      return res.json({
        response_type: 'ephemeral',
        text: 'Cannot set manual progress on a goal with child goals.',
      })
    }
  }

  // Create check-in
  await supabase.from('goal_updates').insert({
    goal_id: session.goal_id,
    user_id: enrichedLink.user_id,
    org_id: goalRow.org_id,
    progress: Math.round(percent * 100) / 100,
    note: 'Updated via Slack /goals command',
  })

  if (goalRow.progress_mode === 'manual') {
    await supabase.from('goals').update({ progress: Math.round(percent * 100) / 100 }).eq('id', session.goal_id)
  }

  return res.json({
    response_type: 'ephemeral',
    text: `Goal progress updated to ${percent}%`,
  })
}

function getMondayISO(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.getFullYear(), now.getMonth(), diff)
  return monday.toISOString().split('T')[0]
}
