# Backend Functions: Teams, Goals, Subscriptions & Reports

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Function inventory

| Function | File:line | Kind | Exported | Tier | Purpose |
|---|---|---|---|---|---|
| `organizationsRoutes.post('/')` | `routes/organizations.ts:24` | Route | No | A | Create org + owner membership |
| `organizationsRoutes.get('/')` | `routes/organizations.ts:60` | Route | No | A | List user's orgs |
| `organizationsRoutes.get('/:orgId/members')` | `routes/organizations.ts:71` | Route | No | A | List org members |
| `organizationsRoutes.post('/:orgId/departments')` | `routes/organizations.ts:86` | Route | No | A | Create department |
| `organizationsRoutes.post('/:orgId/teams')` | `routes/organizations.ts:104` | Route | No | A | Create team + rebuild closure |
| `organizationsRoutes.post('/:orgId/rebuild-closure')` | `routes/organizations.ts:124` | Route | No | A | Rebuild team_closure (owner) |
| `organizationsRoutes.get('/:orgId/goals')` | `routes/organizations.ts:139` | Route | No | A | List org goals |
| `teamsRoutes.put('/:teamId/reparent')` | `routes/teams.ts:23` | Route | No | A | Change team parent |
| `teamsRoutes.delete('/:teamId')` | `routes/teams.ts:66` | Route | No | A | Delete team |
| `teamsRoutes.get('/:teamId/my-role')` | `routes/teams.ts:83` | Route | No | A | Get effective team role |
| `teamsRoutes.post('/:teamId/members')` | `routes/teams.ts:95` | Route | No | A | Add team member |
| `teamsRoutes.put('/:teamId/members/:userId')` | `routes/teams.ts:136` | Route | No | A | Update member role |
| `teamsRoutes.delete('/:teamId/members/:userId')` | `routes/teams.ts:157` | Route | No | A | Remove member |
| `goalsRoutes.post('/')` | `routes/goals.ts:23` | Route | No | A | Create goal |
| `goalsRoutes.get('/:goalId')` | `routes/goals.ts:66` | Route | No | A | Get goal with details |
| `goalsRoutes.patch('/:goalId')` | `routes/goals.ts:96` | Route | No | A | Update goal (canEditGoal) |
| `goalsRoutes.delete('/:goalId')` | `routes/goals.ts:111` | Route | No | A | Delete goal (canEditGoal) |
| `goalsRoutes.post('/:goalId/key-results')` | `routes/goals.ts:129` | Route | No | A | Add key result |
| `goalsRoutes.patch('/:goalId/key-results/:krId')` | `routes/goals.ts:150` | Route | No | A | Update key result |
| `goalsRoutes.post('/:goalId/assignees')` | `routes/goals.ts:168` | Route | No | A | Add assignee |
| `goalsRoutes.delete('/:goalId/assignees/:userId')` | `routes/goals.ts:201` | Route | No | A | Remove assignee |
| `goalsRoutes.post('/:goalId/checkins')` | `routes/goals.ts:219` | Route | No | A | Progress check-in |
| `goalsRoutes.post('/:goalId/links')` | `routes/goals.ts:276` | Route | No | A | Link Jira/GitHub item |
| `goalsRoutes.delete('/:goalId/links/:linkId')` | `routes/goals.ts:327` | Route | No | A | Remove link |
| `goalsRoutes.put('/:goalId/parent')` | `routes/goals.ts:345` | Route | No | A | Set parent goal |
| `subscriptionsRoutes.get('/:orgId')` | `routes/subscriptions.ts:24` | Route | No | A | Get org subscription |
| `reportsRoutes.post('/:orgId/generate')` | `routes/reports.ts:24` | Route | No | A | Generate AI report (enterprise) |
| `reportsRoutes.get('/:orgId')` | `routes/reports.ts:64` | Route | No | A | List reports |
| `reportsRoutes.get('/:orgId/:reportId')` | `routes/reports.ts:85` | Route | No | A | Get report |
| `channelPreferenceRoutes.get('/:orgId/mine')` | `routes/channelPreferences.ts:20` | Route | No | A | User's channel prefs |
| `channelPreferenceRoutes.put('/:orgId')` | `routes/channelPreferences.ts:37` | Route | No | A | Upsert channel pref |
| `channelPreferenceRoutes.delete('/:orgId/:prefId')` | `routes/channelPreferences.ts:77` | Route | No | A | Delete channel pref |
| `channelPreferenceRoutes.get('/:orgId/team-slack')` | `routes/channelPreferences.ts:93` | Route | No | A | Team Slack channels |
| `channelPreferenceRoutes.post('/:orgId/team-slack')` | `routes/channelPreferences.ts:112` | Route | No | A | Create team Slack pref |
| `getUserOrgRole` | `services/authz.ts:44` | Function | Yes | A | Org role from org_members |
| `getEffectiveTeamRole` | `services/authz.ts:64` | Function | Yes | A | Max of direct + org + ancestor roles |
| `getViewableUserIds` | `services/authz.ts:124` | Function | Yes | A | RPC: viewable users in org |
| `canManageTeamConfig` | `services/authz.ts:136` | Function | Yes | A | Role ≥ admin |
| `canManageTeamGoals` | `services/authz.ts:144` | Function | Yes | A | Role ≥ manager |
| `canViewUser` | `services/authz.ts:152` | Function | Yes | A | Can view other user in org |
| `canEditGoal` | `services/authz.ts:168` | Function | Yes | A | Scope-based goal edit check |
| `requireOrgRole` | `services/authz.ts:239` | Middleware | Yes | A | Org role gate (params only) |
| `requireTeamRole` | `services/authz.ts:265` | Middleware | Yes | A | Team role gate (params only) |
| `teamService.createOrg` | `services/teamService.ts` | Function | Yes | A | Create org + owner membership |
| `teamService.createTeam` | `services/teamService.ts` | Function | Yes | A | Create team + membership + closure |
| `teamService.rebuildClosure` | `services/teamService.ts` | Function | Yes | A | RPC rebuild_team_closure |
| `teamService.addTeamMember` | `services/teamService.ts` | Function | Yes | A | Add member + role |
| `teamService.getUserOrgs` | `services/teamService.ts` | Function | Yes | A | User's orgs |
| `goalService.createGoal` | `services/goalService.ts` | Function | Yes | A | Create goal with scope validation |
| `goalService.rollupGoalProgress` | `services/goalService.ts` | Function | Yes | A | Walk parent_goal_id tree |
| `subscriptionService.getOrgTier` | `services/subscriptionService.ts:92` | Function | Yes | A | Tier from subscriptions table |
| `subscriptionService.isFeatureEnabled` | `services/subscriptionService.ts:118` | Function | Yes | A | Feature gate check |
| `subscriptionService.clearTierCache` | `services/subscriptionService.ts:39` | Function | Yes | B | Clear 60s tier cache |
| `reportGenerationService.generateReport` | `services/reportGenerationService.ts` | Function | Yes | A | AI report generation |
| `activityAggregationService.aggregateUserActivity` | `services/activityAggregationService.ts` | Function | Yes | A | Aggregate GitHub/Jira/Slack data |

