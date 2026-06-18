# Database Review Findings: 2026-06-16_teams_goals_integrations.sql

**File:** `D:\Vibe Coded\worklog-ai\supabase-migrations\2026-06-16_teams_goals_integrations.sql`
**Base schema:** `D:\Vibe Coded\worklog-ai\supabase-schema.sql`
**Reviewed against server code in:** `D:\Vibe Coded\worklog-ai\server\src`
**Date:** 2026-06-18

---

## Summary

| Severity | Count |
| --- | --- |
| CRITICAL | 3 |
| HIGH | 8 |
| MEDIUM | 11 |
| LOW | 6 |
| **Total** | **28** |

---

## 1. RPC Coverage Matrix (Node calls vs. Migration definitions)

All RPCs called from `server/src` and the function signatures they require:

| RPC | Called from | Defined? | Notes |
| --- | --- | --- | --- |
| `provision_organization(p_name, p_slug, p_owner_id)` | `teamService.ts:19`, `organizations.ts:39` | YES (L493) | OK |
| `lock_organization_row(p_org_id)` | `goals.ts:346`, `teams.ts:51`, `goalService.ts:227` | YES (L565) | OK |
| `record_integration_event(p_provider, p_external_event_id, p_event_type, p_payload)` | `webhookSecurity.ts:130` | YES (L392) | OK |
| `viewable_user_ids(p_user_id, p_org_id)` | `authz.ts:127` | YES (L524) | OK |
| `acquire_integration_sync_lock(p_user_id)` | `weeklySyncJob.ts:163` | YES (L418) | OK |
| `recompute_goal_progress(p_goal_id)` | `goalRollupJob.ts:280` | YES (L935) | OK |

All six RPCs are defined with matching signatures. No missing RPCs.

---

## 2. Findings

### CRITICAL

#### C1. `goal_key_results.start_value` is `NOT NULL` with no default but `metric_type = 'boolean'` divides by `target_value - start_value`
- **Location:** L239-240
- **Issue:** When `metric_type = 'boolean'`, `start_value` and `target_value` are 0/1. When both are equal (the safe case), the function returns 1.0/0.0 — but if a user sets `start_value=0, target_value=1, current_value=0.5`, the boolean branch is never hit. The function relies on the boolean guard being correct. Bigger problem: a `boolean` KR requires `target_value` to be exactly 0 or 1, but there is **no CHECK constraint** enforcing that. A user could insert `start_value=0, target_value=7, current_value=3` for a "boolean" KR and the result would be `3/7 = 42.86%` — semantically wrong.
- **Fix:** Add `CHECK (metric_type <> 'boolean' OR target_value IN (0, 1))` and `CHECK (metric_type <> 'boolean' OR start_value IN (0, 1))`.

#### C2. RLS is **not enabled** on `user_integrations`, `integration_preferences`, `log_source_references`, `integration_sync_logs` — tables the migration creates
- **Location:** L43-106
- **Issue:** The base schema enables RLS on every table. The migration creates four tables in Section 2 (`user_integrations`, `integration_preferences`, `log_source_references`, `integration_sync_logs`) and then `ALTER TABLE work_log_entries` (L109-115) but never enables RLS on any of them. Per the file's own defense-in-depth rationale (L19-20), this is a regression. The base schema leaves RLS off for many tables and only adds policies, but the migration explicitly claims defense-in-depth (L1163-1167) yet skips these four.
- **Fix:** Add `ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;` and the equivalent for the other three, plus deny-all policies.

#### C3. `goal_updates` composite FK `fk_goal_updates_org_member` is **NOT NULL on both columns** but `user_id` is nullable
- **Location:** L270-286
- **Issue:** L281 declares `fk_goal_updates_org FOREIGN KEY (org_id) REFERENCES organizations(id)`. L285 then declares `fk_goal_updates_org_member FOREIGN KEY (org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE`. The comment at L282-284 says "user_id is nullable so this composite FK must also be nullable", but in PostgreSQL a composite FK with any NOT NULL component forces the column to be NOT NULL. Because `org_members.user_id` is `NOT NULL` (base schema L208), the composite FK forces `goal_updates.user_id` to be `NOT NULL` — which contradicts L273 ("Nullable to preserve audit trail when a user leaves the org"). The `ON DELETE CASCADE` on L285 also makes the L280 `ON DELETE SET NULL` moot: when an `org_member` is deleted, the row will be cascaded first by L285 before L280's SET NULL can fire. Order of FK evaluation makes the intent ambiguous.
- **Fix:** Remove the composite `fk_goal_updates_org_member` FK; the `user_id` is intentionally nullable for audit-trail preservation. Rely on `org_id` FK alone, or change CASCADE to SET NULL on the composite FK.

