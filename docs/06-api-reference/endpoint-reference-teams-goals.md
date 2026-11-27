# API Reference: Teams & Goals

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Organizations (`/api/orgs`)

### 1.1 `POST /api/orgs`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ name: string, slug: string }` |
| Success | 201 `{ success: true, data: Organization }` |
| Errors | 401, 400 (validation, slug taken), 500 |

**Flow:**
1. Insert `organizations`
2. Insert `org_members` (creator as `owner`)
3. PostHog `org_created`

**Response (`Organization`):**
```json
{
  "id": "uuid",
  "name": "string",
  "slug": "string",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

### 1.2 `GET /api/orgs`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: Organization[] }` |
| Errors | 401, 500 |

**Returns:** User's organizations (via `org_members`).

---

### 1.3 `GET /api/orgs/:orgId/members`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` |
| Path params | `orgId` (uuid) |
| Success | 200 `{ success: true, data: OrgMember[] }` |
| Errors | 401, 403, 404, 500 |

**Response (`OrgMember[]`):**
```json
[
  {
    "id": "uuid",
    "org_id": "uuid",
    "user_id": "uuid",
    "role": "'member'|'admin'|'owner'",
    "created_at": "ISO8601",
    "updated_at": "ISO8601",
    "user": { "id": "uuid", "email": "string", "name": "string|null" }
  }
]
```

---

### 1.4 `POST /api/orgs/:orgId/departments`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('admin')` |
| Path params | `orgId` (uuid) |
| Request body | `{ name: string }` |
| Success | 201 `{ success: true, data: Department }` |
| Errors | 401, 403, 400, 500 |

---

### 1.5 `POST /api/orgs/:orgId/teams`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('admin')` |
| Path params | `orgId` (uuid) |
| Request body | `{ name: string, parentTeamId?: string|null, departmentId?: string|null }` |
| Success | 201 `{ success: true, data: Team }` |
| Errors | 401, 403, 400, 500 |

**Side effect:** Calls `teamService.rebuildClosure(orgId)` after create.

---

### 1.6 `POST /api/orgs/:orgId/rebuild-closure`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('owner')` |
| Path params | `orgId` (uuid) |
| Success | 200 `{ success: true, message: "Team closure rebuilt" }` |
| Errors | 401, 403, 500 |

**Calls:** `teamService.rebuildClosure(orgId)` → RPC `rebuild_team_closure`.

---

### 1.7 `GET /api/orgs/:orgId/goals`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` |
| Path params | `orgId` (uuid) |
| Success | 200 `{ success: true, data: GoalWithDetails[] }` |
| Errors | 401, 403, 500 |

---

## 2. Teams (`/api/teams`)

### 2.1 `PUT /api/teams/:teamId/reparent`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireTeamRole('admin')` |
| Path params | `teamId` (uuid) |
| Request body | `{ parentTeamId: string|null }` |
| Success | 200 `{ success: true, data: Team }` |
| Errors | 401, 403, 400 (cycle), 500 |

**Side effect:** Rebuilds closure.

---

### 2.2 `DELETE /api/teams/:teamId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireTeamRole('admin')` |
| Path params | `teamId` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 403, 500 |

**Cascades:** Removes `team_members`, updates closure.

---

### 2.3 `GET /api/teams/:teamId/my-role`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `teamId` (uuid) |
| Success | 200 `{ success: true, data: { role: TeamRole|null } }` |
| Errors | 401, 404, 500 |

**Computes:** `authz.getEffectiveTeamRole` (direct + org + ancestors).

---

### 2.4 `POST /api/teams/:teamId/members`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireTeamRole('admin')` |
| Path params | `teamId` (uuid) |
| Request body | `{ userId: string, role: TeamRole }` |
| Success | 201 `{ success: true, data: TeamMember }` |
| Errors | 401, 403, 400 (user not in org), 500 |

**Validation:** User must be org member (`authz.canViewUser`).

---

### 2.5 `PUT /api/teams/:teamId/members/:userId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireTeamRole('admin')` |
| Path params | `teamId`, `userId` (uuid) |
| Request body | `{ role: TeamRole }` |
| Success | 200 `{ success: true, data: TeamMember }` |
| Errors | 401, 403, 404, 500 |

---

### 2.6 `DELETE /api/teams/:teamId/members/:userId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireTeamRole('admin')` |
| Path params | `teamId`, `userId` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 403, 404, 500 |

---

## 3. Goals (`/api/goals`)

### 3.1 `POST /api/goals`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ orgId, scope, title, period, startDate, dueDate, teamId?, departmentId?, parentGoalId?, description?, progressMode? }` |
| Validation | Scope-specific required fields |
| Success | 201 `{ success: true, data: Goal }` |
| Errors | 401, 400, 403 (not org member), 500 |

**Scope rules:**
- `organization`: no `teamId`/`departmentId`
- `department`: requires `departmentId`
- `team`: requires `teamId`
- `individual`: no `teamId`/`departmentId`, creator auto-assigned

