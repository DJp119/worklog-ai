/**
 * server/src/jobs/goalRollupJob.ts
 *
 * Nightly job that refreshes `goal_links` state from JIRA + GitHub and
 * recomputes goal progress. Runs every night at 02:00 UTC. Per-org loop
 * (Issue AK/AT/AZ): only processes orgs with active goal links, batches
 * JIRA and GitHub queries (50 IDs/request), and only invokes the DB
 * progress recomputation on leaf goals (Issue AH) sorted by UUID (Issue
 * AE/AY) to avoid sibling-node deadlocks.
 *
 * Started in: server/src/index.ts
 */

import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'
import { mdc } from '../lib/mdc.js'
import { getJiraClient, getJiraClientForOrg, searchJiraJQL } from '../lib/jiraAdapter.js'
import { getGithubClient } from '../lib/githubAdapter.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GoalLinkRow {
    id: string
    goal_id: string
    provider: 'jira' | 'github'
    external_id: string
    external_key: string
    external_url: string
    title: string
    state: string | null
    is_done: boolean
    org_id: string
}

interface OrgIntegrationRow {
    id: string
    org_id: string
    provider: string
    is_active: boolean
}

// ---------------------------------------------------------------------------
// Schedule guard
// ---------------------------------------------------------------------------

function isSchedulerNode(): boolean {
    const v = process.env.IS_SCHEDULER_NODE
    if (v === 'true' || v === '1') return true
    if (v === 'false' || v === '0') return false
    return true
}

// ---------------------------------------------------------------------------
// GitHub batch helper (Issue AZ: null node guard)
// ---------------------------------------------------------------------------

interface GithubNodeResult {
    id: string
    databaseId?: number | null
    number?: number | null
    title?: string | null
    url?: string | null
    state?: string | null
    merged?: boolean | null
    closed?: boolean | null
}

/**
 * Issue a single GraphQL `nodes(ids:...)` query to fetch multiple GitHub
 * items in one call. Returns the result of nodes in the same order as the
 * input IDs. Items that fail to resolve (deleted, no access) are returned
 * as `null` so the caller can skip them.
 */
async function batchFetchGithubNodes(
    client: any,
    nodeIds: string[]
): Promise<(GithubNodeResult | null)[]> {
    if (nodeIds.length === 0) return []
    try {
        const query = `
            query BatchNodes($ids: [ID!]!) {
                nodes(ids: $ids) {
                    ... on PullRequest {
                        id databaseId number title url state merged
                    }
                    ... on Issue {
                        id databaseId number title url state closed
                    }
                }
            }
        `
        const resp = await client.graphql(query, { ids: nodeIds })
        const nodes = (resp as any)?.nodes || []
        return nodes as (GithubNodeResult | null)[]
    } catch (err) {
        logger.with('err', err).warn('batchFetchGithubNodes failed')
        return nodeIds.map(() => null)
    }
}

// ---------------------------------------------------------------------------
// JIRA batch helper
// ---------------------------------------------------------------------------

async function batchFetchJiraIssues(
    client: any,
    issueIds: string[]
): Promise<(any | null)[]> {
    if (issueIds.length === 0) return []
    try {
        // JQL supports id IN ( ... ) — 50 max per batch
        const jql = `id IN (${issueIds.join(',')})`
        const result = await searchJiraJQL(client, jql, ['summary', 'status'], issueIds.length)
        const issues = (result?.issues || []) as any[]
        // Build a map by id, then re-order to match the input
        const byId = new Map<string, any>()
        for (const i of issues) byId.set(String(i.id), i)
        return issueIds.map((id) => byId.get(id) || null)
    } catch (err) {
        logger.with('err', err).warn('batchFetchJiraIssues failed')
        return issueIds.map(() => null)
    }
}

// ---------------------------------------------------------------------------
// Per-org processor
// ---------------------------------------------------------------------------

