/**
 * server/src/__tests__/authz.test.ts
 *
 * Behavioral (table-driven) tests for the authorization predicates in
 * `server/src/services/authz.ts`. These run without a DB or network — they
 * use a tiny chainable mock Supabase client that responds to a scenario
 * description.
 *
 * Why this is the most security-critical test file in the repo:
 * - `getEffectiveTeamRole` is the single function that decides whether a
 *   user can manage a team. A wrong rank table or a missed branch lets a
 *   non-member read or edit team goals (post-Bug CP / Bug N / Bug D
 *   regressions would all land here).
 * - `canEditGoal` is the single function that decides whether a user can
 *   edit a goal. A wrong path (skipping the org-membership-first gate, or
 *   mis-classifying scope) is a privilege escalation.
 *
 * Run: `npx vitest run server/src/__tests__/authz.test.ts`
 */

// Set env vars BEFORE importing the module under test (crypto.ts reads
// INTEGRATION_ENCRYPTION_KEYS at module load time).
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-or-more-aaaaaaaa'
process.env.INTEGRATION_ENCRYPTION_KEYS = 'a'.repeat(64) // 32 bytes hex

import { describe, it, expect } from 'vitest'
import {
  getUserOrgRole,
  getEffectiveTeamRole,
  getViewableUserIds,
  canManageTeamConfig,
  canManageTeamGoals,
  canViewUser,
  canEditGoal,
  orgRoleAtLeast,
  teamRoleAtLeast,
} from '../services/authz.js'

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

/**
 * A scenario is a record of: for each table, what rows exist; the test
 * builds a query layer that matches `.from(t).eq(col, val)` filters and
 * returns the matching rows.
 *
 * The mock supports the methods used by authz.ts:
 *   .from(t).select(...).eq(col, val).maybeSingle()
 *   .from(t).select(...).eq(col, val).in(col, [...])
 *   .rpc('viewable_user_ids', { p_user_id, p_org_id })
 *
 * It is intentionally NOT a full PostgREST emulator — it is a tool for
 * exercising the authz predicates with controlled data.
 */
interface MockRow {
  [key: string]: any
}

interface Scenario {
  org_members?: MockRow[]                  // { org_id, user_id, role }
  teams?: MockRow[]                        // { id, org_id }
  team_members?: MockRow[]                 // { team_id, user_id, role }
  team_closure?: MockRow[]                 // { ancestor_id, descendant_id, depth }
  goals?: MockRow[]                        // { id, org_id, scope, created_by, team_id, department_id }
  goal_assignees?: MockRow[]               // { goal_id, user_id }
  viewable_user_ids?: { [orgId: string]: Record<string, string[]> } // orgId -> userId -> list
}

