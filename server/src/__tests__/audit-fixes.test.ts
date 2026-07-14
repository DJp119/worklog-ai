/**
 * server/src/__tests__/audit-fixes.test.ts
 *
 * Structural smoke tests for the audit-driven fixes. These assert the
 * source-level shape of the fixes; they do not require a live DB.
 *
 * Run: `npx vitest run server/src/__tests__/audit-fixes.test.ts`
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const REPO = path.resolve(__dirname, '../../..')

function readFile(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf-8')
}

describe('audit fixes - structural shape', () => {
  it('crypto.ts: fail-fast key loading at module load', () => {
    const src = readFile('server/src/lib/crypto.ts')
    expect(src).toMatch(/loadKeys\s*\(/)
  })

  it('webhookSecurity.ts: pre-hash before timingSafeEqual', () => {
    const src = readFile('server/src/lib/webhookSecurity.ts')
    const calls = src.match(/crypto\.createHash\(['"]sha256['"]\)/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(6)
  })

  it('jiraAdapter.ts: AbortSignal.timeout on fetch', () => {
    const src = readFile('server/src/lib/jiraAdapter.ts')
    expect(src).toMatch(/AbortSignal\.timeout\(/)
  })

  it('jiraAdapter.ts: no silent 404', () => {
    const src = readFile('server/src/lib/jiraAdapter.ts')
    expect(src).not.toMatch(/404\)\s*return\s+null\s+as\s+any/)
  })

  it('githubAdapter.ts: no silent 404', () => {
    const src = readFile('server/src/lib/githubAdapter.ts')
    expect(src).not.toMatch(/404\)\s*return\s+null\s+as\s+any/)
  })

  it('authz.ts: canEditGoal org-membership-first check', () => {
    const src = readFile('server/src/services/authz.ts')
    const fnStart = src.indexOf('export async function canEditGoal(')
    const fnBody = src.slice(fnStart, fnStart + 2000)
    expect(fnBody).toMatch(/getUserOrgRole[\s\S]{0,200}if\s*\(!role\)\s*return\s+false/)
  })

  it('authz.ts: getUserOrgRole uses .maybeSingle not .single', () => {
    const src = readFile('server/src/services/authz.ts')
    // Locate the function body, slice a large window, and verify both
    // .maybeSingle is present and .single is absent.
    const fnStart = src.indexOf('export async function getUserOrgRole(')
    const fnBody = src.slice(fnStart, fnStart + 1500)
    expect(fnBody).toMatch(/\.maybeSingle\(\)/)
    expect(fnBody).not.toMatch(/\.single\(\)/)
  })

  it('migration: recompute_goalProgress children-branch passes numerator through on zero weight', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    expect(src).toMatch(/NULLIF\(SUM\(rollup_weight\),\s*0\)[\s\S]{0,80}SUM\(progress \* rollup_weight\)/)
  })

  it('migration: goal_updates has status CHECK constraint (DB-M8)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    // Status must be constrained to a known set; without this, free-form
    // values pollute analytics (DB-M8). The migration can have multiple
    // CREATE TABLE statements; we anchor on goal_updates specifically and
    // take the first 1500 chars of the block (one CREATE TABLE block is
    // never that long in this codebase).
    const startIdx = src.indexOf('CREATE TABLE IF NOT EXISTS goal_updates')
    expect(startIdx, 'goal_updates table must exist').toBeGreaterThan(-1)
    const goalUpdatesBlock = src.slice(startIdx, startIdx + 2000)
    expect(goalUpdatesBlock).toMatch(/status\s+TEXT\s+NOT\s+NULL\s+CHECK/)
  })

  it('migration: goal_updates does NOT have a composite FK to org_members (DB-C3 fix)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    // The composite FK would force `user_id` to NOT NULL, contradicting
    // the audit-trail intent. It must be absent.
    expect(src).not.toMatch(/fk_goal_updates_org_member[\s\S]{0,200}REFERENCES\s+org_members\(org_id,\s*user_id\)/)
  })

  it('migration: goal_updates.user_id FK to users (ON DELETE SET NULL)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    const startIdx = src.indexOf('CREATE TABLE IF NOT EXISTS goal_updates')
    const goalUpdatesBlock = src.slice(startIdx, startIdx + 2000)
    expect(goalUpdatesBlock).toMatch(/fk_goal_updates_user[\s\S]{0,80}REFERENCES\s+users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/)
  })

  it('migration: departments UNIQUE(id, org_id)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS departments[\s\S]{0,1500}UNIQUE\(id,\s*org_id\)/)
  })

  it('migration: team_closure ancestor index', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    expect(src).toMatch(/idx_team_closure_ancestor/)
  })

  it('shared types: IntegrationProvider has no gitlab literal', () => {
    const src = readFile('shared/src/index.ts')
    const m = src.match(/export type IntegrationProvider = ([^\n]+)/)
    expect(m).toBeTruthy()
    expect(m![1]).not.toMatch(/gitlab/)
  })

  it('weeklySyncJob: IANA timezone validation present', () => {
    const src = readFile('server/src/jobs/weeklySyncJob.ts')
    expect(src).toMatch(/isValidTimezone|VALID_TZS/)
  })

  it('weeklySyncJob: GitHub repos restricted to org-App-allowed set', () => {
    const src = readFile('server/src/jobs/weeklySyncJob.ts')
    expect(src).toMatch(/github_app/)
    expect(src).toMatch(/hasOrgApp/)
  })

  it('goalDigestJob: per-member try/catch around sendGoalDigest', () => {
    const src = readFile('server/src/jobs/goalDigestJob.ts')
    expect(src).toMatch(/try\s*\{[\s\S]{0,200}sendGoalDigest[\s\S]{0,200}\}\s*catch/)
  })

  it('slack.ts: cross-tenant org_id re-verified from goal row', () => {
    const src = readFile('server/src/routes/webhooks/slack.ts')
    expect(src).toMatch(/goalRow\.org_id !== (link|enrichedLink)\.org_id/)
  })

  it('slack.ts: rejects index < 1', () => {
    const src = readFile('server/src/routes/webhooks/slack.ts')
    expect(src).toMatch(/index\s*<\s*1/)
  })

  it('slack.ts: enforces session expiry', () => {
    const src = readFile('server/src/routes/webhooks/slack.ts')
    expect(src).toMatch(/expires_at.*new Date\(\)\.toISOString\(\)/)
  })

  it('integrations.ts: jira/org-confirm does not return webhookSecret in response or URL', () => {
    const src = readFile('server/src/routes/integrations.ts')
    expect(src).not.toMatch(/webhookSecret\}/)
    const urlMatch = src.match(/\/api\/webhooks\/jira\?[^"'\s]+/)
    if (urlMatch) {
      expect(urlMatch[0]).not.toMatch(/token=/)
    }
  })

  it('organizations.ts: uses provision_organization RPC', () => {
    const src = readFile('server/src/routes/organizations.ts')
    expect(src).toMatch(/provision_organization/)
    expect(src).toMatch(/\.rpc\(/)
  })

  it('jira webhook: signature read from X-Hub-Signature-256 header', () => {
    const src = readFile('server/src/routes/webhooks/jira.ts')
    expect(src).toMatch(/x-hub-signature-256/i)
  })

  it('teams.ts: GET /:teamId/my-role route exists', () => {
    const src = readFile('server/src/routes/teams.ts')
    expect(src.includes(":teamId/my-role'")).toBe(true)
  })

  it('useTeamRole hook exists', () => {
    expect(fs.existsSync(path.join(REPO, 'client/src/hooks/useTeamRole.ts'))).toBe(true)
  })

  it('useHasOrg hook exists', () => {
    expect(fs.existsSync(path.join(REPO, 'client/src/hooks/useHasOrg.ts'))).toBe(true)
  })

  it('Layout.tsx: Integrations nav conditional on useHasOrg', () => {
    const src = readFile('client/src/components/Layout.tsx')
    expect(src).toMatch(/useHasOrg/)
    expect(src).toMatch(/hasOrg\s*&&\s*\(\s*<Link\s+to="\/integrations"/)
  })

  it('OrgSettings.tsx: no Rules of Hooks violation (early-return after hooks)', () => {
    const src = readFile('client/src/pages/OrgSettings.tsx')
    const hasOrgCheckIdx = src.search(/if\s*\(\s*!hasOrg\s*\)/)
    const lastHookIdx = Math.max(
      src.lastIndexOf('useEffect'),
      src.lastIndexOf('useState'),
      src.lastIndexOf('useTeamRole'),
      src.lastIndexOf('useHasOrg'),
    )
    if (hasOrgCheckIdx > 0) {
      expect(hasOrgCheckIdx).toBeGreaterThan(lastHookIdx)
    }
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: req.supabase RLS-bypass static analysis
  // The server uses the SERVICE ROLE key on req.supabase, which bypasses RLS.
  // A handler that calls req.supabase.from(X) without a user-scoping filter
  // (e.g. .eq('user_id', req.userId) or .eq('id', req.userId)) is a security
  // vulnerability: any authenticated user can read or write any other user's
  // data. The auth.ts middleware comment says this MUST be enforced; this test
  // is the first line of defense.
  // ---------------------------------------------------------------------------
  it('routes: every req.supabase query is scoped by user_id or id', () => {
    const routeFiles = [
      'server/src/routes/entries.ts',
      'server/src/routes/appraisal.ts',
      'server/src/routes/users.ts',
      'server/src/routes/summaries.ts',
      'server/src/routes/chat.ts',
      'server/src/routes/feedback.ts',
      'server/src/routes/aiPulse.ts',
      'server/src/routes/translate.ts',
      'server/src/routes/waitlist.ts',
      'server/src/routes/organizations.ts',
      'server/src/routes/teams.ts',
      'server/src/routes/goals.ts',
      'server/src/routes/integrations.ts',
    ]
    // Tables that store per-user data and MUST be filtered by user_id / id.
    // Org-scoped tables (organizations, org_members, teams, etc.) are exempted
    // because the authz layer enforces tenant isolation, not user_id.
    const userTables = [
      'work_log_entries',
      'appraisal_criteria',
      'generated_appraisals',
      'reminder_logs',
      'user_integrations',
      'integration_preferences',
      'log_source_references',
      'integration_sync_logs',
      'goal_assignees',
      'goal_updates',
      'slack_user_links',
      'monthly_summaries',
      'chat_sessions',
      'chat_messages',
      'feedback',
      'user_bookmarks',
    ]
    const userScopePattern = /\.eq\(\s*['"](?:user_id|id)['"]\s*,\s*(?:req\.userId|user\.id|targetUserId|userId)/

    for (const rel of routeFiles) {
      const src = readFile(rel)
      // Find every chained call to req.supabase.from(userTable) and check the
      // next ~600 characters for a user-scoping filter.
      const tablePattern = new RegExp(
        `req\\.supabase[\\s\\S]{0,200}\\.from\\(\\s*['"](${userTables.join('|')})['"]\\s*\\)`,
        'g',
      )
      let m: RegExpExecArray | null
      while ((m = tablePattern.exec(src)) !== null) {
        const after = src.slice(m.index, m.index + 800)
        // Skip if the chain is inside a comment
        const before = src.slice(0, m.index)
        const lastLineStart = before.lastIndexOf('\n') + 1
        const lineStart = before.slice(0, m.index - lastLineStart)
        if (lineStart.trim().startsWith('//') || lineStart.trim().startsWith('*')) continue
        expect(
          userScopePattern.test(after),
          `${rel}: req.supabase.from('${m[1]}') must be scoped by .eq('user_id', req.userId) or .eq('id', req.userId)`,
        ).toBe(true)
      }
    }
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: migration updated_at triggers
  // ---------------------------------------------------------------------------
  it('migration: every new table with updated_at has a trigger to auto-update it (DB-M9)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    // Tables we expect to have updated_at triggers
    const tablesWithUpdatedAt = [
      'organizations',
      'org_members',
      'departments',
      'teams',
      'team_members',
      'goals',
      'goal_key_results',
      'goal_links',
      'org_integrations',
    ]
    for (const t of tablesWithUpdatedAt) {
      const triggerPattern = new RegExp(
        `CREATE TRIGGER trg_${t}_updated_at[\\s\\S]{0,200}update_updated_at_column`,
      )
      expect(src, `expected trg_${t}_updated_at trigger`).toMatch(triggerPattern)
    }
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: crypto.ts key validation
  // ---------------------------------------------------------------------------
  it('crypto.ts: rejects low-entropy / non-hex / non-base64 keys (Bug #6)', () => {
    const src = readFile('server/src/lib/crypto.ts')
    // Must throw on invalid keys, NOT silently SHA-256-hash them.
    expect(src).not.toMatch(/createHash\('sha256'\)\.update\(raw\)\.digest/)
    expect(src).toMatch(/Invalid encryption key: hex string must be exactly 64 chars/)
    expect(src).toMatch(/Invalid encryption key: base64 must decode to exactly 32 bytes/)
    expect(src).toMatch(/Plain strings are NOT accepted/)
  })

  it('crypto.ts: requires 32-byte keys after decode (no silent fallback)', () => {
    const src = readFile('server/src/lib/crypto.ts')
    // The fallback path that used to silently hash arbitrary strings must
    // be removed.
    const catchBlock = src.match(/}\s*catch\s*\{[\s\S]{0,200}createHash/s)
    expect(catchBlock, 'silent-SHA256 fallback must be removed').toBeNull()
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: index.ts startup orphan-lock cleanup
  // ---------------------------------------------------------------------------
  it('index.ts: clears orphaned sync/refresh locks at startup (Issue CU)', () => {
    const src = readFile('server/src/index.ts')
    expect(src).toMatch(/is_syncing.*false|is_syncing:\s*false/)
    expect(src).toMatch(/is_refreshing.*false|is_refreshing:\s*false/)
    expect(src).toMatch(/temp_oauth_states.*delete|delete.*temp_oauth_states/)
    expect(src).toMatch(/startServer\(\)/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: migration no longer has the password_resets typo
  // ---------------------------------------------------------------------------
  it('migration: uses correct password_reset_tokens table name (not password_resets)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    // The base schema defines password_reset_tokens. The migration MUST
    // use that name; a typo (password_resets) crashes the migration.
    expect(src).not.toMatch(/ALTER TABLE password_resets\b/)
    expect(src).toMatch(/ALTER TABLE password_reset_tokens/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: organization name regex used in UI must be RFC-compliant
  // ---------------------------------------------------------------------------
  it('migration: organizations slug regex requires lowercase, digits, hyphens', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    expect(src).toMatch(/CHECK\s*\(slug\s*=\s*LOWER\(slug\)/)
    // The slug regex in SQL uses `~` operator: '^[a-z0-9]+(-[a-z0-9]+)*$'
    expect(src).toMatch(/slug\s*~\s*'\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$'/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: follow-up constraint migration must add the audit fixes
  // ---------------------------------------------------------------------------
  it('followup migration: chk_users_reminder_day 0..6', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/chk_users_reminder_day/)
    expect(src).toMatch(/reminder_day\s+BETWEEN\s+0\s+AND\s+6/)
  })

  it('followup migration: chk_work_log_hours_logged 0..99.99', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/chk_work_log_hours_logged/)
    expect(src).toMatch(/hours_logged\s+>=\s+0\s+AND\s+hours_logged\s+<=\s+99\.99/)
  })

  it('followup migration: auto_generated_at consistency with status', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/chk_work_log_autogen_consistency/)
    expect(src).toMatch(/status\s*=\s*'manual'\s+AND\s+auto_generated_at\s+IS\s+NULL/)
  })

  it('followup migration: pending_review must be false for manual rows', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/chk_work_log_pending_review/)
  })

  it('followup migration: goal_updates cross-tenant trigger blocks live cross-tenant writes', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/enforce_goal_updates_org_member/)
    expect(src).toMatch(/org_id\s*=\s*NEW\.org_id\s+AND\s+user_id\s*=\s*NEW\.user_id/)
  })

  it('followup migration: is_refreshing consistency (both user and org)', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/chk_user_integrations_refresh_consistency/)
    expect(src).toMatch(/chk_org_integrations_refresh_consistency/)
  })

  it('followup migration: integration_events payload size limit (DoS guard)', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/chk_integration_events_payload_size/)
    expect(src).toMatch(/octet_length\(payload::text\)\s*<=\s*65536/)
  })

  it('followup migration: goal_updates.note length cap', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/chk_goal_updates_note_length/)
    expect(src).toMatch(/length\(note\)\s*<=\s*10000/)
  })

  it('followup migration: KR monotonic + percentage range CHECKs', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/chk_goal_kr_monotonic/)
    expect(src).toMatch(/chk_goal_kr_percentage/)
  })

  it('followup migration: index for (goal_id, sort_order) on goal_key_results', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/idx_goal_key_results_goal_id_sort/)
  })

  it('followup migration: index for (goal_id, created_at DESC) on goal_updates', () => {
    const src = readFile('supabase-migrations/2026-06-18_followup_constraints.sql')
    expect(src).toMatch(/idx_goal_updates_goal_id_created/)
  })

  it('migration: goal_links state CHECK allowlist (audit Finding #14)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    const startIdx = src.indexOf('CREATE TABLE IF NOT EXISTS goal_links')
    const block = src.slice(startIdx, startIdx + 2000)
    expect(block).toMatch(/state\s+TEXT\s+CHECK\s*\(\s*state\s+IN/)
  })

  it('migration: goal_links weight must be > 0 (audit Finding #15)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    const startIdx = src.indexOf('CREATE TABLE IF NOT EXISTS goal_links')
    const block = src.slice(startIdx, startIdx + 2000)
    expect(block).toMatch(/weight\s+NUMERIC\s+NOT\s+NULL\s+DEFAULT\s+1\s+CHECK\s*\(\s*weight\s*>\s*0\s*\)/)
  })

  it('migration: goal_links metadata default to empty JSON object (audit Finding #57)', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    const startIdx = src.indexOf('CREATE TABLE IF NOT EXISTS goal_links')
    const block = src.slice(startIdx, startIdx + 2000)
    expect(block).toMatch(/metadata\s+JSONB\s+DEFAULT\s+'\{\}'::jsonb/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: integration event recovery must include 'received' state
  // ---------------------------------------------------------------------------
  it('migration: record_integration_event recovers events stuck in received state', () => {
    const src = readFile('supabase-migrations/2026-06-16_teams_goals_integrations.sql')
    // The WHERE clause must include 'received' as well as 'processing' so a
    // webhook whose worker died immediately after INSERT is reclaimable.
    const fnBlock = src.match(/CREATE OR REPLACE FUNCTION record_integration_event[\s\S]+?\$\$;/)?.[0] ?? ''
    expect(fnBlock).toMatch(/status\s+IN\s*\(\s*'received'\s*,\s*'processing'\s*\)/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: pruneJob wired into server lifecycle
  // ---------------------------------------------------------------------------
  it('server: pruneJob imported and started', () => {
    const idx = readFile('server/src/index.ts')
    expect(idx).toMatch(/import\s+\{\s*pruneJob\s*\}\s+from\s+'\.\/jobs\/pruneJob\.js'/)
    expect(idx).toMatch(/pruneJob\.start\(\)/)
    expect(idx).toMatch(/pruneJob\.stop\(\)/)
  })

  it('server: pruneJob prunes all four temp tables', () => {
    const src = readFile('server/src/jobs/pruneJob.ts')
    expect(src).toMatch(/temp_oauth_states/)
    expect(src).toMatch(/temp_slack_codes/)
    expect(src).toMatch(/slack_command_sessions/)
    expect(src).toMatch(/integration_events/)
    expect(src).toMatch(/30 \* 24 \* 60 \* 60 \* 1000/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: setParent fail-closed on lock failure
  // ---------------------------------------------------------------------------
  it('setParent: fails closed when org lock cannot be acquired (no best-effort fallback)', () => {
    const src = readFile('server/src/services/goalService.ts')
    // After `if (lockErr) {` the code must `throw`, not log+continue.
    const fnStart = src.indexOf('export async function setParent(')
    expect(fnStart, 'setParent must exist').toBeGreaterThan(-1)
    const fnBlock = src.slice(fnStart, fnStart + 2500)
    // The lockErr block must throw
    const lockErrBlock = fnBlock.match(/if\s*\(\s*lockErr\s*\)\s*\{[\s\S]{0,400}?throw/)?.[0] ?? ''
    expect(lockErrBlock, 'lockErr block must throw — fail-closed').toMatch(/throw/)
    // No `warn(...lock...` followed by no throw (the old best-effort pattern)
    const bestEffort = fnBlock.match(/lockErr[\s\S]{0,200}?warn\([^)]*\)/)?.[0] ?? ''
    expect(bestEffort, 'no warn-and-continue after lockErr').toBe('')
    // And the lockId-null branch must throw
    expect(fnBlock).toMatch(/Organization not found/)
  })

  it('setParent: uses optimistic concurrency (WHERE org_id + WHERE NOT EQUALS)', () => {
    const src = readFile('server/src/services/goalService.ts')
    const fnStart = src.indexOf('export async function setParent(')
    const fnBlock = src.slice(fnStart, fnStart + 2500)
    expect(fnBlock).toMatch(/\.eq\('org_id', orgId\)/)
    expect(fnBlock).toMatch(/\.neq\('parent_goal_id', newParentId\)/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: crypto no longer silently hashes arbitrary strings
  // ---------------------------------------------------------------------------
  it('crypto.ts: throws on plain-string keys (no SHA-256 silent fallback)', () => {
    const src = readFile('server/src/lib/crypto.ts')
    const catchBlock = src.match(/}\s*catch\s*\{[\s\S]{0,200}createHash/s)
    expect(catchBlock, 'silent SHA-256 fallback for plain keys must be removed').toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Slack /goals listing visibility filter (BUG-7 from bug-hunter audit)
  // ---------------------------------------------------------------------------
  it('slack.ts: /goals listing uses visibility filter (BUG-7 fix)', () => {
    const src = readFile('server/src/routes/webhooks/slack.ts')
    // The listing branch (parts.length === 0 || !parts[0]) must consult
    // the viewable_user_ids filter, not just return all org goals.
    const listingStart = src.indexOf("if (parts.length === 0 || !parts[0]) {")
    expect(listingStart, 'listing branch must exist').toBeGreaterThan(-1)
    const listingBlock = src.slice(listingStart, listingStart + 2000)
    expect(listingBlock, 'must import getViewableUserIds').toMatch(/getViewableUserIds/)
    expect(listingBlock, 'must distinguish org admin via role check').toMatch(/admin['"]\s*\|\|.*owner/)
    expect(listingBlock, 'must filter individual-scope goals by viewable set').toMatch(/viewable\.includes\(g\.created_by\)/)
  })

  it('slack.ts: /worklog re-verifies org membership (BUG-19 fix)', () => {
    const src = readFile('server/src/routes/webhooks/slack.ts')
    const worklogStart = src.indexOf("if (command === '/worklog') {")
    expect(worklogStart).toBeGreaterThan(-1)
    const block = src.slice(worklogStart, worklogStart + 1500)
    expect(block, 'must look up org_members for active-membership check').toMatch(/from\('org_members'\)/)
    expect(block, 'must refuse if user no longer in org').toMatch(/no longer have access|membership.*not found/i)
  })

  // ---------------------------------------------------------------------------
  // CORS hardening: no wildcard *.vercel.app (BUG-23 from bug-hunter audit)
  // ---------------------------------------------------------------------------
  it('index.ts: CORS Vercel allowlist uses VERCEL_ALLOWED_APPS, not bare suffix match', () => {
    const src = readFile('server/src/index.ts')
    expect(src, 'must read VERCEL_ALLOWED_APPS env').toMatch(/VERCEL_ALLOWED_APPS/)
    // The buggy bare-suffix match is a single .endsWith('.vercel.app')
    // followed by `return true` with no further host check. After the fix,
    // the predicate must compare the parsed hostname against the allowlist.
    expect(src, 'predicate must compare against allowlist array').toMatch(/allowedVercelApps\.some\(/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: resend-verification must hash the token before INSERT
  // The schema has email_verifications.token_hash (UNIQUE NOT NULL).
  // A previous bug wrote `token: emailToken` (raw, unhashed) — that
  // (a) hits a column-doesn't-exist 42703 error and breaks verification,
  // (b) leaks the token in plaintext into the DB.
  // ---------------------------------------------------------------------------
  it('auth.ts: resend-verification writes token_hash, not raw token', () => {
    const src = readFile('server/src/routes/auth.ts')
    // Locate the resend-verification handler
    const start = src.indexOf("authRoutes.post('/resend-verification'")
    expect(start, 'resend-verification route must exist').toBeGreaterThan(-1)
    const block = src.slice(start, start + 5000)
    // The INSERT into email_verifications must use token_hash
    const insertBlock = block.match(/from\('email_verifications'\)[\s\S]{0,300}\.insert\([\s\S]{0,400}\)/)
    expect(insertBlock, 'email_verifications.insert must exist').toBeTruthy()
    expect(insertBlock![0], 'must write token_hash: hashToken(...)').toMatch(/token_hash:\s*hashToken\(/)
    // And must NOT write a raw `token:` field
    expect(insertBlock![0], 'must NOT write raw token: emailToken').not.toMatch(/token:\s*emailToken[^_a-zA-Z]/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: token-bearing INSERTs (signup, password reset) must all hash
  // before storing. Same family as the resend-verification bug.
  // ---------------------------------------------------------------------------
  it('auth.ts: signup writes email_verifications.token_hash, not raw token', () => {
    const src = readFile('server/src/routes/auth.ts')
    const start = src.indexOf("authRoutes.post('/signup'")
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start, start + 5000)
    const insertBlock = block.match(/from\('email_verifications'\)[\s\S]{0,300}\.insert\([\s\S]{0,400}\)/)
    expect(insertBlock).toBeTruthy()
    expect(insertBlock![0]).toMatch(/token_hash:\s*hashToken\(/)
  })

  it('auth.ts: forgot-password writes password_reset_tokens.token_hash, not raw token', () => {
    const src = readFile('server/src/routes/auth.ts')
    const start = src.indexOf("authRoutes.post('/forgot-password'")
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start, start + 3000)
    const insertBlock = block.match(/from\('password_reset_tokens'\)[\s\S]{0,300}\.insert\([\s\S]{0,400}\)/)
    expect(insertBlock).toBeTruthy()
    expect(insertBlock![0]).toMatch(/token_hash:\s*hashToken\(/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: reset-password must revoke ALL active refresh tokens
  // The reset-password route is the account-compromise recovery path. If it
  // doesn't revoke refresh tokens, an attacker holding a stolen refresh
  // token retains access for the original 7-30 day window.
  // ---------------------------------------------------------------------------
  it('auth.ts: reset-password revokes all active refresh tokens (compromise recovery)', () => {
    const src = readFile('server/src/routes/auth.ts')
    const start = src.indexOf("authRoutes.post('/reset-password'")
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start, start + 4000)
    expect(block, 'must update refresh_tokens to revoked=true for this user').toMatch(
      /from\('refresh_tokens'\)[\s\S]{0,400}\.eq\('user_id',\s*resetData\.user_id\)[\s\S]{0,200}\.eq\('revoked',\s*false\)/
    )
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: rate-limit on resend-verification must be 60s
  // ---------------------------------------------------------------------------
  it('auth.ts: resend-verification rate-limits at 60s window', () => {
    const src = readFile('server/src/routes/auth.ts')
    const start = src.indexOf("authRoutes.post('/resend-verification'")
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start, start + 5000)
    expect(block, 'must compute 60-second window').toMatch(/60\s*\*\s*1000/)
    expect(block, 'must query email_verifications for recent tokens').toMatch(/from\('email_verifications'\)[\s\S]{0,500}\.gte\('created_at',\s*sixtySecondsAgo\)/)
    expect(block, 'must return 429 when rate-limited').toMatch(/status\(429\)/)
  })

  // ---------------------------------------------------------------------------
  // CRITICAL: goals reparent route must be fail-closed on org-lock failure
  // Previously logged "best-effort" and continued, masking lock RPC errors.
  // Now returns 503 so the caller's retry mechanism can engage.
  // ---------------------------------------------------------------------------
  it('goals.ts: reparent route fails closed (503) on org-lock RPC error', () => {
    const src = readFile('server/src/routes/goals.ts')
    const start = src.indexOf("goalRoutes.put('/:goalId/parent'")
    expect(start, 'reparent route must exist').toBeGreaterThan(-1)
    const block = src.slice(start, start + 4000)
    expect(block, 'must call lock_organization_row RPC').toMatch(/lock_organization_row/)
    // Find the lockErr branch and confirm it returns a 5xx, not warn+continue
    const lockBranch = block.match(/if\s*\(\s*lockErr\s*\)\s*\{[\s\S]{0,800}?\}/)
    expect(lockBranch, 'lockErr branch must exist').toBeTruthy()
    expect(lockBranch![0], 'must return 5xx on lock failure').toMatch(/status\(5\d\d\)/)
    expect(lockBranch![0], 'must NOT log "best-effort" and continue').not.toMatch(/best-effort/)
  })

  it('goalService.ts: example.atlassian.net placeholder is removed', () => {
    const src = readFile('server/src/services/goalService.ts')
    expect(src).not.toMatch(/example\.atlassian\.net/)
  })
})
