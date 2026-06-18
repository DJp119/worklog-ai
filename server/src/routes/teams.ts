/**
 * server/src/routes/teams.ts
 *
 * Team mutations (reparent, delete) + membership CRUD.
 * Mounted at /api/teams. Team creation lives in organizations.ts at POST /api/orgs/:orgId/teams.
 * Called from: server/src/index.ts
 */

import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireTeamRole } from '../services/authz.js'
import * as teamSvc from '../services/teamService.js'
import { logger } from '../lib/logger.js'

export const teamRoutes = Router()

// ---------------------------------------------------------------------------
// Team mutations
// ---------------------------------------------------------------------------

/** PUT /api/teams/:teamId/reparent — move team under a new parent (team admin+) */
teamRoutes.put('/:teamId/reparent', requireAuth, requireTeamRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { newParentId } = req.body

    // Acquire an org-row advisory lock so concurrent reparent attempts on
    // teams within the same org serialize. The DB cycle-guard trigger also
    // fires, but the lock prevents two clients from each passing the check
    // with a stale tree view.
    const { data: team } = await req.supabase!
      .from('teams')
      .select('org_id')
      .eq('id', String(req.params.teamId))
      .maybeSingle()
    if (!team) return res.status(404).json({ success: false, error: 'Team not found' })

    if (newParentId) {
      // Validate new parent is in the same org (tenant isolation).
      const { data: newParent } = await req.supabase!
        .from('teams')
        .select('org_id')
        .eq('id', newParentId)
        .maybeSingle()
      if (!newParent) return res.status(404).json({ success: false, error: 'New parent team not found' })
      if (newParent.org_id !== team.org_id) {
        return res.status(400).json({ success: false, error: 'New parent is in a different org' })
      }
    }

    const { error: lockErr } = await req.supabase!
      .rpc('lock_organization_row' as any, { p_org_id: team.org_id })
    if (lockErr) {
      logger.with('err', lockErr).with('orgId', team.org_id).warn('team reparent: org lock failed, proceeding best-effort')
    }

    const data = await teamSvc.moveTeam(req.supabase!, String(req.params.teamId), newParentId ?? null)
    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('PUT reparent failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** DELETE /api/teams/:teamId — delete team (team admin+, children must be reparented) */
teamRoutes.delete('/:teamId', requireAuth, requireTeamRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { reparentChildrenTo } = req.body as { reparentChildrenTo?: string }
    await teamSvc.deleteTeam(req.supabase!, String(req.params.teamId), reparentChildrenTo)
    res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('DELETE team failed')
    if (err.message?.includes('child teams')) return res.status(409).json({ success: false, error: err.message })
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Team membership
// ---------------------------------------------------------------------------

/** GET /api/teams/:teamId/my-role — return the current user's team role (null if not a member) */
teamRoutes.get('/:teamId/my-role', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { getEffectiveTeamRole } = await import('../services/authz.js')
    const role = await getEffectiveTeamRole(req.supabase!, req.userId!, String(req.params.teamId))
    return res.json({ success: true, data: { role } })
  } catch (err: any) {
    logger.with('err', err).error('GET my-role failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** POST /api/teams/:teamId/members — add member (team admin+) */
teamRoutes.post('/:teamId/members', requireAuth, requireTeamRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { userId, role } = req.body
    if (!userId || !role) return res.status(400).json({ success: false, error: 'userId and role required' })

    const { data: team } = await req.supabase!.from('teams').select('org_id').eq('id', String(req.params.teamId)).maybeSingle()
    if (!team) return res.status(404).json({ success: false, error: 'Team not found' })

    // Validate target user is an active org_member (tenant isolation).
    // DB composite FK also enforces, but a clean 403 is friendlier than 500.
    const { data: orgMember } = await req.supabase!
      .from('org_members')
      .select('user_id')
      .eq('org_id', team.org_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!orgMember) {
      return res.status(403).json({ success: false, error: 'User is not a member of this org' })
    }

    const data = await teamSvc.addMember(req.supabase!, String(req.params.teamId), userId, role, team.org_id)
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST member failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** PUT /api/teams/:teamId/members/:userId — update role (team admin+) */
teamRoutes.put('/:teamId/members/:userId', requireAuth, requireTeamRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { role } = req.body
    if (!role) return res.status(400).json({ success: false, error: 'role required' })

    // Role-rank guard: only owners can grant 'owner' role.
    // (requireTeamRole('admin') middleware already proved the requester
    // has at least admin via req.teamRole on the local AuthReq type.)
    if (role === 'owner' && (req as any).teamRole !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owners can grant owner' })
    }

    const data = await teamSvc.updateMemberRole(req.supabase!, String(req.params.teamId), String(req.params.userId), role)
    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('PUT member role failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** DELETE /api/teams/:teamId/members/:userId — remove member (team admin+) */
teamRoutes.delete('/:teamId/members/:userId', requireAuth, requireTeamRole('admin'), async (req: AuthRequest, res) => {
  try {
    // Last-owner guard: refuse to remove the final 'owner' of a team.
    const targetUserId = String(req.params.userId)
    const teamId = String(req.params.teamId)
    const { data: team } = await req.supabase!.from('teams').select('org_id').eq('id', teamId).maybeSingle()
    if (!team) return res.status(404).json({ success: false, error: 'Team not found' })

    const { data: targetMember } = await req.supabase!
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', targetUserId)
      .maybeSingle()
    if (!targetMember) {
      return res.status(404).json({ success: false, error: 'User is not on this team' })
    }
    if (targetMember.role === 'owner') {
      const { count } = await req.supabase!
        .from('team_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('role', 'owner')
      if ((count ?? 0) <= 1) {
        return res.status(409).json({ success: false, error: 'Cannot remove the last owner' })
      }
    }
    // Self-removal guard for owner: an owner cannot remove themselves if
    // they are the last owner (covered above), but also cannot self-demote
    // via this endpoint because it would leave the team without them.
    if (targetUserId === req.userId && targetMember.role === 'owner') {
      return res.status(403).json({ success: false, error: 'Owners cannot remove themselves; transfer ownership first' })
    }

    await teamSvc.removeMember(req.supabase!, teamId, targetUserId)
    res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('DELETE member failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})