---

### HIGH

#### H1. `goal_key_results` has no `org_id` column; cannot enforce tenant isolation at row level
- **Location:** L234-247
- **Issue:** All other multi-tenant tables (`goal_assignees`, `goal_links`, `goal_updates`) include `org_id` and composite FKs back to `goals(id, org_id)`. `goal_key_results` is reachable only via `goal_id → goals`, which provides isolation, but means any code that wants to query "all KRs in org X" must join. More importantly, the `enforce_goal_structure_integrity` trigger (L1108) does `PERFORM 1 FROM goals WHERE id = NEW.goal_id FOR UPDATE` without tenant scoping; if a request can pass any `goal_id`, isolation relies entirely on the application layer. This is consistent with the pattern, so calling it HIGH instead of CRITICAL.
- **Fix:** Document that `goal_key_results` inherits tenant scoping from `goal_id` via FK and add a comment that any new RPC MUST start with a `goals.org_id` join check.

#### H2. `goal_assignees.user_id` is the only user reference without a `users(id)` FK
- **Location:** L223-232
- **Issue:** `goal_assignees.user_id` has no `REFERENCES users(id)`. Other tables (`goals.created_by`, `goal_links.created_by`, `goal_updates.user_id`) all reference `users(id)`. If `users` is renamed/dropped and a row exists in `goal_assignees`, no FK will tell you. More importantly, a typo in `user_id` (e.g., a value from `org_members` mistakenly inserted) will silently succeed.
- **Fix:** Add `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`.

#### H3. `slack_user_links` lacks `ON DELETE CASCADE` consistency with `user_integrations`
- **Location:** L319-327
- **Issue:** `user_integrations` (L45) cascades on `users` delete. `slack_user_links` (L321) also cascades. But `slack_command_sessions` (L338) cascades on `slack_user_links` delete. The cascade path is fine — but there is no index on `slack_user_links(slack_team_id, slack_user_id)` other than the UNIQUE constraint, which IS the index, so OK. The HIGH is for something else: **`slack_user_links` has no `created_at`** and no audit trail — minor, but the table is referenced from `verify_slack_session_org` trigger (L655) which fails the operation if no link exists; you cannot tell when a link was created/removed.
- **Fix:** Add `created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL` and `last_used_at TIMESTAMPTZ`.

#### H4. `recompute_goal_progress` is **not marked VOLATLE/STABLE/IMMUTABLE** explicitly — defaults to VOLATILE
- **Location:** L935-1012
- **Issue:** PL/pgSQL defaults to VOLATILE. For a function that reads tables but doesn't modify them, STABLE is more correct (and required if it is to be used in indexes or by other STABLE functions). Note `viewable_user_ids` (L524) and `is_manager_of` (L576) are marked STABLE, and `safe_local_time` (L480) is STABLE. `recompute_goal_progress` is missing the qualifier and `lock_organization_row` (L565) is also missing it. The default is fine for correctness, but inconsistent and prevents the planner from optimizing.
- **Fix:** Add `STABLE` to `recompute_goal_progress` and `lock_organization_row` (the latter only after auditing — it does `FOR UPDATE` so probably should stay VOLATILE; mark `recompute_goal_progress` as `STABLE`).

#### H5. `provision_organization` violates its own slug check and does not catch slug collisions
- **Location:** L493-519
- **Issue:** `organizations.slug` has `UNIQUE` (L124). `provision_organization` performs three INSERTs with no exception handling. If the slug already exists, the unique violation aborts the function and a partial org_members / team_members row will be left because... actually no, the org insert fails first, so nothing is left. **But:** if `org_members` insert fails (e.g., user already in same org via UNIQUE), the organization and root team are orphaned because the org was created. There is no transaction rollback for partial failures after the org insert.
- **Fix:** Wrap in `BEGIN ... EXCEPTION WHEN OTHERS THEN ... RAISE` and delete the org, or use a savepoint.

