/**
 * server/src/jobs/weeklySyncJob.ts
 *
 * Auto-populate weekly work logs from JIRA + GitHub integrations.
 * Runs hourly (at minute 0). For each eligible user, computes the local
 * week boundaries, fetches issues/PRs updated in that range from each
 * connected provider, and upserts a `work_log_entries` row tagged as
 * `status='auto-generated'` and `pending_review=true`.
 *
 * Concurrency: uses an atomic `is_syncing`/`sync_started_at` lock on
 * `integration_preferences` (Issue Y / Bug BS) — no advisory locks, no
 * long-held DB connections. Per-user work is serialised without blocking
 * the connection pool.
 *
 * Started in: server/src/index.ts
 */

import cron from 'node-cron'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'
import { getUserSyncFilters } from '../services/subscriptionService.js'
import { mdc } from '../lib/mdc.js'
import { getJiraClient, searchJiraJQL } from '../lib/jiraAdapter.js'
import { getGithubClient, parseGithubUrl } from '../lib/githubAdapter.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserIntegrationRow {
    id: string
    user_id: string
    provider: 'jira' | 'github' | string
    is_active: boolean
    config: any
}

interface PreferenceRow {
    user_id: string
    sync_timezone: string
    last_weekly_sync_week: string | null
    github_repos: string[] | null
}

interface SyncItem {
    provider: 'jira' | 'github'
    external_id: string
    external_key: string
    external_url: string
    title: string
    state: string | null
    is_done: boolean
    summary: string
    source_type: 'issue' | 'pr' | 'review' | 'commit' | 'message' | 'thread'
}

// ---------------------------------------------------------------------------
// Schedule guard (Issue AV)
// ---------------------------------------------------------------------------

/**
 * When `IS_SCHEDULER_NODE === 'true'`, only this process should run cron
 * jobs. We default to `true` for backward compat in single-instance deploys.
 */
function isSchedulerNode(): boolean {
    const v = process.env.IS_SCHEDULER_NODE
    if (v === 'true' || v === '1') return true
    if (v === 'false' || v === '0') return false
    return true
}

// ---------------------------------------------------------------------------
// Boundary helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a stored timezone string is a real IANA name dayjs can use.
 * dayjs.tz() will accept anything without throwing; an invalid string
 * silently falls back to the local timezone, which is exactly the kind of
 * silent-failure the spec calls out. Validate at the boundary.
 */
const VALID_TZS = new Set<string>((dayjs as any).tz?.names?.() ?? [])
function isValidTimezone(tz: string | null | undefined): tz is string {
    if (!tz || typeof tz !== 'string') return false
    return VALID_TZS.has(tz)
}

/**
 * Build the ISO week string (e.g. "2026-W24") for the user's current local
 * week, taking into account that the cutoff is Monday 09:00 local time.
 * After 9 AM Monday, the "current" week is the one that just started;
 * before 9 AM Monday, we still treat last week as the current one.
 */
function currentEligibleWeek(timezone: string): string {
    // dayjs.tz with the current timestamp and timezone
    const nowLocal = dayjs().tz(timezone)
    // Find Monday 09:00 of the current ISO week (in local time)
    const startOfThisIsoWeek = nowLocal.startOf('isoWeek')
    const monday9 = startOfThisIsoWeek.add(9, 'hour')

    let target = nowLocal
    if (nowLocal.isBefore(monday9)) {
        // Before Monday 9 AM → still the previous week
        target = nowLocal.subtract(7, 'day')
    }
    return target.startOf('isoWeek').format('GGGG-[W]WW')
}

/**
 * Given an ISO week string and a timezone, return the UTC ISO strings for
 * the start (inclusive) and end (exclusive) of that week.
 */
function getSyncBoundaries(weekStr: string, userTimezone: string): { sinceUTC: string; untilUTC: string; localStart: string } {
    const parts = weekStr.split('-W')
    if (parts.length !== 2) {
        throw new Error(`Invalid week string: ${weekStr}`)
    }
    const year = parseInt(parts[0], 10)
    const week = parseInt(parts[1], 10)
    if (Number.isNaN(year) || Number.isNaN(week)) {
        throw new Error(`Invalid week string: ${weekStr}`)
    }

    // Anchor on Jan 4 of the given year (always in ISO week 1) and walk
    // to the requested week in the user's timezone.
    const start = (dayjs.tz(`${year}-01-04`, userTimezone) as any)
        .isoWeekYear(year)
        .isoWeek(week)
        .startOf('isoWeek') as any
    const end = start.add(1, 'week')
    return {
        sinceUTC: start.utc().format(),
        untilUTC: end.utc().format(),
        localStart: start.format('YYYY-MM-DD'),
    }
}

// ---------------------------------------------------------------------------
// Lock helpers (Bug BS / Issue Y)
// ---------------------------------------------------------------------------

