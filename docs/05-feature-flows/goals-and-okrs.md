# Feature Flow: Goals & OKRs

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. What does this feature do?

Enables organizations to create hierarchical goals (OKRs) with key results, assignees, linked work items (Jira/GitHub), progress check-ins, and automatic progress rollups from children to parents.

---

## 2. User interaction trace

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant F as Frontend (Goals.tsx, TeamGoals.tsx)
    participant A as API (goalsRoutes)
    participant D as Database (goals, goal_key_results, goal_links, goal_assignees, goal_updates)
    participant Z as authz (authorization)

    %% LOAD GOALS (personal)
    F->>A: GET /api/goals (Bearer JWT)
    A->>Z: requireAuth → req.userId
    A->>D: SELECT * FROM goals WHERE org_id IN (user's orgs) AND (scope='individual' AND created_by=userId OR assignee=userId)
    A-->>F: 200 { success: true, data: GoalWithDetails[] }
    F->>B: Renders goal cards (GoalCard.tsx) with progress bars

    %% LOAD GOALS (team/org)
    F->>A: GET /api/orgs/:orgId/goals
    A->>Z: requireAuth + requireOrgRole('member')
    A->>D: SELECT * FROM goals WHERE org_id = :orgId
    A-->>F: 200 { success: true, data: GoalWithDetails[] }
    F->>B: Renders tree (TeamTree.tsx) with rollup progress

    %% CREATE GOAL
    U->>F: Clicks "New Goal" → fills form (GoalForm.tsx)
    U->>F: Selects scope (individual/team/department/org), period, dates
    F->>A: POST /api/goals { orgId, scope, title, period, startDate, dueDate, teamId?, departmentId?, parentGoalId?, description?, progressMode? }
    A->>Z: requireAuth + canEditGoal (org membership + scope rules)
    A->>D: INSERT INTO goals (org_id, scope, team_id, department_id, parent_goal_id, title, period, start_date, due_date, progress_mode, created_by)
    A-->>F: 201 { success: true, data: Goal }
    F->>B: Adds to list/tree

    %% ADD KEY RESULTS
    U->>F: Opens goal → "Add Key Result" (KeyResultEditor.tsx)
    F->>A: POST /api/goals/:goalId/key-results { title, metricType, targetValue, startValue?, unit?, weight?, sortOrder? }
    A->>Z: requireAuth + canEditGoal
    A->>D: INSERT INTO goal_key_results
    A-->>F: 201 { success: true, data: GoalKeyResult }
    F->>B: Updates goal progress (if progress_mode='key_results')

    %% LINK WORK ITEM (Jira/GitHub)
    U->>F: "Add Link" → pastes URL (LinkEditor.tsx)
    F->>A: POST /api/goals/:goalId/links { url, label?, weight? }
    A->>Z: requireAuth + canEditGoal
    A->>A: Parse URL → extract provider, external_id, external_key
    A->>D: INSERT INTO goal_links (provider, external_id, external_key, external_url, title, is_done, weight)
    A-->>F: 201 { success: true, data: GoalLink }
    F->>B: Shows link with status badge

    %% CHECK-IN (progress update)
    U->>F: "Check In" → enters progress %, status, note (GoalProgressBar.tsx)
    F->>A: POST /api/goals/:goalId/checkins { progress?, status?, note? }
    A->>Z: requireAuth + canEditGoal
    A->>D: INSERT INTO goal_updates + UPDATE goals SET progress=?, status=?
    A->>A: goalService.rollupGoalProgress(goalId) → walks parent_goal_id tree
    A-->>F: 200 { success: true, data: GoalUpdate }
    F->>B: Updates progress bar, triggers parent rollup

    %% ROLLUP (background job)
    participant J as goalRollupJob (daily 3 AM)
    J->>D: SELECT goals WHERE progress_mode IN ('key_results','linked_items')
    loop For each goal
        J->>A: goalService.rollupGoalProgress(goalId)
        J->>A: Recalculate from children/KRs/links → UPDATE goals SET progress=?
    end
```

---

## 3. Files involved

| File | Responsibility |
|---|---|
| `server/src/routes/goals.ts` | 12 handlers: CRUD, KRs, assignees, check-ins, links, parent |
| `server/src/services/goalService.ts` | `createGoal`, `rollupGoalProgress`, `canEditGoal` checks |
| `server/src/services/authz.ts` | `canEditGoal`, `getEffectiveTeamRole`, `requireOrgRole`, `requireTeamRole` |
| `server/src/services/teamService.ts` | Team hierarchy for scope checks |
| `server/src/jobs/goalRollupJob.ts` | Daily rollup cron |
| `server/src/jobs/goalDigestJob.ts` | Daily goal reminder emails |
| `client/src/pages/Goals.tsx` | Personal goals list |
| `client/src/pages/TeamGoals.tsx` | Team/org goal tree |
| `client/src/components/goals/GoalCard.tsx` | Goal display with progress |
| `client/src/components/goals/GoalForm.tsx` | Create/edit goal modal |
| `client/src/components/goals/GoalProgressBar.tsx` | Visual progress |
| `client/src/components/goals/KeyResultEditor.tsx` | KR list management |
| `client/src/components/goals/LinkEditor.tsx` | Jira/GitHub link management |
| `client/src/components/goals/AssigneePicker.tsx` | Multi-select assignees |
| `client/src/lib/goalsApi.ts` | All goal API calls |

---

## 4. Functions involved (in execution order)

### Create goal
1. `Goals.tsx` / `TeamGoals.tsx` → `createGoal()` → `goalsApi.ts`
2. `goalsRoutes.post('/')` → `server/src/routes/goals.ts:23`
3. `authz.canEditGoal` → `authz.ts:168` (scope-specific checks)
4. `goalService.createGoal` → `goalService.ts`

### Add key result
1. `KeyResultEditor.tsx` → `addKeyResult()` → `goalsApi.ts`
2. `goalsRoutes.post('/:goalId/key-results')` → `goals.ts:129`
3. `authz.canEditGoal` → `authz.ts:168`
4. Insert `goal_key_results`

### Link work item
1. `LinkEditor.tsx` → `addLink()` → `goalsApi.ts`
2. `goalsRoutes.post('/:goalId/links')` → `goals.ts:276`
3. Parse URL → `jiraAdapter` / `githubAdapter` extract IDs
4. Insert `goal_links` (unique on goal_id + provider + external_id)

### Check-in
1. `GoalProgressBar.tsx` → `addCheckIn()` → `goalsApi.ts`
2. `goalsRoutes.post('/:goalId/checkins')` → `goals.ts:219`
3. `authz.canEditGoal` → `authz.ts:168`
4. Insert `goal_updates` + `UPDATE goals SET progress, status`
5. `goalService.rollupGoalProgress(goalId)` → walks `parent_goal_id` tree

### Rollup job
1. `goalRollupJob.start()` → `server/src/jobs/goalRollupJob.ts`
2. For each goal with `progress_mode` in ('key_results','linked_items'):
   - `goalService.rollupGoalProgress(goalId)`
   - Recalculate from children/KRs/links → `UPDATE goals SET progress`

---

## 5. Data transformation

| Stage | Data shape |
|---|---|
| Create request | `{ orgId, scope, title, period, startDate, dueDate, teamId?, departmentId?, parentGoalId?, description?, progressMode? }` |
| Goal response | `GoalWithDetails` (goal + key_results[] + links[] + assignees[] + updates[]) |
| KR request | `{ title, metricType, targetValue, startValue?, unit?, weight?, sortOrder? }` |
| Link request | `{ url, label?, weight? }` → parsed to provider, external_id, external_key |
| Check-in request | `{ progress?, status?, note? }` |
| Rollup input | Children goals + KRs + links |
| Rollup output | `UPDATE goals SET progress = calculated_value` |

---

## 6. Failure scenarios

| Failure point | Behavior |
|---|---|
| User not org member | 403 (authz gates before handler) |
| Cannot edit goal (scope) | 403 from `canEditGoal` |
| Invalid parent goal (cycle) | 400 from `setParentGoal` validation |
| Duplicate KR/link | 409 (unique constraints) |
| Rollup job error | Logs error; continues with next goal |
| 401 on request | `apiRequest` refreshes token → retries |

---

## 7. Simple story

Think of a **corporate goal pyramid**:

1. **CEO sets company OKR** (org scope) → "Grow revenue 20%"
2. **VP breaks it down** (team scope) → "Launch 3 features" → linked to Jira epics
3. **Team lead adds key results** → "Feature A shipped", "Feature B shipped"
4. **Engineer checks in** → "Feature A 100% done" → progress rolls up to team → VP → CEO
5. **Daily job recalculates** all rollups so dashboards stay current
6. **Weekly digest emails** remind assignees to check in

---

## Related documents

- [Teams & Goals endpoints](../06-api-reference/endpoint-reference-teams-goals.md)
- [Goal functions](../04-function-documentation/backend-teams-goals.md)
- [Authz details](../02-architecture/auth-and-authorization.md)
- [Client goals API](../04-function-documentation/frontend-hooks-context-lib.md)

## Verification notes

All paths traced from `server/src/routes/goals.ts`, `server/src/services/goalService.ts`,
`server/src/services/authz.ts`, `client/src/pages/Goals.tsx`,
`client/src/components/goals/*` at commit `7567207`.
Not verified at runtime: rollup accuracy under concurrent updates, job scheduling.