---

## 2. Tier A functions (detailed)

### `getEffectiveTeamRole` — `server/src/services/authz.ts:64`

**Identity:** `getEffectiveTeamRole` / `services/authz.ts:64` / Function / Exported / async / A

**Purpose:** Compute user's effective team role = max(direct, org-mapped, ancestor teams).

**ELI5:** "What's your highest badge in this team?" — checks your direct badge, your org badge (promoted), and all ancestor team badges, takes the highest.

**Technical:**
1. Direct role: `team_members` WHERE `user_id` + `team_id` → `directRole`
2. Org role: `org_members` WHERE `user_id` + `org_id` → maps org admin→team admin, org owner→team owner → `orgCandidate`
3. Ancestor roles: `team_closure` WHERE `descendant_id = teamId` → `ancestor_id` → `team_members` WHERE `team_id IN (ancestors)` AND `role IN ('manager','admin','owner')` → `ancestorBest`
4. Returns `max(directRole, orgCandidate, ancestorBest)` by `TEAM_RANK`

**Rank maps:**
- `ORG_RANK`: `member:1, admin:2, owner:3`
- `TEAM_RANK`: `member:1, manager:2, admin:3, owner:4`

**Calls:** `supabase.from('team_members')`, `supabase.from('teams')`, `supabase.from('org_members')`, `supabase.from('team_closure')`

**Used by:** `requireTeamRole`, `canManageTeamConfig`, `canManageTeamGoals`, `canEditGoal`, `teamRoutes.get('/my-role')`

---

### `canEditGoal` — `server/src/services/authz.ts:168`

**Identity:** `canEditGoal` / `services/authz.ts:168` / Function / Exported / async / A

