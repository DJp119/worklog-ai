/**
 * server/src/services/reportGenerationService.ts
 *
 * Generates structured AI performance reports by aggregating activity data,
 * framing a Mistral prompt, and saving the result to performance_reports.
 *
 * Uses the existing `mistral` client and `chatModel` from server/src/lib/mistral.ts.
 * Only available for Enterprise-tier organizations (enforced at the route layer).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { mistral, chatModel } from '../lib/mistral.js'
import { aggregateUserActivity } from './activityAggregationService.js'
import { logger } from '../lib/logger.js'

interface GenerateReportParams {
  orgId: string
  reportType: 'self' | 'individual' | 'team' | 'organization'
  targetUserId?: string
  targetTeamId?: string
  periodStart: string
  periodEnd: string
}

interface GeneratedReport {
  id: string
  org_id: string
  report_type: string
  target_user_id: string | null
  target_team_id: string | null
  period_start: string
  period_end: string
  generated_by: string
  report_content: Record<string, any>
  report_markdown: string
  ai_model: string
  token_usage: number | null
  generation_time_ms: number
  status: 'completed' | 'failed'
  error_message: string | null
  created_at: string
  updated_at: string
}

/**
 * Generate a performance report. Orchestrates:
 * 1. Create a "generating" row in performance_reports
 * 2. Aggregate activity for the target user(s)
 * 3. Build a Mistral prompt and call the LLM
 * 4. Update the report row with the result
 */
