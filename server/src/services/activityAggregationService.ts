/**
 * server/src/services/activityAggregationService.ts
 *
 * Aggregates per-user activity data across providers (JIRA, GitHub, Slack,
 * manual) into the activity_summaries table for a given date range. Used by the
 * report generation service to build context for Mistral.
 *
 * The aggregation reads from existing integration data (integration_events,
 * work_log_entries, goal_updates) and writes pre-computed summary JSON blobs.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../lib/logger.js'

interface AggregationResult {
  provider: string
  summaryData: Record<string, any>
}

/**
 * Aggregate a single user's activity across all providers for a period.
 * Returns the per-provider summary data blobs written to activity_summaries.
 */
export async function aggregateUserActivity(
  db: SupabaseClient,
  userId: string,
  orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = []
  const providers: Array<{ provider: string; fn: () => Promise<Record<string, any>> }> = [
    { provider: 'github', fn: () => aggregateGitHubActivity(db, userId, orgId, periodStart, periodEnd) },
    { provider: 'jira', fn: () => aggregateJiraActivity(db, userId, orgId, periodStart, periodEnd) },
    { provider: 'slack', fn: () => aggregateSlackActivity(db, userId, orgId, periodStart, periodEnd) },
    { provider: 'manual', fn: () => aggregateManualActivity(db, userId, periodStart, periodEnd) },
  ]

  for (const { provider, fn } of providers) {
    try {
      const summaryData = await fn()

      await db.from('activity_summaries').upsert(
        {
          org_id: orgId,
          user_id: userId,
          period_start: periodStart,
          period_end: periodEnd,
          provider,
          summary_data: summaryData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,user_id,period_start,period_end,provider' }
      )

      results.push({ provider, summaryData })
    } catch (err) {
      logger.with('err', err).with('provider', provider).with('userId', userId).warn('Activity aggregation failed for provider; skipping')
    }
  }

  return results
}

async function aggregateGitHubActivity(
  db: SupabaseClient,
  userId: string,
  orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<Record<string, any>> {
  const { data: events } = await db
    .from('integration_events')
    .select('event_type, payload')
    .eq('user_id', userId)
    .eq('provider', 'github')
    .gte('received_at', periodStart)
    .lte('received_at', periodEnd + 'T23:59:59')
    .limit(500)

  const summary: Record<string, any> = { commits: 0, pull_requests: 0, issues_closed: 0, repos: new Set<string>() }

  for (const event of events ?? []) {
    const payload = event.payload ?? {}
    if (event.event_type === 'push') summary.commits += (payload.commits as unknown[])?.length ?? 0
    if (event.event_type === 'pull_request') summary.pull_requests++
    if (event.event_type === 'issues' && payload.action === 'closed') summary.issues_closed++
    if (payload.repository?.full_name) (summary.repos as Set<string>).add(payload.repository.full_name)
  }

  return { ...summary, repos: [...(summary.repos as Set<string>)] }
}

async function aggregateJiraActivity(
  db: SupabaseClient,
  userId: string,
  _orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<Record<string, any>> {
  const { data: events } = await db
    .from('integration_events')
    .select('event_type, payload')
    .eq('user_id', userId)
    .eq('provider', 'jira')
    .gte('received_at', periodStart)
    .lte('received_at', periodEnd + 'T23:59:59')
    .limit(500)

  const summary: Record<string, any> = { issues_created: 0, issues_resolved: 0, comments: 0, projects: new Set<string>() }

  for (const event of events ?? []) {
    const payload = event.payload ?? {}
    if (payload.event?.type === 'issue_created') summary.issues_created++
    if (payload.event?.type === 'issue_generic' && payload.changelog?.items?.[0]?.field === 'status') {
      summary.issues_resolved++
    }
    if (payload.event?.type === 'comment_created') summary.comments++
    if (payload.issue?.fields?.project?.key) (summary.projects as Set<string>).add(payload.issue.fields.project.key)
  }

  return { ...summary, projects: [...(summary.projects as Set<string>)] }
}

async function aggregateSlackActivity(
  db: SupabaseClient,
  userId: string,
  orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<Record<string, any>> {
  // Slack events are in integration_events under provider='slack'.
  const { data: events } = await db
    .from('integration_events')
    .select('event_type, payload')
    .eq('user_id', userId)
    .eq('provider', 'slack')
    .gte('received_at', periodStart)
    .lte('received_at', periodEnd + 'T23:59:59')
    .limit(500)

  const summary: Record<string, any> = { messages_sent: 0, channels: new Set<string>() }

  for (const event of events ?? []) {
    if (event.event_type === 'message') summary.messages_sent++
    const payload = event.payload ?? {}
    if (payload.channel) (summary.channels as Set<string>).add(payload.channel)
  }

  return { ...summary, channels: [...(summary.channels as Set<string>)] }
}

async function aggregateManualActivity(
  db: SupabaseClient,
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<Record<string, any>> {
  const { data: entries } = await db
    .from('work_log_entries')
    .select('id, week_start_date, accomplishments, challenges, learnings, goals_next_week, hours_logged')
    .eq('user_id', userId)
    .gte('week_start_date', periodStart)
    .lte('week_start_date', periodEnd)
    .order('week_start_date', { ascending: true })

  return {
    entries_count: (entries ?? []).length,
    total_hours: (entries ?? []).reduce((sum: number, e) => sum + (e.hours_logged ?? 0), 0),
    weeks_with_entries: (entries ?? []).map((e: any) => e.week_start_date),
  }
}