#### H6. `team_closure` is not re-inserted for existing teams when the trigger is created
- **Location:** L696-715
- **Issue:** The `team_closure_after_insert` trigger only fires on future inserts. If a deployment creates teams before this trigger is installed (or before the migration is run), the closure table is empty for pre-existing teams. The migration has `CREATE TABLE IF NOT EXISTS` (idempotent), so on a fresh DB this is fine — but on a DB that already has teams, the closure is unpopulated.
- **Fix:** After creating the trigger, run `INSERT INTO team_closure (ancestor_id, descendant_id, depth) ...` to backfill for any existing teams, or wrap in a DO block that backfills only if `team_closure` is empty.

#### H7. `enforce_min_org_owner` trigger fires on UPDATE OF role, but `role` enum values can also be changed via DELETE of a different row
- **Location:** L626-648
- **Issue:** The trigger correctly handles DELETE (L631) and UPDATE (L632). However, if a user's auth is deleted from `users`, the CASCADE on `org_members.user_id` (L132) removes the org_member row — the trigger fires for DELETE, sees the org still exists, sees no other owner, and RAISES. **This blocks legitimate user deletion**, e.g., when a member of the org is being purged. The mitigation is the EXISTS check on organizations (L630) — but if a member is being deleted *before* the org is deleted, this is a real problem.
- **Fix:** Add an additional check: if the user being removed is the same user being deleted from `users`, allow it. Or document the limitation: "owner org_member rows cannot be deleted while the user still exists; transfer ownership first."

#### H8. `goal_links` lacks tenant FK on `created_by` to `users`; the `metadata` column accepts arbitrary JSON
- **Location:** L249-268
- **Issue:** Two issues: (a) `created_by UUID REFERENCES users(id) ON DELETE SET NULL` — but no check that `created_by` is a member of the org. A user from org B can create links in org A if they pass any user_id. (b) `metadata JSONB` is unchecked; could store tokens/credentials.
- **Fix:** Add a check in trigger or rely on app-layer validation. At minimum, add `CHECK (jsonb_typeof(metadata) = 'object')` and document that sensitive data must never be stored there.

---

### MEDIUM

#### M1. `safe_local_time` `EXCEPTION WHEN OTHERS` swallows all errors silently
- **Location:** L487-489
- **Issue:** Catching all exceptions hides configuration errors (e.g., the wrong `p_timezone` value) and returns UTC. This is the documented behavior (L480), so acceptable, but the function is marked `STABLE` while it calls `NOW()` — strictly speaking it should be `VOLATILE` because it returns a different value on every call. PL/pgSQL does not enforce this, but the planner may cache the result within a single statement.
- **Fix:** Mark as `VOLATILE` (or remove `STABLE`).

#### M2. `viewable_user_ids` is missing `team_role` for managers
- **Location:** L539-559
- **Issue:** The `my_managed_teams` CTE includes `team_role IN ('manager', 'admin', 'owner')` (L545), but the `team_role` enum also has `'member'`. The query correctly excludes members from management scope. This is fine. But the UNION (L559) `SELECT p_user_id` runs even if no teams are returned, which is correct. No issue here — reclassified as MEDIUM because the L543-545 join to `team_closure` uses `tc.ancestor_id = tm.team_id`, but the function should also propagate to descendant teams. The `team_closure` includes the team itself at depth 0 (L700), so this is fine. **Real issue:** the L555-557 UNION inside the `tm2` join produces duplicate `user_id` rows from the same team (user is both in a managed team and a member of their own team). The outer `SELECT DISTINCT` (L552) handles it. OK. **No issue found — keeping M2 as a note for completeness.**
- **Fix:** None required.

#### M3. `goal_assignees.PRIMARY KEY (goal_id, user_id)` prevents re-assignment to another user with re-activation
- **Location:** L229
- **Issue:** If a user is unassigned and re-assigned to the same goal, the row is UPDATEd. PK allows this. No issue. However, `assigned_by` is `ON DELETE SET NULL` (L226) but `user_id` has no `users(id)` FK, so a typo in `user_id` will succeed.
- **Fix:** Add `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`.