export async function generatePerformanceReport(
  db: SupabaseClient,
  params: GenerateReportParams,
  generatedBy: string
): Promise<GeneratedReport> {
  const startTime = Date.now()

  // 1. Create a generating placeholder.
  const { data: report, error: insertError } = await db
    .from('performance_reports')
    .insert({
      org_id: params.orgId,
      report_type: params.reportType,
      target_user_id: params.targetUserId ?? null,
      target_team_id: params.targetTeamId ?? null,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      generated_by: generatedBy,
      report_content: {},
      report_markdown: null,
      ai_model: chatModel,
      token_usage: null,
      generation_time_ms: null,
      status: 'generating',
    })
    .select()
    .single()

  if (insertError || !report) {
    throw new Error(`Failed to create report row: ${insertError?.message ?? 'unknown'}`)
  }

  try {
    // 2. Aggregate activity data.
    // For individual/self reports, aggregate the target user.
    // For team/org reports, aggregate all team/org members.
    const userIdsToAggregate = await resolveTargetUserIds(db, params)

    const allAggregations: Array<{ userId: string; provider: string; summaryData: Record<string, any> }> = []
    for (const userId of userIdsToAggregate) {
      const aggs = await aggregateUserActivity(db, userId, params.orgId, params.periodStart, params.periodEnd)
      for (const a of aggs) {
        allAggregations.push({ userId, ...a })
      }
    }

    // Also pull goal progress for the period.
    const goalProgress = await aggregateGoalProgress(db, params)

    // 3. Build prompt and call Mistral.
    const prompt = buildReportPrompt(params, allAggregations, goalProgress)

    const response = await mistral.chat.complete({
      model: chatModel,
      messages: [
        {
          role: 'system',
          content: `You are a performance analysis AI assistant. Generate a structured, insightful performance report based on the activity data provided. Use markdown formatting. Be factual and data-driven. Highlight strengths, areas for improvement, and notable patterns.`,
        },
        { role: 'user', content: prompt },
      ],
    })

    const rawContent = response.choices?.[0]?.message?.content ?? ''
    const markdown = typeof rawContent === 'string' ? rawContent : ''
    const usage = response.usage
    const generationTimeMs = Date.now() - startTime

    // Parse key sections from the response into structured content.
    const reportContent = parseReportSections(markdown)

    // 4. Update the report row.
    const { error: updateError } = await db
      .from('performance_reports')
      .update({
        report_content: reportContent,
        report_markdown: markdown,
        ai_model: chatModel,
        token_usage: (usage?.totalTokens ?? null) as number | null,
        generation_time_ms: generationTimeMs,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)

    if (updateError) {
      logger.with('err', updateError).with('reportId', report.id).error('Failed to update report status')
    }

    return {
      ...report,
      report_content: reportContent,
      report_markdown: markdown,
      token_usage: (usage?.totalTokens ?? null) as number | null,
      generation_time_ms: generationTimeMs,
      status: 'completed',
      error_message: null,
    } as GeneratedReport
  } catch (err: any) {
    // Mark as failed.
    const generationTimeMs = Date.now() - startTime
    await db
      .from('performance_reports')
      .update({
        status: 'failed',
        error_message: err.message ?? 'Unknown error',
        generation_time_ms: generationTimeMs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)

    logger.with('err', err).with('reportId', report.id).error('Report generation failed')
    throw err
  }
}

/** Resolve which user IDs to aggregate for the report scope. */
async function resolveTargetUserIds(
  db: SupabaseClient,
  params: GenerateReportParams
): Promise<string[]> {
  // Self / individual: target a specific user
  if (params.reportType === 'self' || params.reportType === 'individual') {
    return params.targetUserId ? [params.targetUserId] : []
  }

  // Team: aggregate all members of the team
  if (params.reportType === 'team' && params.targetTeamId) {
    const { data: members } = await db
      .from('team_members')
      .select('user_id')
      .eq('team_id', params.targetTeamId)
    return (members ?? []).map((m: any) => m.user_id)
  }

  // Organization: aggregate all org members
  const { data: members } = await db
    .from('org_members')
    .select('user_id')
    .eq('org_id', params.orgId)
  return (members ?? []).map((m: any) => m.user_id)
}

/** Gather goal progress data for the target scope. */
async function aggregateGoalProgress(
  db: SupabaseClient,
  params: GenerateReportParams
): Promise<Array<Record<string, any>>> {
  let query = db
    .from('goals')
    .select('id, title, scope, status, progress, start_date, due_date, created_by')
    .eq('org_id', params.orgId)

  if (params.targetTeamId) {
    query = query.eq('team_id', params.targetTeamId)
  } else if (params.targetUserId) {
    // For individual/self, include assigned goals.
    const { data: assigneeGoals } = await db
      .from('goal_assignees')
      .select('goal_id')
      .eq('user_id', params.targetUserId)
    const goalIds = (assigneeGoals ?? []).map((a: any) => a.goal_id)

    const { data: createdGoals } = await db
      .from('goals')
      .select('id, title, scope, status, progress, start_date, due_date, created_by')
      .eq('created_by', params.targetUserId)
      .eq('org_id', params.orgId)

    const createdIds = new Set((createdGoals ?? []).map((g: any) => g.id))
    const allIds = [...new Set([...goalIds, ...createdIds])]

    if (allIds.length === 0) return []

    const { data } = await db
      .from('goals')
      .select('id, title, scope, status, progress, start_date, due_date, created_by')
      .in('id', allIds)
    return (data ?? []) as unknown as Array<Record<string, any>>
  }

  const { data } = await query
  return (data ?? []) as unknown as Array<Record<string, any>>
}

/** Build the user prompt for Mistral. */
function buildReportPrompt(
  params: GenerateReportParams,
  aggregations: Array<{ userId: string; provider: string; summaryData: Record<string, any> }>,
  goalProgress: Array<Record<string, any>>
): string {
  const { reportType, periodStart, periodEnd } = params

  // Format activity data
  const activityByUser = new Map<string, Array<{ provider: string; data: Record<string, any> }>>()
  for (const a of aggregations) {
    const existing = activityByUser.get(a.userId) ?? []
    existing.push({ provider: a.provider, data: a.summaryData })
    activityByUser.set(a.userId, existing)
  }

  let activitySection = `Report Type: ${reportType}\nPeriod: ${periodStart} to ${periodEnd}\n\n`

  for (const [userId, activities] of activityByUser) {
    activitySection += `User: ${userId}\n`
    for (const { provider, data } of activities) {
      activitySection += `  ${provider}: ${JSON.stringify(data)}\n`
    }
  }

  let goalSection = ''
  if (goalProgress.length > 0) {
    goalSection = '\nGoal Progress:\n'
    for (const g of goalProgress) {
      goalSection += `  - [${g.status}] "${g.title}" (${g.scope}, progress: ${g.progress}%)\n`
    }
  }

  return `Generate a performance report for the following data:\n\n${activitySection}${goalSection}\nProvide:\n1. Executive Summary\n2. Activity Highlights\n3. Goal Progress Analysis\n4. Recommendations`
}

/** Parse markdown into semi-structured sections. */
function parseReportSections(markdown: string): Record<string, any> {
  const sections: Record<string, string> = {}
  const lines = markdown.split('\n')
  let currentSection = 'summary'
  let currentContent: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/)
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim()
      }
      currentSection = headingMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '_')
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim()
  }

  return {
    sections,
    word_count: markdown.split(/\s+/).length,
  }
}
