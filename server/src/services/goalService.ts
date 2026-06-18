/**
 * server/src/services/goalService.ts
 *
 * Goal CRUD + key results + assignees + check-ins.
 * Progress recomputation is trigger-driven (recompute_goal_progress in Postgres).
 * Called from: server/src/routes/goals.ts, server/src/routes/organizations.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../lib/logger.js'

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export async function createGoal(
  db: SupabaseClient, params: {
    orgId: string, scope: string, title: string, period: string,
    startDate: string, dueDate: string, createdBy: string,
    teamId?: string, departmentId?: string, parentGoalId?: string,
    description?: string, progressMode?: string,
  }
) {
  const { data, error } = await db
    .from('goals')
    .insert({
      org_id: params.orgId,
      scope: params.scope,
      title: params.title,
      period: params.period,
      start_date: params.startDate,
      due_date: params.dueDate,
      created_by: params.createdBy,
      team_id: params.teamId ?? null,
      department_id: params.departmentId ?? null,
      parent_goal_id: params.parentGoalId ?? null,
      description: params.description ?? null,
      progress_mode: params.progressMode ?? 'manual',
      status: 'draft',
    })
    .select()
    .single()
  if (error) { logger.with('err', error).error('createGoal failed'); throw error }
  return data
}

export async function updateGoal(
  db: SupabaseClient, goalId: string, updates: Record<string, any>
) {
  if (updates.progress !== undefined) {
    const { data: goal } = await db.from('goals').select('progress_mode').eq('id', goalId).single()
    if (!goal || goal.progress_mode !== 'manual') {
      throw new Error('Manual progress updates only allowed when progress_mode=manual')
    }
    const { data: children } = await db.from('goals').select('id').eq('parent_goal_id', goalId)
    if (children && children.length > 0) {
      throw new Error('Cannot set manual progress on a goal with child goals')
    }
  }

  const { data, error } = await db
    .from('goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGoal(db: SupabaseClient, goalId: string) {
  const { error } = await db.from('goals').delete().eq('id', goalId)
  if (error) throw error
}

export async function getGoalWithDetails(db: SupabaseClient, goalId: string) {
  const { data: goal, error } = await db
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single()
  if (error) throw error

  const [krs, links, assignees, updates] = await Promise.all([
    db.from('goal_key_results').select('*').eq('goal_id', goalId).order('sort_order'),
    db.from('goal_links').select('*').eq('goal_id', goalId),
    db.from('goal_assignees').select('user_id, assigned_by, assigned_at, users(id, email, name)').eq('goal_id', goalId),
    db.from('goal_updates').select('*').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(20),
  ])

  return {
    ...goal,
    key_results: krs.data ?? [],
    links: links.data ?? [],
    assignees: assignees.data ?? [],
    updates: updates.data ?? [],
  }
}

export async function listVisibleGoals(
  db: SupabaseClient, orgId: string, viewableUserIds: Set<string>,
  opts?: { teamId?: string; scope?: string; status?: string }
) {
  let query = db.from('goals').select('*').eq('org_id', orgId)
  if (opts?.teamId) query = query.eq('team_id', opts.teamId)
  if (opts?.scope) query = query.eq('scope', opts.scope)
  if (opts?.status) query = query.eq('status', opts.status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).filter((g: any) => {
    if (g.scope === 'individual') return viewableUserIds.has(g.created_by)
    return true
  })
}

// ---------------------------------------------------------------------------
// Key Results
// ---------------------------------------------------------------------------

export async function addKeyResult(
  db: SupabaseClient, goalId: string, params: {
    title: string, metricType: string, targetValue: number,
    startValue?: number, unit?: string, weight?: number, sortOrder?: number,
  }
) {
  const { data, error } = await db
    .from('goal_key_results')
    .insert({
      goal_id: goalId,
      title: params.title,
      metric_type: params.metricType,
      target_value: params.targetValue,
      start_value: params.startValue ?? 0,
      unit: params.unit ?? null,
      weight: params.weight ?? 1,
      sort_order: params.sortOrder ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateKeyResult(
  db: SupabaseClient, krId: string, updates: Record<string, any>
) {
  const { data, error } = await db
    .from('goal_key_results')
    .update(updates)
    .eq('id', krId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Assignees
// ---------------------------------------------------------------------------

export async function addGoalAssignee(
  db: SupabaseClient, goalId: string, userId: string, assignedBy: string, orgId: string
) {
  const { data, error } = await db
    .from('goal_assignees')
    .insert({ goal_id: goalId, user_id: userId, assigned_by: assignedBy, org_id: orgId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeGoalAssignee(db: SupabaseClient, goalId: string, userId: string) {
  const { error } = await db
    .from('goal_assignees')
    .delete()
    .eq('goal_id', goalId)
    .eq('user_id', userId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export async function createGoalUpdate(
  db: SupabaseClient, params: {
    goalId: string, userId: string, orgId: string,
    progress?: number, status?: string, note?: string,
  }
) {
  const { data, error } = await db
    .from('goal_updates')
    .insert({
      goal_id: params.goalId,
      user_id: params.userId,
      org_id: params.orgId,
      progress: params.progress ?? null,
      status: params.status ?? null,
      note: params.note ?? null,
    })
    .select()
    .single()
  if (error) throw error

  if (params.progress !== undefined) {
    const { data: goal } = await db.from('goals').select('progress_mode').eq('id', params.goalId).single()
    if (goal?.progress_mode === 'manual') {
      await db.from('goals').update({ progress: params.progress }).eq('id', params.goalId)
    }
  }
  return data
}

// ---------------------------------------------------------------------------
// setParent (cycle guard + lock)
// ---------------------------------------------------------------------------

export async function setParent(
  db: SupabaseClient, goalId: string, newParentId: string | null, orgId: string
) {
  // Bug CO / Phase 1 + Concurrency Finding #2: lock the organization row
  // before modifying parent to prevent concurrent cycle creation. If the
  // lock fails we MUST fail-closed (return 500) — proceeding best-effort
  // is a classic TOCTOU race that lets two concurrent setParent calls both
  // mutate parent_goal_id and produce a cycle that survives the trigger.
  const { data: lockId, error: lockErr } = await db.rpc('lock_organization_row' as any, { p_org_id: orgId })
  if (lockErr) {
    logger.with('err', lockErr).with('orgId', orgId).error('setParent: org lock failed')
    throw new Error('Could not acquire organization lock; please retry')
  }
  if (!lockId) {
    throw new Error('Organization not found')
  }

  // Optimistic concurrency: only update if the goal still belongs to this org
  // and the current parent differs from the desired new parent.
  const { data, error } = await db
    .from('goals')
    .update({ parent_goal_id: newParentId })
    .eq('id', goalId)
    .eq('org_id', orgId)
    .neq('parent_goal_id', newParentId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Links (JIRA / GitHub work items)
// ---------------------------------------------------------------------------

/**
 * Determine the link type and provider from a JIRA or GitHub URL.
 * Returns parsed data suitable for insertion into `goal_links`.
 */