function makeMockDb(scenario: Scenario) {
  // Helper: filter rows by a list of {col, val} predicates (eq, in, neq).
  function filterRows(rows: MockRow[], preds: Array<{ col: string; op: 'eq' | 'in' | 'neq'; val: any }>): MockRow[] {
    return rows.filter(r => preds.every(p => {
      if (p.op === 'eq') return r[p.col] === p.val
      if (p.op === 'neq') return r[p.col] !== p.val
      if (p.op === 'in') return Array.isArray(p.val) && p.val.includes(r[p.col])
      return false
    }))
  }

  // Build a chainable query for a given table.
  function makeQuery(table: string) {
    const preds: Array<{ col: string; op: 'eq' | 'in' | 'neq'; val: any }> = []
    // The terminal shape depends on the last method called:
    //   - .maybeSingle() / .single() → { data: <row|null>, error: null }
    //   - none of the above (used as `await chain` or destructured) →
    //     { data: <array of all matching rows>, error: null }
    // The chain is itself thenable so `await chain` returns the same
    // shape as a PostgREST array response.
    const buildResponse = () => {
      const rows = (scenario as any)[table] || []
      const matches = filterRows(rows, preds)
      return { data: matches, error: null }
    }
    const buildSingleResponse = () => {
      const rows = (scenario as any)[table] || []
      const matches = filterRows(rows, preds)
      return { data: matches[0] ?? null, error: null }
    }
    const chain: any = {
      eq(col: string, val: any) { preds.push({ col, op: 'eq', val }); return chain },
      neq(col: string, val: any) { preds.push({ col, op: 'neq', val }); return chain },
      in(col: string, vals: any[]) { preds.push({ col, op: 'in', val: vals }); return chain },
      select() { return chain },
      maybeSingle: async () => buildSingleResponse(),
      single: async () => buildSingleResponse(),
      // Make the chain itself awaitable. The actual response shape
      // (array vs single) is decided by the LAST method called, but if
      // the caller does `await chain` (no terminal), the array form is
      // the safest default.
      then(onFulfilled: any, onRejected: any) {
        return Promise.resolve(buildResponse()).then(onFulfilled, onRejected)
      },
    }
    return chain
  }

  return {
    from(table: string) { return makeQuery(table) },
    rpc(fn: string, args: Record<string, any>) {
      if (fn === 'viewable_user_ids') {
        const orgMap = scenario.viewable_user_ids || {}
        const list = (orgMap[args.p_org_id] || {})[args.p_user_id] || []
        return Promise.resolve({ data: list, error: null })
      }
      return Promise.resolve({ data: null, error: new Error(`Unknown RPC: ${fn}`) })
    },
  } as any
}

// ---------------------------------------------------------------------------
// orgRoleAtLeast / teamRoleAtLeast — rank table boundary tests
// ---------------------------------------------------------------------------

describe('authz: orgRoleAtLeast (rank table)', () => {
  it('null role never satisfies', () => {
    expect(orgRoleAtLeast(null, 'member')).toBe(false)
    expect(orgRoleAtLeast(null, 'admin')).toBe(false)
    expect(orgRoleAtLeast(null, 'owner')).toBe(false)
  })
  it('member satisfies member but not admin/owner', () => {
    expect(orgRoleAtLeast('member', 'member')).toBe(true)
    expect(orgRoleAtLeast('member', 'admin')).toBe(false)
    expect(orgRoleAtLeast('member', 'owner')).toBe(false)
  })
  it('admin satisfies member+admin but not owner', () => {
    expect(orgRoleAtLeast('admin', 'member')).toBe(true)
    expect(orgRoleAtLeast('admin', 'admin')).toBe(true)
    expect(orgRoleAtLeast('admin', 'owner')).toBe(false)
  })
  it('owner satisfies everything', () => {
    expect(orgRoleAtLeast('owner', 'member')).toBe(true)
    expect(orgRoleAtLeast('owner', 'admin')).toBe(true)
    expect(orgRoleAtLeast('owner', 'owner')).toBe(true)
  })
})