**Purpose:** Determine if user can edit a specific goal.

**ELI5:** "Can you edit this goal?" — checks scope rules: individual (creator/assignee), team (manager+), department (manager+ on any team), org (admin+).

**Technical:**
1. Load goal: `goals` WHERE `id = goalId` → `created_by, scope, team_id, department_id, org_id`
2. Org membership gate: `getUserOrgRole(db, userId, orgId)` → if null → false
3. Org admin/owner → true
4. Scope `individual`: `created_by === userId` OR `goal_assignees` has user → true
5. Scope `team`: `canManageTeamGoals(db, userId, goal.team_id)` → role ≥ manager
6. Scope `department`: for each team in dept, `canManageTeamGoals` → any true
7. Scope `organization`: false (already checked org admin)

**Calls:** `getUserOrgRole`, `canManageTeamGoals`, `supabase.from('goal_assignees')`, `supabase.from('teams')`, `supabase.from('goals')`

**Used by:** `goalsRoutes.patch/delete`, all goal mutation handlers

---

### `subscriptionService.getOrgTier` — `server/src/services/subscriptionService.ts:92`

**Identity:** `getOrgTier` / `services/subscriptionService.ts:92` / Function / Exported / async / A

**Purpose:** Resolve org's effective tier from `subscriptions` table.

**Technical:**
1. Checks 60s in-memory cache (`tierCache`)
2. `supabase.from('subscriptions').select('tier, status').eq('org_id', orgId).maybeSingle()`
3. If missing/error → returns `'free'` (fail-open)
4. If status NOT in `['active','trialing']` → returns `'free'`
5. Caches result for 60s
6. Returns tier

**Cache:** `Map<orgId, { tier, expires }>` with 60s TTL

**Used by:** `tierGate.requireTier`, `isFeatureEnabled`, `reportsRoutes`, `channelPreferenceRoutes`

---

### `reportGenerationService.generateReport` — `server/src/services/reportGenerationService.ts`

**Identity:** `generateReport` / `services/reportGenerationService.ts` / Function / Exported / async / A

**Purpose:** Generate AI performance report for org/team/user.

**Technical:**
1. Validates tier (enterprise) + permissions
2. Inserts `performance_reports` with `status='generating'`
2. Calls `activityAggregationService.aggregate*Activity` for target
3. Builds prompt via `aiSummaryService.buildReportPrompt`
3. Calls Mistral/OpenRouter
4. Updates `performance_reports` with `report_content`, `report_markdown`, `token_usage`, `status='completed'`
4. Returns `reportId`

**Used by:** `reportsRoutes.post('/generate')`

---

### `teamService.rebuildClosure` — `server/src/services/teamService.ts`

**Identity:** `rebuildClosure` / `services/teamService.ts` / Function / Exported / async / A

**Purpose:** Recompute `team_closure` table from `teams.parent_team_id`.

**Technical:**
1. Calls RPC `rebuild_team_closure(p_org_id := orgId)`
2. RPC walks `teams.parent_team_id` tree, populates `team_closure(ancestor_id, descendant_id, depth)`
3. Used after team create/delete/reparent

**Called by:** `organizationsRoutes.post('/teams')`, `teamsRoutes.put('/reparent')`, `teamsRoutes.delete`

---

## 4. Tier B functions (compact)

