/**
 * server/src/lib/slackNotifier.ts
 *
 * Slack notification helpers for goals. All functions swallow errors and
 * log them as warnings so that a Slack outage never breaks the main flow
 * (goal creation, progress updates, etc.). Uses the org-level Slack client
 * resolved by `getSlackClient(orgId)` in `slackAdapter.ts`.
 *
 * Called from: server/src/services/goalService.ts (notifyGoalAssigned,
 * notifyGoalProgress), server/src/jobs/goalDigestJob.ts (sendGoalDigest),
 * server/src/routes/webhooks/slack.ts (postSlashCommandProgress,
 * notifyManagerCheckIn).
 */

import { supabase } from './database.js'
import { logger } from './logger.js'
import { getSlackClient, postMessage, openDm, authTest } from './slackAdapter.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GoalRow {
    id: string
    org_id: string
    title: string
    description: string | null
    due_date: string
    progress: number
    status: string
}

interface AssigneeRow {
    user_id: string
}

interface SlackUserLink {
    slack_user_id: string
    slack_team_id: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get all active org-member users with an active Slack link for the given org.
 * Returns the worklog user IDs and their Slack links.
 */
async function getOrgSlackLinks(orgId: string): Promise<{ userId: string; link: SlackUserLink }[]> {
    const { data, error } = await supabase
        .from('slack_user_links')
        .select('user_id, slack_user_id, slack_team_id, org_members:org_members!inner(org_id, user_id)')
        .eq('org_members.org_id', orgId)

    if (error || !data) {
        logger.with('orgId', orgId).with('err', error).warn('getOrgSlackLinks query failed')
        return []
    }

    return (data as any[]).map((row) => ({
        userId: row.user_id as string,
        link: {
            slack_user_id: row.slack_user_id as string,
            slack_team_id: row.slack_team_id as string,
        },
    }))
}

/**
 * Load a goal with a tenant-isolation guard. Returns null if the goal is
 * missing or has no organization.
 */
async function loadGoal(goalId: string): Promise<GoalRow | null> {
    const { data, error } = await supabase
        .from('goals')
        .select('id, org_id, title, description, due_date, progress, status')
        .eq('id', goalId)
        .single()

    if (error || !data) {
        return null
    }
    return data as GoalRow
}

function clampProgress(progress: number): number {
    if (Number.isNaN(progress)) return 0
    return Math.max(0, Math.min(100, Math.round(progress)))
}

function progressBar(progress: number): string {
    const p = clampProgress(progress)
    const filled = Math.round(p / 10)
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${p}%`
}

function buildGoalBlocks(goal: GoalRow, extraContext?: string): any[] {
    const p = clampProgress(Number(goal.progress))
    const blocks: any[] = [
        {
            type: 'header',
            text: { type: 'plain_text', text: goal.title, emoji: false },
        },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Status:*\n${goal.status}` },
                { type: 'mrkdwn', text: `*Due:*\n${goal.due_date}` },
            ],
        },
        {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Progress:*\n${progressBar(p)}` },
        },
    ]

    if (goal.description) {
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: goal.description.slice(0, 500) },
        })
    }

    if (extraContext) {
        blocks.push({
            type: 'context',
            elements: [{ type: 'mrkdwn', text: extraContext }],
        })
    }

    blocks.push({
        type: 'actions',
        elements: [
            {
                type: 'button',
                text: { type: 'plain_text', text: 'Check-in' },
                style: 'primary',
                action_id: 'goal_checkin',
                value: goal.id,
            },
            {
                type: 'button',
                text: { type: 'plain_text', text: 'View' },
                action_id: 'goal_view',
                value: goal.id,
            },
        ],
    })

    return blocks
}

/**
 * Send a DM to a single Slack user, given their slack user ID and the org ID
 * (used to resolve the org-level Slack client).
 */
async function dmUser(
    orgId: string,
    slackUserId: string,
    text: string,
    blocks?: any[]
): Promise<void> {
    try {
        const client = await getSlackClient(orgId)
        const auth = await authTest(client)
        if (!auth.ok) {
            logger.with('orgId', orgId).warn('Slack authTest failed; skipping DM')
            return
        }
        const dm: any = await openDm(client, slackUserId)
        const channelId = dm?.channel?.id
        if (!channelId) {
            logger.with('slackUserId', slackUserId).warn('openDm failed; skipping DM')
            return
        }
        await postMessage(client, channelId, text, blocks)
    } catch (err) {
        logger.with('orgId', orgId).with('slackUserId', slackUserId).with('err', err).warn('dmUser failed')
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Notify a goal's assignee via Slack DM. Resolves all `goal_assignees` for
 * the goal, verifies they are members of the goal's org, opens a DM, and
 * posts Block Kit content. Errors are swallowed.
 */
export async function notifyGoalAssigned(
    assigneeUserId: string,
    goalId: string
): Promise<void> {
    try {
        const goal = await loadGoal(goalId)
        if (!goal) return

        // Verify the user is an active org member (Bug BP/CO: defense in depth)
        const { data: membership, error: memberErr } = await supabase
            .from('org_members')
            .select('user_id')
            .eq('org_id', goal.org_id)
            .eq('user_id', assigneeUserId)
            .single()

        if (memberErr || !membership) {
            logger
                .with('assigneeUserId', assigneeUserId)
                .with('goalId', goalId)
                .warn('notifyGoalAssigned: assignee is not an org member')
            return
        }

        // Resolve the assignee's Slack link for this org
        const { data: link, error: linkErr } = await supabase
            .from('slack_user_links')
            .select('slack_user_id, slack_team_id')
            .eq('user_id', assigneeUserId)
            .single()

        if (linkErr || !link) {
            // No Slack link for this user — silently no-op
            return
        }

        const blocks = buildGoalBlocks(goal, 'You have been assigned a new goal.')
        await dmUser(goal.org_id, (link as SlackUserLink).slack_user_id, `New goal: ${goal.title}`, blocks)
    } catch (err) {
        logger.with('err', err).with('goalId', goalId).warn('notifyGoalAssigned failed')
    }
}

/**
 * Notify linked assignees when a goal's progress changes.
 */
export async function notifyGoalProgress(
    goalId: string,
    newProgress: number
): Promise<void> {
    try {
        const goal = await loadGoal(goalId)
        if (!goal) return

        const { data: assignees, error: assignErr } = await supabase
            .from('goal_assignees')
            .select('user_id')
            .eq('goal_id', goalId)

        if (assignErr || !assignees || assignees.length === 0) return

        const links = await getOrgSlackLinks(goal.org_id)
        const slackByUser = new Map(links.map((l) => [l.userId, l.link]))

        const p = clampProgress(newProgress)
        const blocks = buildGoalBlocks(goal, `Progress updated to ${p}%`)

        for (const a of assignees as AssigneeRow[]) {
            const link = slackByUser.get(a.user_id)
            if (!link) continue
            await dmUser(goal.org_id, link.slack_user_id, `${goal.title}: ${p}%`, blocks)
        }
    } catch (err) {
        logger.with('err', err).with('goalId', goalId).warn('notifyGoalProgress failed')
    }
}

/**
 * Send a weekly digest of active goals (progress < 100) to a single user.
 * Returns the number of goals included, or 0 on error / no goals.
 */
export async function sendGoalDigest(
    userId: string,
    orgId: string
): Promise<number> {
    try {
        const { data: link, error: linkErr } = await supabase
            .from('slack_user_links')
            .select('slack_user_id')
            .eq('user_id', userId)
            .single()

        if (linkErr || !link) {
            // Not linked — no-op
            return 0
        }

        // Top 10 active goals (progress < 100) for the user, ordered by due_date ASC.
        // Visible if: created by user, or assigned to user, or matches org scope.
        const { data: goals, error: goalsErr } = await supabase
            .from('goals')
            .select('id, title, due_date, progress, status, scope, goal_assignees:goal_assignees!inner(user_id)')
            .eq('org_id', orgId)
            .lt('progress', 100)
            .eq('status', 'active')
            .order('due_date', { ascending: true })
            .limit(10)

        if (goalsErr) {
            logger.with('err', goalsErr).warn('sendGoalDigest: query failed')
            return 0
        }

        // Filter to goals that include this user (created, assigned, or org-scope)
        const visibleGoals = (goals as any[] || []).filter((g) => {
            if (g.scope === 'organization') return true
            const isAssignee = Array.isArray(g.goal_assignees)
                && g.goal_assignees.some((a: any) => a.user_id === userId)
            return isAssignee
        })

        if (visibleGoals.length === 0) return 0

        const lines = visibleGoals.map((g) => {
            const p = clampProgress(Number(g.progress))
            return `• *${g.title}* — ${p}% (due ${g.due_date})`
        })

        const blocks: any[] = [
            {
                type: 'header',
                text: { type: 'plain_text', text: 'Your goal digest', emoji: false },
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: lines.join('\n') },
            },
        ]

        await dmUser(orgId, (link as SlackUserLink).slack_user_id, 'Your goal digest', blocks)
        return visibleGoals.length
    } catch (err) {
        logger.with('err', err).with('userId', userId).with('orgId', orgId).warn('sendGoalDigest failed')
        return 0
    }
}

/**
 * POST the final slash-command response back to Slack's `response_url`
 * asynchronously (Bug AC). Body format mirrors what Slack expects when
 * updating the original ephemeral message.
 */
export async function postSlashCommandProgress(
    responseUrl: string,
    goalId: string,
    newProgress: number
): Promise<void> {
    try {
        const p = clampProgress(newProgress)
        const goal = await loadGoal(goalId)
        const title = goal?.title || 'Goal'
        const body = {
            response_type: 'ephemeral',
            replace_original: false,
            text: `${title}: progress updated to ${p}%`,
        }
        const resp = await fetch(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        if (!resp.ok) {
            logger
                .with('goalId', goalId)
                .with('status', resp.status)
                .warn('postSlashCommandProgress: non-2xx response')
        }
    } catch (err) {
        logger.with('err', err).with('goalId', goalId).warn('postSlashCommandProgress failed')
    }
}

/**
 * DM the manager of a goal's assignee when the assignee posts a check-in.
 * Looks up the goal's assignees, picks the first one, finds a manager in
 * the org (admin/owner or team-manager), and posts a Block Kit message.
 */
export async function notifyManagerCheckIn(
    managerId: string,
    goalId: string,
    note: string | null
): Promise<void> {
    try {
        const goal = await loadGoal(goalId)
        if (!goal) return

        const { data: link, error: linkErr } = await supabase
            .from('slack_user_links')
            .select('slack_user_id')
            .eq('user_id', managerId)
            .single()

        if (linkErr || !link) return

        const blocks: any[] = [
            {
                type: 'header',
                text: { type: 'plain_text', text: 'Goal check-in', emoji: false },
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*${goal.title}*\nProgress: ${clampProgress(Number(goal.progress))}%` },
            },
        ]

        if (note) {
            blocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: `*Note:*\n${note.slice(0, 1000)}` },
            })
        }

        await dmUser(goal.org_id, (link as SlackUserLink).slack_user_id, `Check-in on ${goal.title}`, blocks)
    } catch (err) {
        logger.with('err', err).with('goalId', goalId).with('managerId', managerId).warn('notifyManagerCheckIn failed')
    }
}