export interface ParsedLink {
  provider: 'jira' | 'github'
  linkType: 'issue' | 'pr'
  externalId: string
  externalKey: string
  externalUrl: string
  title: string
  state: string | null
  isDone: boolean
}

/**
 * Best-effort GraphQL `node_id` enrichment for GitHub links. Falls back to
 * the stable `<owner>/<repo>#<n>` string when the user has no GitHub token
 * connected or the API errors out. Webhooks always write the true
 * immutable `node_id`; the URL form is a usable backup.
 */
async function fetchGithubNodeId(
  userId: string, owner: string, repo: string, number: number, type: 'pr' | 'issue'
): Promise<string | null> {
  try {
    const { getGithubClient } = await import('../lib/githubAdapter.js')
    const client = await getGithubClient(userId).catch(() => null)
    if (!client) return null
    // REST canonical id is "owner/repo#NN" but GraphQL expects a databaseId number
    // — fetch by repo+number instead.
    const r = await client.graphql(
      `query($owner: String!, $repo: String!, $number: Int!) {
         repository(owner: $owner, name: $repo) {
           ${type === 'pr' ? 'pullRequest(number: $number) { id databaseId number }' : 'issue(number: $number) { id databaseId number }'}
         }
       }`,
      { owner, repo, number },
    ) as { repository?: { [k: string]: any } | null } | null
    const node = r?.repository?.[type === 'pr' ? 'pullRequest' : 'issue']
    return node?.id ?? null
  } catch (err) {
    logger.with('err', err).with('userId', userId).warn('fetchGithubNodeId failed')
    return null
  }
}

