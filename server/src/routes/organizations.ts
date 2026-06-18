/**
 * server/src/routes/organizations.ts
 *
 * Organization + department + team-creation + org-scoped goal listing.
 * Mounted at /api/orgs.
 * Called from: server/src/index.ts
 */

import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireOrgRole } from '../services/authz.js'
import * as teamSvc from '../services/teamService.js'
import * as goalSvc from '../services/goalService.js'
import { getViewableUserIds } from '../services/authz.js'
import { logger } from '../lib/logger.js'

export const organizationRoutes = Router()

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

/** POST /api/orgs — create org + owner member + root team atomically via RPC */
organizationRoutes.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, slug } = req.body
    if (!name || !slug) return res.status(400).json({ success: false, error: 'name and slug required' })
    // Slug format: URL-safe, lowercase, dashes. Reject anything else before
    // hitting the DB to avoid a 500 from a CHECK constraint violation.
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
      return res.status(400).json({ success: false, error: 'slug must be lowercase URL-safe (a-z, 0-9, hyphens)' })
    }

    // Atomic: the provision_organization RPC inserts org + owner org_member
    // + root team + owner team_member in a single transaction. Avoids the
    // partial-state failure mode of calling multiple service functions
    // (Bug CO Phase 1 / spec line 81).
    const { data, error } = await req.supabase!
      .rpc('provision_organization' as any, {
        p_name: String(name),
        p_slug: String(slug),
        p_owner_id: req.userId!,
      })
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'slug already taken' })
      }
      throw error
    }
    const orgId = typeof data === 'string' ? data : (data as any)?.id ?? (data as any)?.[0]?.id
    logger.with('orgId', orgId).info('Org created via RPC')
    res.status(201).json({ success: true, data: { id: orgId } })
  } catch (err: any) {
    logger.with('err', err).error('POST /orgs failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/orgs — list orgs current user belongs to */
organizationRoutes.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await teamSvc.listMyOrgs(req.supabase!, req.userId!)
    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET /orgs failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/orgs/:orgId/members */
organizationRoutes.get('/:orgId/members', requireAuth, requireOrgRole('member'), async (req: AuthRequest, res) => {
  try {
    const data = await teamSvc.getOrgMembers(req.supabase!, String(req.params.orgId))
    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET /orgs/:orgId/members failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

/** POST /api/orgs/:orgId/departments */
organizationRoutes.post('/:orgId/departments', requireAuth, requireOrgRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name required' })
    const data = await teamSvc.createDepartment(req.supabase!, String(req.params.orgId), name)
    logger.with('deptId', data.id).info('Department created')
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST /orgs/:orgId/departments failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Team creation (nested under org)
// ---------------------------------------------------------------------------

/** POST /api/orgs/:orgId/teams — create team (org admin+) */
organizationRoutes.post('/:orgId/teams', requireAuth, requireOrgRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name, parentTeamId, departmentId } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name required' })
    const data = await teamSvc.createTeam(req.supabase!, String(req.params.orgId), name, {
      parentTeamId, departmentId,
    })
    logger.with('teamId', data.id).info('Team created')
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST /orgs/:orgId/teams failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Closure rebuild (ops endpoint)
// ---------------------------------------------------------------------------

/** POST /api/orgs/:orgId/rebuild-closure — owner-only repair op */
organizationRoutes.post('/:orgId/rebuild-closure', requireAuth, requireOrgRole('owner'), async (req: AuthRequest, res) => {
  try {
    await teamSvc.rebuildClosure(req.supabase!, String(req.params.orgId))
    res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('Rebuild closure failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Org-scoped goal listing
// ---------------------------------------------------------------------------

/** GET /api/orgs/:orgId/goals */
organizationRoutes.get('/:orgId/goals', requireAuth, requireOrgRole('member'), async (req: AuthRequest, res) => {
  try {
    const orgId = String(req.params.orgId)
    const viewableUserIds = await getViewableUserIds(req.supabase!, req.userId!, orgId)
    const data = await goalSvc.listVisibleGoals(req.supabase!, orgId, viewableUserIds, {
      teamId: req.query.teamId as string | undefined,
      scope: req.query.scope as string | undefined,
      status: req.query.status as string | undefined,
    })
    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET /orgs/:orgId/goals failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})
