/**
 * server/src/routes/reports.ts
 *
 * AI Performance Report endpoints. Enterprise-tier only (enforced by
 * requireTier middleware). Mounted at /api/reports.
 *
 *   POST /api/reports/:orgId/generate — generate a new report
 *   GET  /api/reports/:orgId           — list reports for the org
 *   GET  /api/reports/:orgId/:reportId — get a single report
 */

import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireTier } from '../middleware/tierGate.js'
import { generatePerformanceReport } from '../services/reportGenerationService.js'
import { logger } from '../lib/logger.js'

export const reportRoutes = Router()

/**
 * POST /api/reports/:orgId/generate — trigger a new AI performance report.
 * Enterprise tier only.
 */
reportRoutes.post('/:orgId/generate', requireAuth, requireTier('enterprise'), async (req: AuthRequest, res) => {
  try {
    const { reportType, targetUserId, targetTeamId, periodStart, periodEnd } = req.body

    if (!reportType || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: 'reportType, periodStart, and periodEnd are required',
      })
    }

    const validTypes = ['self', 'individual', 'team', 'organization']
    if (!validTypes.includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: `reportType must be one of: ${validTypes.join(', ')}`,
      })
    }

    const report = await generatePerformanceReport(req.supabase!, {
      orgId: String(req.params.orgId),
      reportType,
      targetUserId,
      targetTeamId,
      periodStart,
      periodEnd,
    }, req.userId!)

    logger.with('reportId', report.id).info('Performance report generated')
    res.status(201).json({ success: true, data: report })
  } catch (err: any) {
    logger.with('err', err).error('POST report generate failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/**
 * GET /api/reports/:orgId — list performance reports for the org.
 * Enterprise tier only.
 */
reportRoutes.get('/:orgId', requireAuth, requireTier('enterprise'), async (req: AuthRequest, res) => {
  try {
    const { data, error } = await req.supabase!
      .from('performance_reports')
      .select('*')
      .eq('org_id', req.params.orgId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET reports failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/**
 * GET /api/reports/:orgId/:reportId — get a single report.
 * Enterprise tier only.
 */
reportRoutes.get('/:orgId/:reportId', requireAuth, requireTier('enterprise'), async (req: AuthRequest, res) => {
  try {
    const { data, error } = await req.supabase!
      .from('performance_reports')
      .select('*')
      .eq('id', String(req.params.reportId))
      .eq('org_id', String(req.params.orgId))
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ success: false, error: 'Report not found' })
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET report failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})