describe('authz: teamRoleAtLeast (rank table)', () => {
  it('null role never satisfies', () => {
    expect(teamRoleAtLeast(null, 'member')).toBe(false)
    expect(teamRoleAtLeast(null, 'manager')).toBe(false)
    expect(teamRoleAtLeast(null, 'admin')).toBe(false)
    expect(teamRoleAtLeast(null, 'owner')).toBe(false)
  })
  it('member satisfies member but not manager/admin/owner', () => {
    expect(teamRoleAtLeast('member', 'member')).toBe(true)
    expect(teamRoleAtLeast('member', 'manager')).toBe(false)
    expect(teamRoleAtLeast('member', 'admin')).toBe(false)
    expect(teamRoleAtLeast('member', 'owner')).toBe(false)
  })
  it('manager satisfies member+manager but not admin/owner', () => {
    expect(teamRoleAtLeast('manager', 'member')).toBe(true)
    expect(teamRoleAtLeast('manager', 'manager')).toBe(true)
    expect(teamRoleAtLeast('manager', 'admin')).toBe(false)
    expect(teamRoleAtLeast('manager', 'owner')).toBe(false)
  })
  it('admin satisfies member+manager+admin but not owner', () => {
    expect(teamRoleAtLeast('admin', 'manager')).toBe(true)
    expect(teamRoleAtLeast('admin', 'admin')).toBe(true)
    expect(teamRoleAtLeast('admin', 'owner')).toBe(false)
  })
  it('owner satisfies everything', () => {
    expect(teamRoleAtLeast('owner', 'member')).toBe(true)
    expect(teamRoleAtLeast('owner', 'manager')).toBe(true)
    expect(teamRoleAtLeast('owner', 'admin')).toBe(true)
    expect(teamRoleAtLeast('owner', 'owner')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getUserOrgRole — return shape and "non-member is null" guarantee
// ---------------------------------------------------------------------------

describe('authz: getUserOrgRole', () => {
  it('returns the role for a member', async () => {
    const db = makeMockDb({
      org_members: [
        { org_id: 'O1', user_id: 'U1', role: 'admin' },
      ],
    })
    expect(await getUserOrgRole(db, 'U1', 'O1')).toBe('admin')
  })

  it('returns null for a non-member (uses maybeSingle, not .single)', async () => {
    const db = makeMockDb({ org_members: [] })
    expect(await getUserOrgRole(db, 'U404', 'O1')).toBeNull()
  })

  it('returns the right role when multiple memberships exist', async () => {
    const db = makeMockDb({
      org_members: [
        { org_id: 'O1', user_id: 'U1', role: 'member' },
        { org_id: 'O2', user_id: 'U1', role: 'admin' },
        { org_id: 'O1', user_id: 'U2', role: 'owner' },
      ],
    })
    expect(await getUserOrgRole(db, 'U1', 'O1')).toBe('member')
    expect(await getUserOrgRole(db, 'U1', 'O2')).toBe('admin')
    expect(await getUserOrgRole(db, 'U2', 'O1')).toBe('owner')
  })
})

// ---------------------------------------------------------------------------
// getEffectiveTeamRole — Bug C / Bug CP / Bug N / Bug D branches
// ---------------------------------------------------------------------------

describe('authz: getEffectiveTeamRole (Bug C, Bug CP, Bug N regressions)', () => {
  it('non-member with no org role returns null', async () => {
    const db = makeMockDb({
      org_members: [],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T1')).toBeNull()
  })

  it('direct member returns member', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'member' }],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T1')).toBe('member')
  })

  it('direct manager returns manager', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'manager' }],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T1')).toBe('manager')
  })

  it('org admin maps to team admin (Bug CP — NOT short-circuited)', async () => {
    // User is org admin but NOT a team member. They should get team 'admin'.
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'admin' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T1')).toBe('admin')
  })

  it('org owner maps to team owner', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'owner' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T1')).toBe('owner')
  })

  it('Bug N: ancestor "member" role is EXCLUDED from effective role', async () => {
    // User is direct manager of T1, and 'member' of ancestor T_root via
    // team_closure. The ancestor member should NOT pull the effective role
    // down to 'member' — direct 'manager' wins.
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T_root', org_id: 'O1' }, { id: 'T1', org_id: 'O1' }],
      team_members: [
        { team_id: 'T1', user_id: 'U1', role: 'manager' },
        { team_id: 'T_root', user_id: 'U1', role: 'member' },
      ],
      team_closure: [
        { ancestor_id: 'T_root', descendant_id: 'T1', depth: 1 },
        { ancestor_id: 'T_root', descendant_id: 'T_root', depth: 0 },
        { ancestor_id: 'T1', descendant_id: 'T1', depth: 0 },
      ],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T1')).toBe('manager')
  })

  it('ancestor manager upgrades effective role', async () => {
    // Direct 'member' of T1, 'manager' of ancestor T_root. Effective = max
    // → 'manager'.
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T_root', org_id: 'O1' }, { id: 'T1', org_id: 'O1' }],
      team_members: [
        { team_id: 'T1', user_id: 'U1', role: 'member' },
        { team_id: 'T_root', user_id: 'U1', role: 'manager' },
      ],
      team_closure: [
        { ancestor_id: 'T_root', descendant_id: 'T1', depth: 1 },
        { ancestor_id: 'T_root', descendant_id: 'T_root', depth: 0 },
        { ancestor_id: 'T1', descendant_id: 'T1', depth: 0 },
      ],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T1')).toBe('manager')
  })

  it('Bug CP: max of direct, ancestor, org-candidate (no short-circuit)', async () => {
    // U1 is direct 'member' of T1, ancestor 'manager' of T_root, and
    // org 'admin'. Max → 'admin'.
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'admin' }],
      teams: [{ id: 'T_root', org_id: 'O1' }, { id: 'T1', org_id: 'O1' }],
      team_members: [
        { team_id: 'T1', user_id: 'U1', role: 'member' },
        { team_id: 'T_root', user_id: 'U1', role: 'manager' },
      ],
      team_closure: [
        { ancestor_id: 'T_root', descendant_id: 'T1', depth: 1 },
        { ancestor_id: 'T_root', descendant_id: 'T_root', depth: 0 },
        { ancestor_id: 'T1', descendant_id: 'T1', depth: 0 },
      ],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T1')).toBe('admin')
  })

  it('team does not exist returns null (no team row → safe)', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'admin' }],
      teams: [],
    })
    expect(await getEffectiveTeamRole(db, 'U1', 'T-missing')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// canManageTeamConfig / canManageTeamGoals
// ---------------------------------------------------------------------------

describe('authz: canManageTeamConfig (admin required)', () => {
  it('org admin can manage config of any team (Bug CP)', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'admin' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [],
    })
    expect(await canManageTeamConfig(db, 'U1', 'T1')).toBe(true)
  })
  it('direct team admin can manage config', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'admin' }],
    })
    expect(await canManageTeamConfig(db, 'U1', 'T1')).toBe(true)
  })
  it('direct team manager cannot manage config (manager < admin)', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'manager' }],
    })
    expect(await canManageTeamConfig(db, 'U1', 'T1')).toBe(false)
  })
  it('non-member cannot manage config', async () => {
    const db = makeMockDb({
      org_members: [],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [],
    })
    expect(await canManageTeamConfig(db, 'U1', 'T1')).toBe(false)
  })
})

