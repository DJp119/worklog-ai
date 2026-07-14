/**
 * server/src/services/authz.ts
 *
 * Authorization core — all enforcement in Node via service-role Supabase client.
 * RLS is inert defense-in-depth (service role bypasses it). Every query scoped
 * by req.userId. Never compare role strings lexically — always use numeric rank maps.
 *
 * Role ranks:
 *   org:   member=1 < admin=2 < owner=3
 *   team:  member=1 < manager=2 < admin=3 < owner=4
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Response, NextFunction } from 'express'
import { AuthRequest } from '../middleware/auth.js'

export type OrgRole = 'member' | 'admin' | 'owner'
export type TeamRole = 'member' | 'manager' | 'admin' | 'owner'

// ---------------------------------------------------------------------------
// Rank maps
// ---------------------------------------------------------------------------

const ORG_RANK: Record<OrgRole, number> = { member: 1, admin: 2, owner: 3 }
const TEAM_RANK: Record<TeamRole, number> = { member: 1, manager: 2, admin: 3, owner: 4 }

export function orgRoleAtLeast(role: OrgRole | null, min: OrgRole): boolean {
  if (role === null) return false
  return ORG_RANK[role] >= ORG_RANK[min]
}

export function teamRoleAtLeast(role: TeamRole | null, min: TeamRole): boolean {
  if (role === null) return false
  return TEAM_RANK[role] >= TEAM_RANK[min]
}

// ---------------------------------------------------------------------------
// Core queries
// ---------------------------------------------------------------------------

/** Get the user's role within an org. Returns null if not a member.
 *  Uses .maybeSingle() so a non-member yields null instead of a PostgREST 406
 *  that would bubble up as a 500 in fail-closed middleware. */
export async function getUserOrgRole(
  db: SupabaseClient, userId: string, orgId: string
): Promise<OrgRole | null> {
  const { data } = await db
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  return (data?.role as OrgRole) ?? null
}

/**
 * Get the user's effective team role = max(direct, inherited, org-level).
 * Algorithm (Bug C / Bug CP fix — compares max of all roles, never short-circuits):
 *   1. Direct team membership role
 *   2. Org admin/owner → candidate role (mapped to team equivalent)
 *   3. Ancestor teams via team_closure for manager/admin/owner (Bug N: exclude 'member')
 *   4. Return numeric max of all found roles; null = not on this team
 */
export async function getEffectiveTeamRole(
  db: SupabaseClient, userId: string, teamId: string
): Promise<TeamRole | null> {
  // Direct team membership (.maybeSingle — non-membership is not an error)
  const { data: direct } = await db
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle()
  const directRole = (direct?.role as TeamRole) ?? null

  // Need org_id for org-level candidate role
  const { data: teamRow } = await db
    .from('teams')
    .select('org_id')
    .eq('id', teamId)
    .maybeSingle()
  if (!teamRow) return null

  // Org admin/owner is a CANDIDATE — not a short-circuit (Bug CP fix).
  // Map org roles to their team equivalent: org admin → team admin, org owner → team owner.
  const orgRole = await getUserOrgRole(db, userId, teamRow.org_id)
  let orgCandidate: TeamRole | null = null
  if (orgRole === 'admin') orgCandidate = 'admin'
  else if (orgRole === 'owner') orgCandidate = 'owner'

  // Ancestor teams: manager/admin/owner (Bug N fix — exclude 'member' role)
  const { data: ancestors } = await db
    .from('team_closure')
    .select('ancestor_id')
    .eq('descendant_id', teamId)
    .neq('ancestor_id', teamId)

  const ancestorIds = (ancestors ?? []).map(r => r.ancestor_id)
  let ancestorBest: TeamRole | null = null
  if (ancestorIds.length > 0) {
    const { data: ancMembers } = await db
      .from('team_members')
      .select('role')
      .eq('user_id', userId)
      .in('team_id', ancestorIds)
      .in('role', ['manager', 'admin', 'owner'])

    for (const m of ancMembers ?? []) {
      const r = m.role as TeamRole
      if (!ancestorBest || TEAM_RANK[r] > TEAM_RANK[ancestorBest]) ancestorBest = r
    }
  }

  // Compute max of all candidates (Bug CP fix — never short-circuit on org role)
  const candidates: TeamRole[] = [directRole, ancestorBest, orgCandidate].filter((r): r is TeamRole => r !== null)
  if (candidates.length === 0) return null
  return candidates.reduce((best, r) => TEAM_RANK[r] > TEAM_RANK[best] ? r : best, candidates[0])
}

/**
 * Build the set of user IDs visible to the given user within an org.
 * Calls the database RPC for a single round-trip.
 */
export async function getViewableUserIds(
  db: SupabaseClient, userId: string, orgId: string
): Promise<Set<string>> {
  const { data } = await db.rpc('viewable_user_ids', { p_user_id: userId, p_org_id: orgId })
  return new Set((data ?? []) as string[])
}