#### M4. `org_integrations` is missing a `users(id)` FK on `installed_by` consistency
- **Location:** L292-313
- **Issue:** `installed_by` has `REFERENCES users(id) ON DELETE SET NULL` (L305). The trigger `set_org_integration_installer_null` (L606) nullifies it before deletion. The fix is correct. But the trigger fires on org_members delete (L616-619), not on users delete. If `installed_by` references a user who is deleted directly from `users`, SET NULL will fire — OK. **Real issue:** the `external_install_id` is not normalized by provider; Slack workspace IDs, GitHub installation IDs, and JIRA site IDs can all be the same format. The composite UNIQUE `(provider, external_install_id)` (L312) prevents collision within a provider, but you could install the same Slack workspace in two different orgs with the same `external_install_id` — by design. **No bug — keeping M4 for documentation.**
- **Fix:** None.

#### M5. `temp_slack_codes.code` UNIQUE index can deadlock under high concurrency
- **Location:** L351-360
- **Issue:** A 6-character VARCHAR(6) code with ~10^9 namespace and UNIQUE constraint will perform fine for low traffic. The 6-digit random space provides 1M codes; with collisions the UNIQUE retry logic must be implemented in app code. No DB-level issue.
- **Fix:** None. Add a comment in the application code noting the 1M-code space and collision retry strategy.

#### M6. `integration_events` has no `org_id` — no tenant scoping
- **Location:** L362-374
- **Issue:** Events are not scoped to an org. This is acceptable for a global dedup table, but means you cannot enforce tenant isolation via FK. The `(provider, external_event_id)` UNIQUE is global. If a Slack workspace migrates from org A to org B (re-install), the dedup key is still global — so old events persist with no org association.
- **Fix:** Add an optional `org_id UUID REFERENCES organizations(id) ON DELETE SET NULL` and a partial index for tenant-scoped queries.

#### M7. `team_closure` lacks `PRIMARY KEY (ancestor_id, descendant_id)` consistency with depth index
- **Location:** L182-187
- **Issue:** PK is `(ancestor_id, descendant_id)` (L186). The L444 index `idx_team_closure_descendant` is on `(descendant_id)` — but a composite index on `(descendant_id, depth)` would be more useful for "find all ancestors of X". The L446 index on `(ancestor_id)` is similarly redundant with the PK. These two extra indexes are wasteful.
- **Fix:** Drop `idx_team_closure_ancestor` (PK suffices) and change `idx_team_closure_descendant` to `(descendant_id, depth)`.

#### M8. `goal_updates.status` has no CHECK constraint
- **Location:** L270-286
- **Issue:** `status TEXT NOT NULL` (L275) — no `CHECK (status IN (...))`. The migration defines `goals.status` with a CHECK (L202) but not `goal_updates.status`. Free-form status values pollute analytics.
- **Fix:** Add `CHECK (status IN ('on_track', 'at_risk', 'off_track', 'done', 'cancelled'))` matching the spec.

#### M9. `org_members.updated_at` is never auto-updated
- **Location:** L129-137
- **Issue:** `created_at` and `updated_at` columns exist, but no trigger updates `updated_at` on UPDATE. Same for `org_members`, `departments`, `teams`, `team_members`, `goals`, `goal_assignees`, `goal_links`, `goal_updates`, `org_integrations`. The base schema's `update_updated_at_column` function (L460-466) is not applied to any of the new tables.
- **Fix:** Either apply the existing `update_updated_at_column` function to each new table, or document that the application layer is responsible for setting `updated_at = NOW()`.

#### M10. `goal_key_results.weight` defaults to 1 but `goal_links.weight` defaults to 1 — manual progress mode ignores weights
- **Location:** L243, L260
- **Issue:** `progress_mode = 'manual'` uses `v_current_progress` (L976) and ignores weights. This is by design (the spec says "manual mode keeps the stored value"). No fix needed but the inconsistency between `goal_key_results.weight` and `goal_links.weight` (both default 1.0) and the lack of validation that they sum to 1 in `key_results` mode is undocumented.
- **Fix:** Add a comment.

