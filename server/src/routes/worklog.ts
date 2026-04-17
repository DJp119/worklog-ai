import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import type { WorkLogEntry, CreateWorkLogRequest, ApiResponse } from 'shared'

export const workLogRoutes = Router()

// Middleware to verify auth (simplified - in production, verify JWT)
const requireAuth = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  req.user = user
  next()
}

/**
 * GET /api/worklog
 * Get all work logs for current user
 */
workLogRoutes.get('/', requireAuth, async (req: Request, res: Response<ApiResponse<WorkLogEntry[]>>) => {
  try {
    const user = req.user as { id: string }

    const { data, error } = await supabase
      .from('work_log_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: false })

    if (error) {
      console.error('Fetch work logs error:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch work logs' })
    }

    res.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Work logs error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/worklog/:id
 * Get single work log entry
 */
workLogRoutes.get('/:id', requireAuth, async (req: Request, res: Response<ApiResponse<WorkLogEntry>>) => {
  try {
    const user = req.user as { id: string }
    const { id } = req.params

    const { data, error } = await supabase
      .from('work_log_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return res.status(404).json({ success: false, error: 'Work log not found' })
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Fetch work log error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /api/worklog
 * Create new work log entry
 */
workLogRoutes.post('/', requireAuth, async (req: Request, res: Response<ApiResponse<WorkLogEntry>>) => {
  try {
    const user = req.user as { id: string }
    const body: CreateWorkLogRequest = req.body

    // Validate required fields
    const required = ['week_start_date', 'accomplishments', 'challenges', 'learnings', 'goals_next_week']
    const missing = required.filter(field => !body[field as keyof CreateWorkLogRequest])

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      })
    }

    const { data, error } = await supabase
      .from('work_log_entries')
      .insert({
        user_id: user.id,
        week_start_date: body.week_start_date,
        accomplishments: body.accomplishments,
        challenges: body.challenges,
        learnings: body.learnings,
        goals_next_week: body.goals_next_week,
        hours_logged: body.hours_logged,
      })
      .select()
      .single()

    if (error) {
      console.error('Create work log error:', error)
      return res.status(500).json({ success: false, error: 'Failed to create work log' })
    }

    res.status(201).json({ success: true, data })
  } catch (error) {
    console.error('Create work log error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * PUT /api/worklog/:id
 * Update work log entry
 */
workLogRoutes.put('/:id', requireAuth, async (req: Request, res: Response<ApiResponse<WorkLogEntry>>) => {
  try {
    const user = req.user as { id: string }
    const { id } = req.params
    const body = req.body

    const { data, error } = await supabase
      .from('work_log_entries')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return res.status(404).json({ success: false, error: 'Work log not found' })
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Update work log error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * DELETE /api/worklog/:id
 * Delete work log entry
 */
workLogRoutes.delete('/:id', requireAuth, async (req: Request, res: Response<ApiResponse<null>>) => {
  try {
    const user = req.user as { id: string }
    const { id } = req.params

    const { error } = await supabase
      .from('work_log_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return res.status(404).json({ success: false, error: 'Work log not found' })
    }

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete work log error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