// ---------------------------------------------------------------------------
// Authorization predicates
// ---------------------------------------------------------------------------

/** Team config mutation (rename, membership, reparent) — role >= admin */
export async function canManageTeamConfig(
  db: SupabaseClient, userId: string, teamId: string
): Promise<boolean> {
  const role = await getEffectiveTeamRole(db, userId, teamId)
  return teamRoleAtLeast(role, 'admin')
}

/** Create/edit goals for a team — role >= manager */
export async function canManageTeamGoals(
  db: SupabaseClient, userId: string, teamId: string
): Promise<boolean> {
  const role = await getEffectiveTeamRole(db, userId, teamId)
  return teamRoleAtLeast(role, 'manager')
}

/** Whether user can view a specific other user within an org */
export async function canViewUser(
  db: SupabaseClient, requesterId: string, targetUserId: string, orgId: string
): Promise<boolean> {
  if (requesterId === targetUserId) return true
  const viewable = await getViewableUserIds(db, requesterId, orgId)
  return viewable.has(targetUserId)
}

/**
 * Whether user can edit a goal (Bug D / Bug AX fix — check goal_assignees).
 *   1. Org admin/owner → always true
 *   2. Goal created_by → true for individual-scope
 *   3. goal_assignees.user_id → true for progress check-ins
 *   4. Team scope → canManageTeamGoals
 *   5. Org scope → org admin/owner only
 */
export async function canEditGoal(
  db: SupabaseClient, userId: string, goalId: string
): Promise<boolean> {
  const { data: goal } = await db
    .from('goals')
    .select('created_by, scope, team_id, department_id, org_id')
    .eq('id', goalId)
    .maybeSingle()
  if (!goal) return false

  const orgId = goal.org_id

  // Org-membership gate first (spec: non-members always false). Prevents a
  // user who was once a member/assignee from retaining edit rights after
  // being removed from the org, and stops the created_by/assignee paths
  // from being reachable by non-members.
  const role = await getUserOrgRole(db, userId, orgId)
  if (!role) return false

  // Org-level escape hatch
  if (orgRoleAtLeast(role, 'admin')) return true

  // Individual scope: creator or assignee
  if (goal.scope === 'individual') {
    if (goal.created_by === userId) return true
    const { data: assignee } = await db
      .from('goal_assignees')
      .select('goal_id')
      .eq('goal_id', goalId)
      .eq('user_id', userId)
      .maybeSingle()
    return !!assignee
  }

  // Team scope
  if (goal.scope === 'team' && goal.team_id) {
    return canManageTeamGoals(db, userId, goal.team_id)
  }

  // Department scope
  if (goal.scope === 'department' && goal.department_id) {
    const { data: deptTeams } = await db
      .from('teams')
      .select('id')
      .eq('department_id', goal.department_id)
    for (const t of deptTeams ?? []) {
      if (await canManageTeamGoals(db, userId, t.id)) return true
    }
    return false
  }

  // Organization scope — only org admin/owner (already checked)
  return false
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

interface AuthReq extends AuthRequest {
  orgRole?: OrgRole
  teamRole?: TeamRole
}

/** Middleware: fails-closed org role check
 * SECURITY (Bug IDOR-#9/#10): only reads `req.params.orgId` and never
 * trusts `req.body.orgId` / `req.query.orgId`. A user who can supply
 * `?orgId=OrgTheyAdmin` while the URL is for a different org must NOT
 * be authorized against the body/query — the URL path is the only
 * trusted source of org identity.
 */
export function requireOrgRole(min: OrgRole) {
  return async (req: AuthReq, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId || !req.supabase) {
        res.status(401).json({ error: 'Unauthorized' }); return
      }
      const orgId = req.params.orgId
      if (!orgId || Array.isArray(orgId)) { res.status(400).json({ error: 'orgId required in URL path' }); return }

      const role = await getUserOrgRole(req.supabase, req.userId, orgId)
      if (!role || !orgRoleAtLeast(role, min)) {
        res.status(403).json({ error: 'Forbidden' }); return
      }
      req.orgRole = role
      next()
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

/** Middleware: fails-closed team role check
 * SECURITY (Bug IDOR-#9): only reads `req.params.teamId`. The body and
 * query are attacker-controlled and must NOT be used for authorization
 * decisions — see Bug IDOR-#9 from the security audit.
 */
export function requireTeamRole(min: TeamRole) {
  return async (req: AuthReq, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId || !req.supabase) {
        res.status(401).json({ error: 'Unauthorized' }); return
      }
      const teamId = req.params.teamId
      if (!teamId || Array.isArray(teamId)) { res.status(400).json({ error: 'teamId required in URL path' }); return }

      const role = await getEffectiveTeamRole(req.supabase, req.userId, teamId)
      if (!role || !teamRoleAtLeast(role, min)) {
        res.status(403).json({ error: 'Forbidden' }); return
      }
      req.teamRole = role
      next()
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