export async function parseLinkUrl(url: string): Promise<ParsedLink> {
  const trimmed = url.trim()

  // GitHub: /<owner>/<repo>/pull/<n>
  // The immutable GraphQL node_id is required for webhook routing, but it
  // isn't accessible from a URL alone. We synthesise a stable identifier
  // `<owner>/<repo>#<n>` (Bug-fix: same as external_key) — webhooks enrich
  // this with the real node_id on first event. Repo renames/transfers
  // are handled by re-matching on PR/issue number via the title fallback.
  const prMatch = trimmed.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/i)
  if (prMatch) {
    const [, owner, repo, n] = prMatch
    const stable = `${owner}/${repo}#${n}`
    return {
      provider: 'github',
      linkType: 'pr',
      externalId: stable,
      externalKey: stable,
      externalUrl: trimmed,
      title: `PR ${owner}/${repo}#${n}`,
      state: null,
      isDone: false,
    }
  }

  // GitHub: /<owner>/<repo>/issues/<n>
  const issueMatch = trimmed.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/i)
  if (issueMatch) {
    const [, owner, repo, n] = issueMatch
    const stable = `${owner}/${repo}#${n}`
    return {
      provider: 'github',
      linkType: 'issue',
      externalId: stable,
      externalKey: stable,
      externalUrl: trimmed,
      title: `Issue ${owner}/${repo}#${n}`,
      state: null,
      isDone: false,
    }
  }

  // JIRA: /browse/KEY-123 (with or without domain)
  const jiraMatch = trimmed.match(/^(?:https?:\/\/[\w.-]+\.atlassian\.net)?\/browse\/([A-Z][A-Z0-9_]+-\d+)/i)
  if (jiraMatch) {
    const key = jiraMatch[1].toUpperCase()
    const domainMatch = trimmed.match(/https?:\/\/([\w.-]+\.atlassian\.net)/i)
    const externalUrl = domainMatch
      ? trimmed
      : `https://example.atlassian.net/browse/${key}`
    return {
      provider: 'jira',
      linkType: 'issue',
      externalId: key, // numeric id not available; webhooks will enrich
      externalKey: key,
      externalUrl,
      title: key,
      state: null,
      isDone: false,
    }
  }

  // Bare JIRA key like PROJ-123
  const bareKeyMatch = trimmed.match(/^([A-Z][A-Z0-9_]+-\d+)$/i)
  if (bareKeyMatch) {
    const key = bareKeyMatch[1].toUpperCase()
    return {
      provider: 'jira',
      linkType: 'issue',
      externalId: key,
      externalKey: key,
      externalUrl: `https://example.atlassian.net/browse/${key}`,
      title: key,
      state: null,
      isDone: false,
    }
  }

  throw new Error(`Unrecognized work item URL or key: ${url}`)
}

/**
 * Create a goal link. If the URL parses to JIRA and the user has a JIRA
 * integration connected, we attempt to fetch the current issue state to fill
 * `state` and `is_done` up front. Best-effort: on any JIRA error we still
 * create the link with what we have.
 */
export async function addLink(
  db: SupabaseClient, goalId: string, params: {
    url: string
    label?: string | null
    weight?: number
    userId: string
    orgId: string
  }
) {
  const parsed = await parseLinkUrl(params.url)
  const linkType = parsed.linkType

  // Best-effort enrichment via provider APIs
  let isDone = parsed.isDone
  let state: string | null = parsed.state
  let title: string = parsed.title
  let externalId = parsed.externalId
  let metadata: Record<string, any> | null = null

  if (parsed.provider === 'jira') {
    try {
      const { getJiraClient } = await import('../lib/jiraAdapter.js')
      const client = await getJiraClient(params.userId).catch(() => null)
      if (client) {
        const issue: any = await client.call('GET', `/rest/api/3/issue/${encodeURIComponent(parsed.externalKey)}?fields=status,summary`)
        if (issue && issue.id) {
          externalId = String(issue.id) // upgrade to immutable numeric id
          if (issue.fields?.summary) title = String(issue.fields.summary)
          const statusCategory = issue.fields?.status?.statusCategory?.key
          if (statusCategory) {
            isDone = statusCategory === 'done'
            state = String(issue.fields?.status?.name ?? statusCategory)
          }
        }
      }
    } catch (err) {
      logger.with('err', err).with('userId', params.userId).warn('addLink: jira enrichment failed')
    }
  } else if (parsed.provider === 'github') {
    // Try to upgrade to the GraphQL node_id (immutable across renames)
    try {
      const m = parsed.externalKey.match(/^([^/]+)\/([^#]+)#(\d+)$/)
      if (m) {
        const [, owner, repo, nStr] = m
        const nodeId = await fetchGithubNodeId(
          params.userId, owner, repo, parseInt(nStr, 10), parsed.linkType as 'pr' | 'issue',
        )
        if (nodeId) {
          metadata = { ...(metadata ?? {}), node_id: nodeId, source: 'graphql-enrichment' }
        }
      }
    } catch (err) {
      logger.with('err', err).with('userId', params.userId).warn('addLink: github enrichment failed')
    }
  }

  const { data, error } = await db
    .from('goal_links')
    .insert({
      goal_id: goalId,
      org_id: params.orgId,
      provider: parsed.provider,
      link_type: linkType,
      external_id: externalId,
      external_key: parsed.externalKey,
      external_url: parsed.externalUrl,
      title: params.label || title,
      state,
      is_done: isDone,
      weight: params.weight ?? 1,
      created_by: params.userId,
      metadata,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeLink(db: SupabaseClient, linkId: string) {
  const { error } = await db.from('goal_links').delete().eq('id', linkId)
  if (error) throw error
}

export async function listLinks(db: SupabaseClient, goalId: string) {
  const { data, error } = await db
    .from('goal_links')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