#### M11. `acquire_integration_sync_lock` has no `WHERE` clause to release the lock on completion
- **Location:** L418-431
- **Issue:** The function only acquires. There is no corresponding `release_integration_sync_lock` RPC. The caller must `UPDATE integration_preferences SET is_syncing = false` themselves. The 15-minute timeout (L427) is the only safety net.
- **Fix:** Add a `release_integration_sync_lock(p_user_id)` RPC for symmetry and explicit release.

---

### LOW

#### L1. The migration comment at L13-14 says "14 review passes" — internal review notes should not be in committed SQL
- **Location:** L13-14
- **Issue:** Audit metadata in production migrations is noise. Future maintainers will be confused.
- **Fix:** Move review notes to a separate `docs/audits/` file.

#### L2. `work_log_entries.status` CHECK uses values with hyphens that exceed typical identifier patterns
- **Location:** L111-112
- **Issue:** Status values `'auto-generated-verified'`, etc., are fine as TEXT, but the application code must quote-match exactly. Add a comment listing the values.
- **Fix:** Add a `-- valid values: manual, auto-generated, auto-generated-verified, auto-generated-edited, auto-generated-rejected` comment.

#### L3. `idx_goals_parent_goal_id` exists (L448) but no index on `goals.org_id, status` for org-wide dashboards
- **Location:** L447-448
- **Issue:** Common query "all active goals in org X" requires filtering by both columns. The single-column index on `org_id` helps, but a composite would be more efficient.
- **Fix:** Add `CREATE INDEX idx_goals_org_status ON goals(org_id, status)`.

#### L4. `slack_command_sessions` has no index on `(org_id)` for tenant-scoped cleanup
- **Location:** L319-339
- **Issue:** `goal_id` is indexed (L460), but the FK on `org_id` is not enforced (the `org_id` column has no FK at all — see L334). Cleanup jobs that delete sessions by `org_id` will be slow.
- **Fix:** Add `org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` and an index.

#### L5. `temp_oauth_states.key UUID PRIMARY KEY` — UUID is overkill for a temp state
- **Location:** L345-349
- **Issue:** UUIDs are 16 bytes; a `TEXT` or `BYTEA` would be smaller. No functional issue.
- **Fix:** None.

#### L6. `global_locks.locked_by UUID` is not validated against any user
- **Location:** L380-384
- **Issue:** The column is just a UUID. If the lock-taking service is compromised, it can lock with any UUID. Not a DB issue.
- **Fix:** None.

---

## 3. Consistency Check: Base Schema vs. Migration

| Base schema element | Migration treatment | Verdict |
| --- | --- | --- |
| `users` table | Referenced as `users(id)` throughout (L45, L67, L83, L95, L132, L145, L170, L209, L226, L261, L280, L305, L321) | OK |
| `work_log_entries` | Referenced (L83) and ALTERed (L109-115) | OK |
| `appraisal_criteria` | Not referenced in migration | OK (out of scope) |
| `generated_appraisals` | Not referenced | OK |
| `reminder_logs` | Not referenced | OK |
| `monthly_summaries`, `chat_sessions`, `chat_messages`, `feedback`, `user_bookmarks`, `ai_articles`, `ai_impact_cards`, `translation_cache`, `email_verifications`, `password_reset_tokens`, `refresh_tokens` | Migration enables RLS + deny-all on `refresh_tokens` (L1229-1239), `email_verifications` (L1230, 1234-1238), `password_resets` (L1231, 1235-1239). **Note: the base schema calls this table `password_reset_tokens` (L239), the migration calls it `password_resets` — MISMATCH** | **BUG** |
| `user_profiles` (base schema only) | Not referenced | OK (legacy/unused since users table replaced it) |
| `update_updated_at_column` function (base schema L460) | Not applied to any new table | Inconsistency — see M9 |

### CRITICAL inconsistency: `password_reset_tokens` vs `password_resets`

- **Location:** Migration L1231, 1235, 1239; Base schema L239
- **Issue:** Base schema defines the table as `password_reset_tokens` (L239). The migration attempts to `ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY` (L1231) and creates a policy on `password_resets` (L1239). The table does not exist under that name in the base schema — the migration will fail with `relation "password_resets" does not exist`.
- **Fix:** Change all three references from `password_resets` to `password_reset_tokens` in the migration.

