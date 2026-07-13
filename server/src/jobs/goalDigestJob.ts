/**
 * server/src/jobs/goalDigestJob.ts
 *
 * Weekly Slack goal-digest job. For each org with an active Slack install
 * and active members, sends a digest DM to each member listing their
 * top-10 active goals with progress < 100, sorted by due_date ASC. Tracks
 * delivery in `integration_sync_logs`.
 *
 * Note: this is intentionally separate from the existing `weeklyDigestJob`
 * (which is the AI Pulse newsletter). This one is goals-only.
 *
 * Started in: server/src/index.ts
 */

import cron from 'node-cron'
import { randomUUID } from 'crypto'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import { supabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'
import { mdc } from '../lib/mdc.js'
import { sendGoalDigest } from '../lib/slackNotifier.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)

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
// Per-org processor
// ---------------------------------------------------------------------------

interface OrgRow {
    id: string
    name: string
}

interface MemberRow {
    user_id: string
}

async function processOrg(org: OrgRow): Promise<{ membersProcessed: number; digestsSent: number }> {
    // Verify Slack is installed and active for this org
    const { data: slackInt, error: intErr } = await supabase
        .from('org_integrations')
        .select('id, is_active, config')
        .eq('org_id', org.id)
        .eq('provider', 'slack')
        .eq('is_active', true)
        .maybeSingle()

    if (intErr || !slackInt) {
        return { membersProcessed: 0, digestsSent: 0 }
    }

    // Respect org digest preferences (config.digest_enabled). Spec line 198
    // calls for per-org digest preferences; default to enabled when absent.
    const cfg = (slackInt as any).config as { digest_enabled?: boolean; digest_day?: string; digest_time_utc?: string } | null
    if (cfg?.digest_enabled === false) {
        return { membersProcessed: 0, digestsSent: 0 }
    }

    // Load active org members
    const { data: members, error: memErr } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('org_id', org.id)

    if (memErr || !members) {
        logger.with('err', memErr).with('orgId', org.id).warn('goalDigest: org_members query failed')
        return { membersProcessed: 0, digestsSent: 0 }
    }

    let digestsSent = 0
    for (const m of members as MemberRow[]) {
        // Per-member try/catch so one failure (rate limit, bot uninstalled,
        // user unsubscribed) does not abort the rest of the org loop.
        let count = 0
        try {
            count = await sendGoalDigest(m.user_id, org.id)
            if (count > 0) digestsSent++
        } catch (err) {
            logger
                .with('err', err)
                .with('userId', m.user_id)
                .with('orgId', org.id)
                .warn('goalDigest: sendGoalDigest failed for member, continuing')
        }

        // Log delivery in integration_sync_logs
        try {
            await supabase.from('integration_sync_logs').insert({
                user_id: m.user_id,
                provider: 'slack',
                sync_type: 'digest',
                status: count > 0 ? 'sent' : 'no_active_goals',
                items_fetched: count,
                items_processed: count,
                items_skipped: 0,
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
            })
        } catch {
            // ignore log-insert failures
        }
    }

    return { membersProcessed: (members as MemberRow[]).length, digestsSent }
}

// ---------------------------------------------------------------------------
// Job class
// ---------------------------------------------------------------------------

class GoalDigestJob {
    private task: cron.ScheduledTask | null = null

    start(): void {
        if (!isSchedulerNode()) {
            logger.warn('IS_SCHEDULER_NODE is not true; goalDigestJob will not run on this process')
            return
        }
        if (this.task) return
        // Every Monday at 09:00 UTC — the per-user local scheduling aspect is
        // approximated by running once on Monday morning. (The plan's
        // "per-user 9 AM local" requires per-user cron entries which are
        // out of scope here; this baseline gives a single weekly blast.)
        this.task = cron.schedule('0 9 * * 1', () => {
            logger.info('GoalDigest cron: starting')
            this.runNow().catch((err) => {
                logger.error('GoalDigest cron error: {}', (err instanceof Error ? err.message : String(err)), err)
            })
        })
        logger.info('GoalDigest cron job scheduled (0 9 * * 1 - Mondays at 09:00 UTC)')
    }

    stop(): void {
        if (this.task) {
            this.task.stop()
            this.task = null
            logger.info('GoalDigest job stopped')
        }
    }

    async runNow(): Promise<void> {
        const jobRunId = randomUUID()
        await mdc.run({ jobRunId, jobName: 'goal_digest' }, async () => {
            // Find orgs with active Slack install
            const { data: orgs, error } = await supabase
                .from('organizations')
                .select('id, name, org_integrations:org_integrations!inner(provider, is_active)')
                .eq('org_integrations.provider', 'slack')
                .eq('org_integrations.is_active', true)

            if (error) {
                logger.error('GoalDigest: org query failed: {}', error.message, error)
                return
            }

            if (!orgs || orgs.length === 0) {
                logger.info('GoalDigest: no orgs with active Slack install')
                return
            }

            let totalMembers = 0
            let totalDigests = 0
            for (const org of orgs as OrgRow[]) {
                try {
                    const res = await processOrg(org)
                    totalMembers += res.membersProcessed
                    totalDigests += res.digestsSent
                    logger
                        .with('orgId', org.id)
                        .with('membersProcessed', res.membersProcessed)
                        .with('digestsSent', res.digestsSent)
                        .info('GoalDigest: org processed')
                } catch (err) {
                    logger.with('err', err).with('orgId', org.id).warn('GoalDigest: org failed')
                }
            }

            logger
                .with('orgCount', (orgs as OrgRow[]).length)
                .with('totalMembers', totalMembers)
                .with('totalDigests', totalDigests)
                .info('GoalDigest completed')
        })
    }
}

export const goalDigestJob = new GoalDigestJob()
