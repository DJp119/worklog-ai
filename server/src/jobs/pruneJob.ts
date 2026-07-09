/**
 * server/src/jobs/pruneJob.ts
 *
 * Daily pruning of temporary/cache tables to prevent unbounded growth.
 *
 * Runs once per day at 03:17 server time. Trims:
 *   - temp_oauth_states      → expired entries
 *   - temp_slack_codes        → expired entries
 *   - slack_command_sessions  → expired entries
 *   - integration_events      → entries older than 30 days
 *
 * Critical: even though the startup hook in index.ts clears these, a server
 * that runs for many days without restart will accumulate stale records
 * without this job.
 */

import { supabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'
import { startJob } from '../lib/scheduler.js'

export async function prune(): Promise<void> {
  const now = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const results = await Promise.allSettled([
    supabase.from('temp_oauth_states').delete().lt('expires_at', now).then((r) => ({ table: 'temp_oauth_states', count: r.count, error: r.error })),
    supabase.from('temp_slack_codes').delete().lt('expires_at', now).then((r) => ({ table: 'temp_slack_codes', count: r.count, error: r.error })),
    supabase.from('slack_command_sessions').delete().lt('expires_at', now).then((r) => ({ table: 'slack_command_sessions', count: r.count, error: r.error })),
    supabase.from('integration_events').delete().lt('received_at', thirtyDaysAgo).then((r) => ({ table: 'integration_events', count: r.count, error: r.error })),
  ])

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { table, count, error } = r.value
      if (error) {
        logger.with('table', table).with('err', error).warn('Prune: failed')
      } else {
        logger.with('table', table).with('rows', count ?? 'unknown').info('Prune: cleaned')
      }
    } else {
      logger.with('reason', r.reason).warn('Prune: rejected')
    }
  }
}

export const pruneJob = startJob('prune', '17 3 * * *', prune)