**Response (`Goal`):**
```json
{
  "id": "uuid",
  "org_id": "uuid",
  "scope": "'organization'|'department'|'team'|'individual'",
  "team_id": "uuid|null",
  "department_id": "uuid|null",
  "parent_goal_id": "uuid|null",
  "title": "string",
  "description": "string|null",
  "status": "'draft'|'active'|'at_risk'|'completed'|'cancelled'",
  "period": "'weekly'|'monthly'|'quarterly'|'annual'|'custom'",
  "start_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "progress": "number",
  "progress_mode": "'manual'|'key_results'|'linked_items'",
  "rollup_weight": "number",
  "created_by": "uuid|null",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

### 3.2 `GET /api/goals/:goalId`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `goalId` (uuid) |
| Success | 200 `{ success: true, data: GoalWithDetails }` |
| Errors | 401, 404, 500 |

**Response (`GoalWithDetails`):**
```json
{
  "goal": "Goal",
  "key_results": "GoalKeyResult[]",
  "links": "GoalLink[]",
  "assignees": "GoalAssignee[]",
  "updates": "GoalUpdate[]"
}
```

---

### 3.3 `PATCH /api/goals/:goalId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId` (uuid) |
| Request body | Partial `UpdateGoalRequest` |
| Success | 200 `{ success: true, data: Goal }` |
| Errors | 401, 403 (cannot edit), 404, 500 |

**Authorization:** `authz.canEditGoal` checks:
- Org admin/owner → always
- Individual scope: creator OR assignee
- Team scope: `canManageTeamGoals` (≥ manager)
- Department scope: any team in dept where user ≥ manager
- Org scope: org admin/owner only

---

### 3.4 `DELETE /api/goals/:goalId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 403, 404, 500 |

---

### 3.5 `POST /api/goals/:goalId/key-results`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId` (uuid) |
| Request body | `{ title, metricType, targetValue, startValue?, unit?, weight?, sortOrder? }` |
| Success | 201 `{ success: true, data: GoalKeyResult }` |
| Errors | 401, 403, 404, 500 |

---

### 3.6 `PATCH /api/goals/:goalId/key-results/:krId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId`, `krId` (uuid) |
| Request body | Partial `CreateKeyResultRequest` |
| Success | 200 `{ success: true, data: GoalKeyResult }` |
| Errors | 401, 403, 404, 500 |

---

### 3.7 `POST /api/goals/:goalId/assignees`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId` (uuid) |
| Request body | `{ userId: string }` |
| Validation | User must be org member |
| Success | 201 `{ success: true, data: GoalAssignee }` |
| Errors | 401, 403, 400, 404, 500 |

---

### 3.8 `DELETE /api/goals/:goalId/assignees/:userId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId`, `userId` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 403, 404, 500 |

---

### 3.9 `POST /api/goals/:goalId/checkins`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId` (uuid) |
| Request body | `{ progress?: number, status?: GoalStatus, note?: string }` |
| Success | 201 `{ success: true, data: GoalUpdate }` |
| Errors | 401, 403, 404, 500 |

**Side effect:** Updates `goals.progress` and `goals.status` if provided.

---

### 3.10 `POST /api/goals/:goalId/links`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId` (uuid) |
| Request body | `{ url: string, label?: string, weight?: number }` |
| Parsing | Extracts provider (Jira/GitHub), external_id, key from URL |
| Success | 201 `{ success: true, data: GoalLink }` |
| Errors | 401, 403, 400 (invalid URL), 404, 500 |

**Response (`GoalLink`):**
```json
{
  "id": "uuid",
  "goal_id": "uuid",
  "provider": "'jira'|'github'",
  "link_type": "string",
  "external_id": "string",
  "external_key": "string",
  "external_url": "string",
  "title": "string",
  "state": "string|null",
  "is_done": "boolean",
  "weight": "number",
  "created_by": "uuid|null",
  "org_id": "uuid",
  "metadata": "object|null",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

### 3.11 `DELETE /api/goals/:goalId/links/:linkId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId`, `linkId` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 403, 404, 500 |

---

### 3.12 `PUT /api/goals/:goalId/parent`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `canEditGoal` |
| Path params | `goalId` (uuid) |
| Request body | `{ parentGoalId: string|null }` |
| Validation | No cycles, same org |
| Success | 200 `{ success: true, data: Goal }` |
| Errors | 401, 403, 400 (cycle), 404, 500 |

---

## Related documents

- [API overview](./api-overview.md)
- [Auth architecture](../02-architecture/auth-and-authorization.md)
- [Backend teams/goals functions](../04-function-documentation/backend-teams-goals.md)

## Verification notes

All endpoints traced from `server/src/routes/organizations.ts`, `teams.ts`, `goals.ts` at commit `7567207`. Authorization logic from `authz.ts`. Not verified at runtime: team closure rebuild performance, goal rollup correctness under concurrent updates.