async function refreshOrgLinks(orgId: string): Promise<{ updated: number; skipped: number }> {
    let updated = 0
    let skipped = 0

    // Verify that the org has active org-level integrations for jira/github_app
    // (Issue AK: skip orgs whose integration is inactive)
    const { data: orgInts, error: orgIntErr } = await supabase
        .from('org_integrations')
        .select('id, org_id, provider, is_active')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .in('provider', ['github_app', 'jira'])

    if (orgIntErr) {
        logger.with('err', orgIntErr).with('orgId', orgId).warn('refreshOrgLinks: org_int query failed')
        return { updated: 0, skipped: 0 }
    }

    const activeInt = (orgInts || []) as OrgIntegrationRow[]
    if (activeInt.length === 0) {
        return { updated: 0, skipped: 0 }
    }

    // Load all active goal_links for the org
    const { data: links, error: linkErr } = await supabase
        .from('goal_links')
        .select('id, goal_id, provider, external_id, external_key, external_url, title, state, is_done, org_id')
        .eq('org_id', orgId)

    if (linkErr || !links) {
        logger.with('err', linkErr).with('orgId', orgId).warn('refreshOrgLinks: goal_links query failed')
        return { updated: 0, skipped: 0 }
    }

    // ---- GitHub batched ----
    const ghLinks = (links as GoalLinkRow[]).filter((l) => l.provider === 'github')
    if (ghLinks.length > 0) {
        try {
            const client = await getGithubClient(orgId)
            const ids = ghLinks.map((l) => l.external_id)
            // Batch in chunks of 50
            for (let i = 0; i < ids.length; i += 50) {
                const chunk = ids.slice(i, i + 50)
                const nodes = await batchFetchGithubNodes(client, chunk)
                for (let j = 0; j < chunk.length; j++) {
                    const node = nodes[j]
                    const link = ghLinks[i + j]
                    if (!node) {
                        // Issue AZ: skip null nodes (deleted/inaccessible)
                        logger.with('linkId', link.id).with('externalId', link.external_id).warn('GitHub node is null (deleted or inaccessible)')
                        skipped++
                        continue
                    }
                    const isDone = !!(node.merged || node.closed)
                    const newState = node.merged ? 'merged' : (node.state || null)
                    const updatePayload: any = {
                        is_done: isDone,
                        state: newState,
                    }
                    if (node.title) updatePayload.title = String(node.title).slice(0, 500)
                    if (node.url) updatePayload.external_url = String(node.url)

                    const { error: updErr } = await supabase
                        .from('goal_links')
                        .update(updatePayload)
                        .eq('id', link.id)
                    if (updErr) {
                        logger.with('err', updErr).with('linkId', link.id).warn('Failed to update github link')
                        skipped++
                    } else {
                        updated++
                    }
                }
            }
        } catch (err) {
            logger.with('err', err).with('orgId', orgId).warn('GitHub rollup failed for org')
        }
    }

    // ---- JIRA batched ----
    const jiraLinks = (links as GoalLinkRow[]).filter((l) => l.provider === 'jira')
    if (jiraLinks.length > 0) {
        try {
            // Use org-level client if available, else fall back to first user's
            let client: any
            try {
                client = await getJiraClientForOrg(orgId)
            } catch {
                client = await getJiraClient(jiraLinks[0]?.goal_id ? '' : jiraLinks[0].external_id)
            }
            if (!client) {
                logger.with('orgId', orgId).warn('No JIRA client available for org')
                return { updated, skipped }
            }
            const ids = jiraLinks.map((l) => l.external_id)
            for (let i = 0; i < ids.length; i += 50) {
                const chunk = ids.slice(i, i + 50)
                const issues = await batchFetchJiraIssues(client, chunk)
                for (let j = 0; j < chunk.length; j++) {
                    const issue = issues[j]
                    const link = jiraLinks[i + j]
                    if (!issue) {
                        // 404 / not found — mark as inactive state but keep the row
                        logger.with('linkId', link.id).with('externalId', link.external_id).warn('JIRA issue not found (404)')
                        skipped++
                        continue
                    }
                    const statusCategory = (issue.fields?.status?.statusCategory?.key || '').toLowerCase()
                    const isDone = statusCategory === 'done'
                    const updatePayload: any = {
                        is_done: isDone,
                        state: statusCategory || null,
                    }
                    if (issue.fields?.summary) updatePayload.title = String(issue.fields.summary).slice(0, 500)
                    if (issue.key) updatePayload.external_key = String(issue.key)
                    if (issue.self) {
                        const base = String(issue.self).split('/rest/')[0]
                        updatePayload.external_url = `${base}/browse/${issue.key}`
                    }
                    const { error: updErr } = await supabase
                        .from('goal_links')
                        .update(updatePayload)
                        .eq('id', link.id)
                    if (updErr) {
                        logger.with('err', updErr).with('linkId', link.id).warn('Failed to update jira link')
                        skipped++
                    } else {
                        updated++
                    }
                }
            }
        } catch (err) {
            logger.with('err', err).with('orgId', orgId).warn('JIRA rollup failed for org')
        }
    }

    return { updated, skipped }
}

/**
 * Recompute progress for the given goal IDs via the database function
 * `recompute_goal_progress(goal_id)`. Caller is responsible for passing
 * only leaf goals (Issue AH) in sorted (UUID) order (Issue AE/AY).
 */
async function recomputeLeaves(sortedLeafIds: string[]): Promise<void> {
    for (const id of sortedLeafIds) {
        try {
            const { error } = await supabase.rpc('recompute_goal_progress' as any, { p_goal_id: id })
            if (error) {
                logger.with('err', error).with('goalId', id).warn('recompute_goal_progress failed')
            }
        } catch (err) {
            logger.with('err', err).with('goalId', id).warn('recompute_goal_progress threw')
        }
    }
}