| Function | File:line | Purpose |
|---|---|---|
| `organizationsRoutes.post('/')` | `organizations.ts:24` | Create org + owner |
| `organizationsRoutes.get('/')` | `organizations.ts:60` | User's orgs |
| `organizationsRoutes.get('/:orgId/members')` | `organizations.ts:71` | Org members |
| `organizationsRoutes.post('/:orgId/departments')` | `organizations.ts:86` | Create dept |
| `organizationsRoutes.post('/:orgId/teams')` | `organizations.ts:104` | Create team + rebuild closure |
| `organizationsRoutes.post('/:orgId/rebuild-closure')` | `organizations.ts:124` | Rebuild closure (owner) |
| `organizationsRoutes.get('/:orgId/goals')` | `organizations.ts:139` | Org goals |
| `teamsRoutes.put('/:teamId/reparent')` | `teams.ts:23` | Change parent |
| `teamsRoutes.delete('/:teamId')` | `teams.ts:66` | Delete team + closure |
| `teamsRoutes.get('/:teamId/my-role')` | `teams.ts:83` | `getEffectiveTeamRole` |
| `teamsRoutes.post('/:teamId/members')` | `teams.ts:95` | Add member (admin) |
| `teamsRoutes.put('/:teamId/members/:userId')` | `teams.ts:136` | Update role (admin) |
| `teamsRoutes.delete('/:teamId/members/:userId')` | `teams.ts:157` | Remove member (admin) |
| `goalsRoutes.post('/')` | `goals.ts:23` | Create goal (scope validation) |
| `goalsRoutes.get('/:goalId')` | `goals.ts:66` | GoalWithDetails |
| `goalsRoutes.patch('/:goalId')` | `goals.ts:96` | Update (canEditGoal) |
| `goalsRoutes.delete('/:goalId')` | `goals.ts:111` | Delete (canEditGoal) |
| `goalsRoutes.post('/:goalId/key-results')` | `goals.ts:129` | Add KR |
| `goalsRoutes.patch('/:goalId/key-results/:krId')` | `goals.ts:150` | Update KR |
| `goalsRoutes.post('/:goalId/assignees')` | `goals.ts:168` | Add assignee |
| `goalsRoutes.delete('/:goalId/assignees/:userId')` | `goals.ts:201` | Remove assignee |
| `goalsRoutes.post('/:goalId/checkins')` | `goals.ts:219` | Check-in + rollup |
| `goalsRoutes.post('/:goalId/links')` | `goals.ts:276` | Parse URL → Jira/GitHub link |
| `goalsRoutes.delete('/:goalId/links/:linkId')` | `goals.ts:327` | Remove link |
| `goalsRoutes.put('/:goalId/parent')` | `goals.ts:345` | Set parent (cycle check) |
| `subscriptionsRoutes.get('/:orgId')` | `subscriptions.ts:24` | Get subscription |
| `reportsRoutes.get('/:orgId')` | `reports.ts:64` | List reports |
| `reportsRoutes.get('/:orgId/:reportId')` | `reports.ts:85` | Get report |
| `channelPreferenceRoutes.get('/:orgId/mine')` | `channelPreferences.ts:20` | User's prefs |
| `channelPreferenceRoutes.put('/:orgId')` | `channelPreferences.ts:37` | Upsert pref |
| `channelPreferenceRoutes.delete('/:orgId/:prefId')` | `channelPreferences.ts:77` | Delete pref |
| `channelPreferenceRoutes.get('/:orgId/team-slack')` | `channelPreferences.ts:93` | Team Slack channels |
| `channelPreferenceRoutes.post('/:orgId/team-slack')` | `channelPreferences.ts:112` | Create team Slack pref |
| `getUserOrgRole` | `authz.ts:44` | Org role from org_members |
| `getViewableUserIds` | `authz.ts:124` | RPC viewable users |
| `canManageTeamConfig` | `authz.ts:136` | Role ≥ admin |
| `canManageTeamGoals` | `authz.ts:144` | Role ≥ manager |
| `canViewUser` | `authz.ts:152` | Can view other user |
| `requireOrgRole` | `authz.ts:239` | Org role middleware |
| `requireTeamRole` | `authz.ts:265` | Team role middleware |
| `teamService.createOrg` | `teamService.ts` | Create org + owner |
| `teamService.createTeam` | `teamService.ts` | Create team + closure |
| `teamService.addTeamMember` | `teamService.ts` | Add member |
| `teamService.getUserOrgs` | `teamService.ts` | User's orgs |
| `goalService.createGoal` | `goalService.ts` | Create goal |
| `goalService.rollupGoalProgress` | `goalService.ts` | Walk parent tree |
| `subscriptionService.isFeatureEnabled` | `subscriptionService.ts:118` | Feature gate |
| `subscriptionService.clearTierCache` | `subscriptionService.ts:39` | Clear tier cache |
| `subscriptionService.getUserSyncFilters` | `subscriptionService.ts:47` | Jira/GitHub sync filters |
| `subscriptionService.getTeamSlackChannels` | `subscriptionService.ts:68` | Team Slack channels |

---

## Related documents

- [Teams & Goals endpoints](../06-api-reference/endpoint-reference-teams-goals.md)
- [Authz details](../02-architecture/auth-and-authorization.md)
- [Goals flow](../05-feature-flows/goals-and-okrs.md)
- [Organizations flow](../05-feature-flows/organizations-and-teams.md)

## Verification notes

All functions traced from source at commit `7567207`. Rollup accuracy under concurrent updates not verified at runtime. Payment provider integration not found.