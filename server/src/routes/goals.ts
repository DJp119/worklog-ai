/**
 * server/src/routes/goals.ts
 *
 * Goal CRUD, key results, assignees, check-ins, links, setParent.
 * Mounted at /api/goals. Org-scoped goal listing lives in organizations.ts.
 * Called from: server/src/index.ts
 */

import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { canEditGoal, canManageTeamGoals, getUserOrgRole, getViewableUserIds, orgRoleAtLeast } from '../services/authz.js'
import { isFeatureEnabled } from '../services/subscriptionService.js'
import * as goalSvc from '../services/goalService.js'
import { logger } from '../lib/logger.js'

export const goalRoutes = Router()

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

/** POST /api/goals — create goal (orgId in body) */
goalRoutes.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orgId, scope, title, period, startDate, dueDate, teamId, departmentId, parentGoalId, description, progressMode } = req.body

    if (!orgId || !title || !scope || !period || !startDate || !dueDate) {
      return res.status(400).json({ success: false, error: 'orgId, title, scope, period, startDate, dueDate required' })
    }

    // Verify org membership
    const orgRole = await getUserOrgRole(req.supabase!, req.userId!, orgId)
    if (!orgRole) return res.status(403).json({ success: false, error: 'Forbidden — not an org member' })

    // Tier gate: goals require Pro+
    const goalsEnabled = await isFeatureEnabled(req.supabase!, orgId, 'goals')
    if (!goalsEnabled) {
      return res.status(403).json({ success: false, error: 'Goals require a Pro plan or higher.', upgradeUrl: '/billing' })
    }

    // Team-scoped goals require manager+ on team
    if (scope === 'team' && teamId) {
      const canCreate = await canManageTeamGoals(req.supabase!, req.userId!, teamId)
      if (!canCreate) return res.status(403).json({ success: false, error: 'Forbidden — need manager+ on team' })
    }

    // Org-scoped goals require org admin+
    if (scope === 'organization') {
      if (!orgRoleAtLeast(orgRole, 'admin')) return res.status(403).json({ success: false, error: 'Forbidden — need org admin+' })
    }

    const data = await goalSvc.createGoal(req.supabase!, {
      orgId, scope, title, period, startDate, dueDate,
      createdBy: req.userId!, teamId, departmentId, parentGoalId, description,
      progressMode,
    })
    logger.with('goalId', data.id).info('Goal created')
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST goal failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/goals/:goalId — get goal with details (visibility check) */
goalRoutes.get('/:goalId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await goalSvc.getGoalWithDetails(req.supabase!, String(req.params.goalId))
    if (!data) return res.status(404).json({ success: false, error: 'Goal not found' })

    // Visibility check: org admin/owner can see all; otherwise the goal's
    // created_by user must be in the viewable set (their own goals +
    // their team/goals), and individual-scope is restricted to that user.
    const role = await getUserOrgRole(req.supabase!, req.userId!, data.org_id)
    if (!role) return res.status(403).json({ success: false, error: 'Forbidden' })
    if (!orgRoleAtLeast(role, 'admin')) {
      if (data.scope === 'individual') {
        if (data.created_by !== req.userId) {
          const viewable = await getViewableUserIds(req.supabase!, req.userId!, data.org_id)
          if (!viewable.has(data.created_by)) {
            return res.status(403).json({ success: false, error: 'Forbidden' })
          }
        }
      }
    }

    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET goal failed')
    if (err.code === 'PGRST116') return res.status(404).json({ success: false, error: 'Goal not found' })
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** PATCH /api/goals/:goalId — update goal (checks canEditGoal) */
goalRoutes.patch('/:goalId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    const data = await goalSvc.updateGoal(req.supabase!, String(req.params.goalId), req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('PATCH goal failed')
    if (err.message?.includes('manual')) return res.status(409).json({ success: false, error: err.message })
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** DELETE /api/goals/:goalId — delete goal (checks canEditGoal) */
goalRoutes.delete('/:goalId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    await goalSvc.deleteGoal(req.supabase!, String(req.params.goalId))
    res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('DELETE goal failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Key Results
// ---------------------------------------------------------------------------

/** POST /api/goals/:goalId/key-results — add key result (canEditGoal) */
goalRoutes.post('/:goalId/key-results', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    const { title, metricType, targetValue, startValue, unit, weight, sortOrder } = req.body
    if (!title || !metricType || targetValue === undefined) {
      return res.status(400).json({ success: false, error: 'title, metricType, targetValue required' })
    }

    const data = await goalSvc.addKeyResult(req.supabase!, String(req.params.goalId), {
      title, metricType, targetValue, startValue, unit, weight, sortOrder,
    })
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST key-result failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** PATCH /api/goals/:goalId/key-results/:krId — update key result */
goalRoutes.patch('/:goalId/key-results/:krId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    const data = await goalSvc.updateKeyResult(req.supabase!, String(req.params.krId), req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('PATCH key-result failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Assignees
// ---------------------------------------------------------------------------

/** POST /api/goals/:goalId/assignees — add assignee (canEditGoal) */
goalRoutes.post('/:goalId/assignees', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    const { userId } = req.body
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' })

    const { data: goal } = await req.supabase!.from('goals').select('org_id').eq('id', String(req.params.goalId)).maybeSingle()
    if (!goal) return res.status(404).json({ success: false, error: 'Goal not found' })

    // Validate target is an active org_member — prevents cross-tenant
    // assignment. DB-level composite FK also enforces this; explicit check
    // gives a clean 403 instead of a 500 from a constraint violation.
    const { data: orgMember } = await req.supabase!
      .from('org_members')
      .select('user_id')
      .eq('org_id', goal.org_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!orgMember) {
      return res.status(403).json({ success: false, error: 'Assignee is not a member of this org' })
    }

    const data = await goalSvc.addGoalAssignee(req.supabase!, String(req.params.goalId), userId, req.userId!, goal.org_id)
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST assignee failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** DELETE /api/goals/:goalId/assignees/:userId — remove assignee */
goalRoutes.delete('/:goalId/assignees/:userId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    await goalSvc.removeGoalAssignee(req.supabase!, String(req.params.goalId), String(req.params.userId))
    res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('DELETE assignee failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

/** POST /api/goals/:goalId/checkins — create check-in (canEditGoal) */
goalRoutes.post('/:goalId/checkins', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    const { progress, status, note } = req.body

    const { data: goal } = await req.supabase!.from('goals')
      .select('org_id, progress_mode, parent_goal_id')
      .eq('id', String(req.params.goalId))
      .maybeSingle()
    if (!goal) return res.status(404).json({ success: false, error: 'Goal not found' })

    // Progress can only be written when progress_mode='manual' (spec).
    if (progress !== undefined && progress !== null) {
      if (goal.progress_mode !== 'manual') {
        return res.status(409).json({
          success: false,
          error: `Manual progress updates only allowed when progress_mode='manual' (current: ${goal.progress_mode})`,
        })
      }
      // Block progress writes on goals with child goals — the children drive
      // the parent's progress via the recompute trigger.
      if (goal.parent_goal_id === null) {
        const { data: childCheck } = await req.supabase!
          .from('goals')
          .select('id')
          .eq('parent_goal_id', String(req.params.goalId))
          .limit(1)
          .maybeSingle()
        if (childCheck) {
          return res.status(409).json({
            success: false,
            error: 'Cannot set manual progress on a goal with child goals',
          })
        }
      }
    }

    const data = await goalSvc.createGoalUpdate(req.supabase!, {
      goalId: String(req.params.goalId),
      userId: req.userId!,
      orgId: goal.org_id,
      progress, status, note,
    })
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST checkin failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** POST /api/goals/:goalId/links — add link (canEditGoal) */
goalRoutes.post('/:goalId/links', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    const { url, label, weight } = req.body
    if (!url) return res.status(400).json({ success: false, error: 'url required' })

    const { data: goal } = await req.supabase!.from('goals').select('org_id').eq('id', String(req.params.goalId)).single()
    if (!goal) return res.status(404).json({ success: false, error: 'Goal not found' })

    // Issue DU: cross-site linking guard — if the goal is in an org that has a
    // JIRA site connection, the URL's domain must match.
    if (typeof url === 'string' && url.includes('.atlassian.net')) {
      const domainMatch = url.match(/https?:\/\/([\w.-]+\.atlassian\.net)/i)
      if (domainMatch) {
        const domain = domainMatch[1].toLowerCase()
        const { data: orgInt } = await req.supabase!
          .from('org_integrations')
          .select('config')
          .eq('org_id', goal.org_id)
          .eq('provider', 'jira')
          .eq('is_active', true)
          .maybeSingle()
        const cfg = (orgInt?.config ?? null) as { sites?: Array<{ domain?: string }> } | null
        const connectedDomains = (cfg?.sites ?? []).map((s) => (s.domain ?? '').toLowerCase())
        if (connectedDomains.length > 0 && !connectedDomains.includes(domain)) {
          return res.status(400).json({
            success: false,
            error: `This JIRA site is not connected. Add ${domain} in Integrations settings first.`,
          })
        }
      }
    }

    const data = await goalSvc.addLink(req.supabase!, String(req.params.goalId), {
      url, label, weight, userId: req.userId!, orgId: goal.org_id,
    })
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST link failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** DELETE /api/goals/:goalId/links/:linkId — remove link (canEditGoal) */
goalRoutes.delete('/:goalId/links/:linkId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    await goalSvc.removeLink(req.supabase!, String(req.params.linkId))
    res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('DELETE link failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// setParent
// ---------------------------------------------------------------------------

/** PUT /api/goals/:goalId/parent — reparent goal (canEditGoal) */
goalRoutes.put('/:goalId/parent', requireAuth, async (req: AuthRequest, res) => {
  try {
    const canEdit = await canEditGoal(req.supabase!, req.userId!, String(req.params.goalId))
    if (!canEdit) return res.status(403).json({ success: false, error: 'Forbidden' })

    const { parentGoalId } = req.body
    const { data: goal } = await req.supabase!.from('goals').select('org_id').eq('id', String(req.params.goalId)).maybeSingle()
    if (!goal) return res.status(404).json({ success: false, error: 'Goal not found' })

    // Acquire an org-row advisory lock so concurrent reparent attempts on
    // goals in the same org serialize. The service (`goalSvc.setParent`)
    // also acquires the same lock and is fail-closed — if the lock fails
    // there, it throws and we return 500. We acquire here defensively to
    // surface RPC errors (e.g. auth/SQL errors) with the request context
    // attached before entering the service layer.
    const { error: lockErr } = await req.supabase!
      .rpc('lock_organization_row' as any, { p_org_id: goal.org_id })
    if (lockErr) {
      // Don't proceed on lock failure — return 503 so the fail-closed
      // guarantee is preserved at the route layer. Previously this logged
      // a warn-and-continue message, which masked lock RPC errors as
      // silent success.
      logger.with('err', lockErr).with('orgId', goal.org_id).error('reparent: org lock failed')
      return res.status(503).json({ success: false, error: 'Could not acquire organization lock; please retry' })
    }

    const data = await goalSvc.setParent(req.supabase!, String(req.params.goalId), parentGoalId ?? null, goal.org_id)
    res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('PUT parent failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})