/**
 * Compute the set of leaf goal IDs from a set of impacted IDs. A goal is a
 * leaf if no other impacted goal has it as its parent. The result is sorted
 * by UUID (Issue AE/AY) to ensure deterministic lock acquisition order.
 */
function findLeafGoalIds(impacted: Set<string>, getParent: (_id: string) => Promise<string | null>): Promise<string[]> { // eslint-disable-line no-unused-vars -- _id label in function-type; caller uses real id
    return (async () => {
        const leaves: string[] = []
        for (const id of impacted) {
            const parent = await getParent(id)
            if (parent && impacted.has(parent)) {
                // not a leaf — some other impacted goal is its parent
                continue
            }
            leaves.push(id)
        }
        return leaves.sort()
    })()
}

async function processOrg(orgId: string): Promise<{ updated: number; leaves: number; orgId: string }> {
    const refresh = await refreshOrgLinks(orgId)
    // Recompute progress for every goal that has a link in this org (DB trigger
    // cascades upward). We use the RPC to be safe and we sort by UUID.
    const { data: linkGoals, error: lgErr } = await supabase
        .from('goal_links')
        .select('goal_id')
        .eq('org_id', orgId)

    if (lgErr) {
        logger.with('err', lgErr).with('orgId', orgId).warn('processOrg: linkGoals query failed')
        return { updated: refresh.updated, leaves: 0, orgId }
    }

    const impacted = new Set<string>(
        ((linkGoals || []) as { goal_id: string }[]).map((r) => r.goal_id)
    )
    if (impacted.size === 0) {
        return { updated: refresh.updated, leaves: 0, orgId }
    }

    // Build a parent-id lookup
    const { data: goalsData, error: gErr } = await supabase
        .from('goals')
        .select('id, parent_goal_id')
        .in('id', Array.from(impacted))
    if (gErr || !goalsData) {
        logger.with('err', gErr).with('orgId', orgId).warn('processOrg: goals lookup failed')
        return { updated: refresh.updated, leaves: 0, orgId }
    }
    const parentById = new Map<string, string | null>(
        (goalsData as { id: string; parent_goal_id: string | null }[]).map((g) => [g.id, g.parent_goal_id])
    )

    const leaves = await findLeafGoalIds(impacted, async (id) => parentById.get(id) ?? null)
    await recomputeLeaves(leaves)
    return { updated: refresh.updated, leaves: leaves.length, orgId }
}

// ---------------------------------------------------------------------------
// Job class
// ---------------------------------------------------------------------------

class GoalRollupJob {
    private task: cron.ScheduledTask | null = null

    start(): void {
        if (!isSchedulerNode()) {
            logger.warn('IS_SCHEDULER_NODE is not true; goalRollupJob will not run on this process')
            return
        }
        if (this.task) return
        // Every night at 02:00 UTC
        this.task = cron.schedule('0 2 * * *', () => {
            logger.info('GoalRollup cron: starting')
            this.runNow().catch((err) => {
                logger.error('GoalRollup cron error: {}', (err instanceof Error ? err.message : String(err)), err)
            })
        })
        logger.info('GoalRollup cron job scheduled (0 2 * * * - nightly at 02:00 UTC)')
    }

    stop(): void {
        if (this.task) {
            this.task.stop()
            this.task = null
            logger.info('GoalRollup job stopped')
        }
    }

    async runNow(): Promise<void> {
        const jobRunId = randomUUID()
        await mdc.run({ jobRunId, jobName: 'goal_rollup' }, async () => {
            // Find orgs with active goal_links (Issue AK)
            const { data: orgs, error } = await supabase
                .from('goal_links')
                .select('org_id')
            if (error) {
                logger.error('GoalRollup: org query failed: {}', error.message, error)
                return
            }
            const uniqueOrgIds = Array.from(
                new Set(((orgs || []) as { org_id: string }[]).map((r) => r.org_id))
            )

            if (uniqueOrgIds.length === 0) {
                logger.info('GoalRollup: no orgs with goal links')
                return
            }

            let totalUpdated = 0
            let totalLeaves = 0
            for (const orgId of uniqueOrgIds) {
                try {
                    const res = await processOrg(orgId)
                    totalUpdated += res.updated
                    totalLeaves += res.leaves
                    logger
                        .with('orgId', orgId)
                        .with('updatedLinks', res.updated)
                        .with('recomputedLeaves', res.leaves)
                        .info('GoalRollup: org processed')
                } catch (err) {
                    logger.with('err', err).with('orgId', orgId).warn('GoalRollup: org failed')
                }
            }

            logger
                .with('orgCount', uniqueOrgIds.length)
                .with('totalUpdatedLinks', totalUpdated)
                .with('totalRecomputedLeaves', totalLeaves)
                .info('GoalRollup completed')
        })
    }
}

export const goalRollupJob = new GoalRollupJob()