describe('authz: canManageTeamGoals (manager required)', () => {
  it('org member (not in team) cannot manage team goals', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [],
    })
    expect(await canManageTeamGoals(db, 'U1', 'T1')).toBe(false)
  })
  it('direct team manager can manage goals', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'manager' }],
    })
    expect(await canManageTeamGoals(db, 'U1', 'T1')).toBe(true)
  })
  it('direct team member cannot manage goals (member < manager)', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'member' }],
    })
    expect(await canManageTeamGoals(db, 'U1', 'T1')).toBe(false)
  })
  it('org admin can manage goals of any team (Bug CP)', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'admin' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [],
    })
    expect(await canManageTeamGoals(db, 'U1', 'T1')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// canViewUser / getViewableUserIds
// ---------------------------------------------------------------------------

describe('authz: getViewableUserIds', () => {
  it('returns the set of viewable user IDs from the RPC', async () => {
    const db = makeMockDb({
      viewable_user_ids: { O1: { U1: ['U1', 'U2', 'U3'] } },
    })
    const set = await getViewableUserIds(db, 'U1', 'O1')
    expect(set.has('U1')).toBe(true)
    expect(set.has('U2')).toBe(true)
    expect(set.has('U3')).toBe(true)
    expect(set.size).toBe(3)
  })
  it('returns empty Set when RPC returns null/empty', async () => {
    const db = makeMockDb({})
    const set = await getViewableUserIds(db, 'U1', 'O-missing')
    expect(set.size).toBe(0)
  })
})

describe('authz: canViewUser', () => {
  it('always allows viewing yourself', async () => {
    const db = makeMockDb({})
    expect(await canViewUser(db, 'U1', 'U1', 'O1')).toBe(true)
  })
  it('allows viewing a user in viewable set', async () => {
    const db = makeMockDb({ viewable_user_ids: { O1: { U1: ['U1', 'U2'] } } })
    expect(await canViewUser(db, 'U1', 'U2', 'O1')).toBe(true)
  })
  it('denies viewing a user not in viewable set', async () => {
    const db = makeMockDb({ viewable_user_ids: { O1: { U1: ['U1'] } } })
    expect(await canViewUser(db, 'U1', 'U2', 'O1')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canEditGoal — Bug D / Bug AX / org-membership-first gate
// ---------------------------------------------------------------------------

describe('authz: canEditGoal (Bug D, Bug AX, membership-first gate)', () => {
  it('non-member (not in org_members) cannot edit ANY goal (membership gate)', async () => {
    // Even if user is the created_by of an individual goal, no org
    // membership → must be false. This pins the Bug IDOR fix.
    const db = makeMockDb({
      org_members: [],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'individual', created_by: 'U404', team_id: null, department_id: null },
      ],
      goal_assignees: [{ goal_id: 'G1', user_id: 'U404' }],
    })
    expect(await canEditGoal(db, 'U404', 'G1')).toBe(false)
  })

  it('goal does not exist → false', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'admin' }],
      goals: [],
    })
    expect(await canEditGoal(db, 'U1', 'G-missing')).toBe(false)
  })

  it('individual scope: creator can edit', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'individual', created_by: 'U1', team_id: null, department_id: null },
      ],
    })
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(true)
  })

  it('individual scope: assignee can edit (Bug AX)', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U2', role: 'member' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'individual', created_by: 'U1', team_id: null, department_id: null },
      ],
      goal_assignees: [{ goal_id: 'G1', user_id: 'U2' }],
    })
    expect(await canEditGoal(db, 'U2', 'G1')).toBe(true)
  })

  it('individual scope: non-creator non-assignee cannot edit', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U3', role: 'member' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'individual', created_by: 'U1', team_id: null, department_id: null },
      ],
      goal_assignees: [],
    })
    expect(await canEditGoal(db, 'U3', 'G1')).toBe(false)
  })

  it('team scope: org admin can edit (admin escape hatch)', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'admin' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'team', created_by: 'U2', team_id: 'T1', department_id: null },
      ],
    })
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(true)
  })

  it('team scope: team manager can edit', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'manager' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'team', created_by: 'U2', team_id: 'T1', department_id: null },
      ],
    })
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(true)
  })

  it('team scope: team member (not manager) cannot edit', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'member' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'team', created_by: 'U2', team_id: 'T1', department_id: null },
      ],
    })
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(false)
  })

  it('team scope: non-team-member org member cannot edit', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1' }],
      team_members: [{ team_id: 'T1', user_id: 'U2', role: 'manager' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'team', created_by: 'U2', team_id: 'T1', department_id: null },
      ],
    })
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(false)
  })

  it('org scope: only org admin/owner can edit (members denied)', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'organization', created_by: 'U1', team_id: null, department_id: null },
      ],
    })
    // Even the creator can't edit an org-scope goal if they're not admin.
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(false)
  })

  it('org scope: org admin can edit', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'admin' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'organization', created_by: 'U2', team_id: null, department_id: null },
      ],
    })
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(true)
  })

  it('department scope: manager of a team in the dept can edit', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T1', org_id: 'O1', department_id: 'D1' }],
      team_members: [{ team_id: 'T1', user_id: 'U1', role: 'manager' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'department', created_by: 'U2', team_id: null, department_id: 'D1' },
      ],
    })
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(true)
  })

  it('department scope: no team in the dept lets user manage → deny', async () => {
    const db = makeMockDb({
      org_members: [{ org_id: 'O1', user_id: 'U1', role: 'member' }],
      teams: [{ id: 'T_other', org_id: 'O1', department_id: 'D2' }], // different dept
      team_members: [{ team_id: 'T_other', user_id: 'U1', role: 'manager' }],
      goals: [
        { id: 'G1', org_id: 'O1', scope: 'department', created_by: 'U2', team_id: null, department_id: 'D1' },
      ],
    })
    expect(await canEditGoal(db, 'U1', 'G1')).toBe(false)
  })
})