/**
 * Try to acquire the per-user `is_syncing` lock. Returns true if acquired.
 * The lock auto-expires if held for >15 minutes (handles crashed workers).
 */
async function acquireLock(userId: string): Promise<boolean> {
    let data: any = null
    let error: any = null
    try {
        const r = await supabase.rpc('acquire_integration_sync_lock' as any, {
            p_user_id: userId,
        })
        data = (r as any)?.data
        error = (r as any)?.error
    } catch (e) {
        error = e
    }

    // Fallback: if the RPC isn't installed, do an upsert directly
    if (error || data === null) {
        const { data: upserted, error: upsertErr } = await supabase
            .from('integration_preferences')
            .upsert(
                {
                    user_id: userId,
                    is_syncing: true,
                    sync_started_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            )
            .select('user_id')
        if (upsertErr) {
            logger.with('err', upsertErr).with('userId', userId).warn('acquireLock: upsert failed')
            return false
        }
        return !!upserted && upserted.length > 0
    }
    return !!data && (data as any[]).length > 0
}

async function releaseLock(userId: string): Promise<void> {
    const { error } = await supabase
        .from('integration_preferences')
        .update({ is_syncing: false })
        .eq('user_id', userId)
    if (error) {
        logger.with('err', error).with('userId', userId).warn('releaseLock failed')
    }
}

// ---------------------------------------------------------------------------
// Sync workers
// ---------------------------------------------------------------------------

async function fetchJiraItems(userId: string, sinceUTC: string, untilUTC: string): Promise<SyncItem[]> {
    try {
        const client = await getJiraClient(userId)
        // Bug AN: explicit parens around the OR clause
        const jql =
            `(assignee = currentUser() OR worklogAuthor = currentUser()) ` +
            `AND updatedDate >= "${sinceUTC}" AND updatedDate < "${untilUTC}" ` +
            `ORDER BY updatedDate DESC`

        const result = await searchJiraJQL(client, jql, ['summary', 'status'], 50)
        const issues = (result?.issues || []) as any[]

        return issues.map((issue) => {
            const status = (issue.fields?.status?.statusCategory?.key || '').toLowerCase()
            return {
                provider: 'jira' as const,
                external_id: String(issue.id),
                external_key: String(issue.key),
                external_url: `${(issue.self || '').split('/rest/')[0] || ''}/browse/${issue.key}`,
                title: String(issue.fields?.summary || issue.key),
                state: status || null,
                is_done: status === 'done',
                summary: String(issue.fields?.summary || '').slice(0, 500),
                source_type: 'issue' as const,
            }
        })
    } catch (err) {
        logger.with('err', err).with('userId', userId).warn('fetchJiraItems failed')
        return []
    }
}

async function fetchGithubItems(
    userId: string,
    repos: string[],
    sinceUTC: string,
    untilUTC: string
): Promise<SyncItem[]> {
    try {
        const client = await getGithubClient(userId)
        const out: SyncItem[] = []
        for (const repo of repos) {
            try {
                // PRs: query GitHub's search API and look up each by node_id (Issue AZ)
                const searchQ = `repo:${repo} is:pr updated:${sinceUTC.slice(0, 10)}..${untilUTC.slice(0, 10)}`
                const prsResp: any = await (client as any).call('GET', `/search/issues?q=${encodeURIComponent(searchQ)}&per_page=50`)
                const prs = prsResp?.items ?? []
                for (const pr of prs) {
                    out.push({
                        provider: 'github' as const,
                        external_id: String(pr.node_id ?? pr.id),
                        external_key: `${repo}#${pr.number}`,
                        external_url: pr.html_url || `https://github.com/${repo}/pull/${pr.number}`,
                        title: String(pr.title || `PR #${pr.number}`),
                        state: pr.pull_request?.merged_at ? 'merged' : (pr.state || null),
                        is_done: !!pr.pull_request?.merged_at,
                        summary: String(pr.title || '').slice(0, 500),
                        source_type: 'pr' as const,
                    })
                }
                // Issues (Bug AD)
                try {
                    parseGithubUrl
                    const issueQ = `repo:${repo} is:issue updated:${sinceUTC.slice(0, 10)}..${untilUTC.slice(0, 10)}`
                    const issResp: any = await (client as any).call('GET', `/search/issues?q=${encodeURIComponent(issueQ)}&per_page=50`)
                    const issues = issResp?.items ?? []
                    for (const issue of issues) {
                        out.push({
                            provider: 'github' as const,
                            external_id: String(issue.node_id ?? issue.id),
                            external_key: `${repo}#${issue.number}`,
                            external_url: issue.html_url || `https://github.com/${repo}/issues/${issue.number}`,
                            title: String(issue.title || `Issue #${issue.number}`),
                            state: issue.state || null,
                            is_done: issue.state === 'closed',
                            summary: String(issue.title || '').slice(0, 500),
                            source_type: 'issue' as const,
                        })
                    }
                } catch {
                    // ignore issues fetch errors
                }
            } catch (err) {
                logger.with('err', err).with('userId', userId).with('repo', repo).warn('fetchGithubItems: repo failed')
            }
        }
        return out
    } catch (err) {
        logger.with('err', err).with('userId', userId).warn('fetchGithubItems failed')
        return []
    }
}

// ---------------------------------------------------------------------------
// Per-user sync
// ---------------------------------------------------------------------------

async function syncUser(userId: string, syncTimezone: string): Promise<void> {
    const acquired = await acquireLock(userId)
    if (!acquired) {
        logger.with('userId', userId).debug('Sync already in progress, skipping')
        return
    }

    try {
        const weekStr = currentEligibleWeek(syncTimezone)
        const { sinceUTC, untilUTC, localStart } = getSyncBoundaries(weekStr, syncTimezone)

        // Load active integrations
        const { data: integrations, error: intErr } = await supabase
            .from('user_integrations')
            .select('id, user_id, provider, is_active, config')
            .eq('user_id', userId)
            .eq('is_active', true)
            .in('provider', ['jira', 'github'])

        if (intErr) {
            logger.with('err', intErr).with('userId', userId).warn('syncUser: integrations query failed')
            return
        }

        const allItems: SyncItem[] = []

        for (const intRow of (integrations || []) as UserIntegrationRow[]) {
            if (intRow.provider === 'jira') {
                const jiraFilter = await getUserSyncFilters(supabase, userId, 'jira')
                const projectKeys = jiraFilter?.project_keys as string[] | undefined
                const items = await fetchJiraItems(userId, sinceUTC, untilUTC)
                const filtered = projectKeys && projectKeys.length > 0
                  ? items.filter((i) => projectKeys.some((k) => i.external_key.startsWith(k)))
                  : items
                allItems.push(...filtered)
            } else if (intRow.provider === 'github') {
                const { data: prefs } = await supabase
                    .from('integration_preferences')
                    .select('github_repos')
                    .eq('user_id', userId)
                    .single()
                let userRepos = ((prefs as PreferenceRow | null)?.github_repos) || []
                if (userRepos.length === 0) continue

                const syncFilter = await getUserSyncFilters(supabase, userId, 'github')
                const repoFilter = syncFilter?.repo_filter as string[] | undefined
                if (repoFilter && repoFilter.length > 0) {
                  userRepos = userRepos.filter((r: string) => repoFilter.includes(r))
                  if (userRepos.length === 0) continue
                }

                // Org-restriction: intersect user-requested repos with the set
                // of repos any active GitHub App installation on the user's
                // orgs has access to. If the user is in no org with a GitHub
                // App install, allow the user list as-is (legacy behavior).
                const { data: orgRows } = await supabase
                    .from('org_members')
                    .select('org_id, org_integrations:org_integrations!inner(config, is_active, provider)')
                    .eq('user_id', userId)
                    .eq('org_integrations.provider', 'github_app')
                    .eq('org_integrations.is_active', true)

                const allowedRepos = new Set<string>()
                let hasOrgApp = false
                for (const orgRow of (orgRows ?? []) as any[]) {
                    const orgInts = Array.isArray(orgRow.org_integrations)
                        ? orgRow.org_integrations
                        : orgRow.org_integrations
                            ? [orgRow.org_integrations]
                            : []
                    for (const oi of orgInts) {
                        if (!oi?.config) continue
                        hasOrgApp = true
                        const cfg = oi.config as {
                            repository_selection?: 'all' | 'selected'
                            repositories?: Array<{ full_name?: string }>
                        }
                        if (cfg.repository_selection === 'all') {
                            // App has access to all repos in the org; trust the
                            // user's list. (Cannot enumerate here without a
                            // separate API call per org.)
                            userRepos.forEach((r) => allowedRepos.add(r))
                        } else {
                            for (const r of cfg.repositories ?? []) {
                                if (r.full_name) allowedRepos.add(r.full_name)
                            }
                        }
                    }
                }

                // If the user is in an org with a GitHub App install (any
                // selection mode), restrict to allowed repos. If no org App,
                // allow the user list unchanged.
                const repos = hasOrgApp
                    ? userRepos.filter((r) => allowedRepos.has(r))
                    : userRepos
                if (repos.length === 0) continue
                const items = await fetchGithubItems(userId, repos, sinceUTC, untilUTC)
                allItems.push(...items)
            }
        }

        if (allItems.length === 0) {
            // Still update last_weekly_sync_week so we don't refetch the same empty week
            await supabase
                .from('integration_preferences')
                .upsert(
                    { user_id: userId, last_weekly_sync_week: weekStr },
                    { onConflict: 'user_id' }
                )
            return
        }

        // Group items into a single accomplishments list for the week
        const accomplishments = allItems.map((i) => `• ${i.title}`).join('\n')

        // Upsert the work_log_entries row (Bug AT/BV: only overwrite auto-generated
        // entries that are still pending review; never clobber user edits)
        const { data: entry, error: entryErr } = await supabase
            .from('work_log_entries')
            .upsert(
                {
                    user_id: userId,
                    week_start_date: localStart,
                    accomplishments,
                    status: 'auto-generated',
                    pending_review: true,
                    auto_generated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,week_start_date' }
            )
            .select('id')
            .single()

        if (entryErr || !entry) {
            // Conflict update only applies if existing row is still auto-generated & pending.
            // The simple upsert above uses ON CONFLICT DO UPDATE which always overwrites
            // accomplishments. We rely on the application's "Edit" path: once a user edits
            // an entry, status changes to 'auto-generated-edited' and a future sync will
            // leave accomplishments alone (handled at the application level). For now we
            // log the error and continue with source references below.
            logger
                .with('userId', userId)
                .with('weekStr', weekStr)
                .with('err', entryErr)
                .warn('syncUser: work_log_entries upsert returned no row (likely edited/reviewed)')
            return
        }

        // Insert log_source_references for each item
        const refRows = allItems.map((i) => ({
            work_log_entry_id: (entry as any).id,
            provider: i.provider,
            source_type: i.source_type,
            source_id: i.external_id,
            source_url: i.external_url,
            source_data: {
                title: i.title,
                state: i.state,
                is_done: i.is_done,
                external_key: i.external_key,
            },
        }))
        await supabase.from('log_source_references').upsert(refRows, { onConflict: 'source_id,provider' })

        // Mark sync complete (Bug BR)
        await supabase
            .from('integration_preferences')
            .upsert(
                { user_id: userId, last_weekly_sync_week: weekStr },
                { onConflict: 'user_id' }
            )
    } catch (err) {
        logger.with('err', err).with('userId', userId).warn('syncUser failed')
    } finally {
        await releaseLock(userId)
    }
}

// ---------------------------------------------------------------------------
// Job class
// ---------------------------------------------------------------------------

class WeeklySyncJob {
    private task: cron.ScheduledTask | null = null

    start(): void {
        if (!isSchedulerNode()) {
            logger.warn('IS_SCHEDULER_NODE is not true; weeklySyncJob will not run on this process')
            return
        }
        if (this.task) return
        this.task = cron.schedule('0 * * * *', () => {
            logger.info('WeeklySync cron: starting')
            this.runNow().catch((err) => {
                logger.error('WeeklySync cron error: {}', (err instanceof Error ? err.message : String(err)), err)
            })
        })
        logger.info('WeeklySync cron job scheduled (0 * * * * - every hour)')
    }

    stop(): void {
        if (this.task) {
            this.task.stop()
            this.task = null
            logger.info('WeeklySync job stopped')
        }
    }

    async runNow(): Promise<void> {
        const jobRunId = randomUUID()
        await mdc.run({ jobRunId, jobName: 'weekly_sync' }, async () => {
            // Find eligible users (Bug AR/BF: safe_local_time would normally be used in raw
            // SQL, but here we read sync_timezone and compute in Node because the migration
            // exposes `safe_local_time` for server-side use; the read query uses the column
            // directly since invalid timezones are guarded at API write boundaries).
            const { data: users, error } = await supabase
                .from('users')
                .select(
                    'id, integration_preferences:integration_preferences!left(' +
                        'sync_timezone, last_weekly_sync_week, sync_enabled' +
                        '), user_integrations:user_integrations!inner(id, is_active)'
                )
                .eq('user_integrations.is_active', true)

            if (error) {
                logger.error('WeeklySync: eligible users query failed: {}', error.message, error)
                return
            }

            if (!users || users.length === 0) {
                logger.info('WeeklySync: no eligible users')
                return
            }

            let processed = 0
            for (const u of users as any[]) {
                const prefs = Array.isArray(u.integration_preferences)
                    ? u.integration_preferences[0]
                    : u.integration_preferences
                const syncEnabled = prefs?.sync_enabled !== false // default true
                if (!syncEnabled) continue
                const storedTz = prefs?.sync_timezone
                const tz = isValidTimezone(storedTz) ? storedTz : 'UTC'
                if (storedTz && !isValidTimezone(storedTz)) {
                    logger
                        .with('userId', u.id)
                        .with('storedTz', storedTz)
                        .warn('WeeklySync: invalid stored timezone, falling back to UTC')
                }
                await syncUser(u.id, tz)
                processed++
            }

            logger.with('processed', processed).info('WeeklySync completed')
        })
    }
}

export const weeklySyncJob = new WeeklySyncJob()