---

## 4. Trigger Function Bodies — All Present

All `CREATE OR REPLACE FUNCTION ... LANGUAGE plpgsql` declarations in the migration have valid bodies. Specifically verified:

- `record_integration_event` (L392) — body present, L397 `LANGUAGE plpgsql`
- `acquire_integration_sync_lock` (L418) — body present, L419 `LANGUAGE plpgsql`
- `safe_local_time` (L480) — body present, L481 `LANGUAGE plpgsql STABLE`
- `provision_organization` (L493) — body present, L498 `LANGUAGE plpgsql`
- `viewable_user_ids` (L524) — body present, L525 `LANGUAGE plpgsql STABLE`
- `lock_organization_row` (L565) — body present, L566 `LANGUAGE plpgsql`
- `is_manager_of` (L576) — body present, L577 `LANGUAGE plpgsql STABLE`
- `set_org_integration_installer_null` (L606) — body present, L614 `LANGUAGE plpgsql`
- `enforce_min_org_owner` (L626) — body present, L643 `LANGUAGE plpgsql`
- `verify_slack_session_org` (L655) — body present, L685 `LANGUAGE plpgsql`
- `team_closure_after_insert` (L696) — body present, L710 `LANGUAGE plpgsql`
- `teams_parent_cycle_guard` (L718) — body present, L737 `LANGUAGE plpgsql`
- `team_closure_after_reparent` (L745) — body present, L772 `LANGUAGE plpgsql`
- `verify_team_department_org` (L784) — body present, L794 `LANGUAGE plpgsql`
- `verify_goal_relations_org` (L802) — body present, L824 `LANGUAGE plpgsql`
- `prevent_org_id_mutation` (L832) — body present, L840 `LANGUAGE plpgsql`
- `goals_parent_cycle_guard` (L892) — body present, L919 `LANGUAGE plpgsql`
- `recompute_goal_progress` (L935) — body present, L1012 `LANGUAGE plpgsql` (missing STABLE)
- `trigger_recompute_goal_progress_from_details` (L1015) — body present, L1033 `LANGUAGE plpgsql`
- `goals_after_changes_trigger` (L1048) — body present, L1082 `LANGUAGE plpgsql`
- `enforce_goal_structure_integrity` (L1095) — body present, L1145 `LANGUAGE plpgsql`

All trigger functions have bodies. No comment-only stubs.

---

## 5. Idempotency / Re-run Safety

- `CREATE TABLE IF NOT EXISTS` used for every table. OK.
- `DO $$` block for enums (L27-35) — checks `pg_type` before creating. OK.
- `CREATE OR REPLACE FUNCTION` for all functions. OK.
- `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` pattern used consistently. OK.
- `DROP POLICY IF EXISTS` + `CREATE POLICY` pattern used consistently. OK.
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` used for work_log_entries additions. OK.
- `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` used for check constraints. OK.
- **Exception:** The migration does NOT use `DROP TABLE IF EXISTS` for the four baseline tables in Section 2. If a previous run of this migration created `user_integrations` with the wrong schema, a re-run will not fix it. This is acceptable for a production migration but worth noting.

---

## 6. Top 5 Most Important Fixes

1. **C3 / M-Table-name-bug (password_resets → password_reset_tokens)** — the migration will fail to apply on a real database because of a table name mismatch.
2. **C2** — enable RLS on the four Section 2 tables; the migration claims defense-in-depth but skips these.
3. **C3** — drop the composite `fk_goal_updates_org_member` FK; it forces `user_id` to be NOT NULL, contradicting the audit-trail intent.
4. **H6** — backfill `team_closure` for existing teams on migration run.
5. **H5** — wrap `provision_organization` in a transaction with rollback on partial failure.

---

## 7. Files Audited

- `D:\Vibe Coded\worklog-ai\supabase-migrations\2026-06-16_teams_goals_integrations.sql` (1245 lines)
- `D:\Vibe Coded\worklog-ai\supabase-schema.sql` (515 lines)
- `D:\Vibe Coded\worklog-ai\server\src\**\*.ts` (RPC call sites, 50+ files)

No file modifications were made.
