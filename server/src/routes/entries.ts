import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import type { WorkLogEntry, CreateWorkLogRequest, ApiResponse } from 'shared'
import { invalidateMonthlySummary } from '../lib/summaryService.js'

export const entriesRoutes = Router()

/**
 * GET /api/entries
 * Get all work log entries for current user
 */
entriesRoutes.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!

    const { data, error } = await supabase
      .from('work_log_entries')
      .select('*')
      .eq('user_id', userId)
      .order('week_start_date', { ascending: false })

    if (error) {
      console.error('Fetch entries error:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch entries' })
    }

    res.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Entries error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/entries/:id
 * Get single work log entry
 */
entriesRoutes.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const supabase = req.supabase!

    const { data, error } = await supabase
      .from('work_log_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      return res.status(404).json({ success: false, error: 'Entry not found' })
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Fetch entry error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /api/entries
 * Create new work log entry
 */
entriesRoutes.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body: CreateWorkLogRequest = req.body
    const supabase = req.supabase!

    // Validate required fields
    const required = ['week_start_date', 'accomplishments']
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
        user_id: userId,
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
      console.error('Create entry error:', error)
      return res.status(500).json({ success: false, error: 'Failed to create entry' })
    }

    // Invalidate monthly summary since we added a new log
    if (data && data.week_start_date) {
      // Don't await to avoid slowing down the response
      invalidateMonthlySummary(userId, data.week_start_date).catch(err => {
        console.error('Failed to invalidate monthly summary on entry create:', err)
      })
    }

    res.status(201).json({ success: true, data })
  } catch (error) {
    console.error('Create entry error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * PUT /api/entries/:id
 * Update work log entry
 */
entriesRoutes.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const body = req.body
    const supabase = req.supabase!

    const { data, error } = await supabase
      .from('work_log_entries')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return res.status(404).json({ success: false, error: 'Entry not found' })
    }

    // Invalidate monthly summary since we modified a log
    if (data && data.week_start_date) {
      invalidateMonthlySummary(userId, data.week_start_date).catch(err => {
        console.error('Failed to invalidate monthly summary on entry update:', err)
      })
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Update entry error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * DELETE /api/entries/:id
 * Delete work log entry
 */
entriesRoutes.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const supabase = req.supabase!

    // We need to fetch the entry first to know which month to invalidate
    // or we can just invalidate based on the return from delete
    // Supabase JS delete doesn't return the deleted rows by default unless we select()
    const { data: deletedData, error } = await supabase
      .from('work_log_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return res.status(404).json({ success: false, error: 'Entry not found' })
    }

    // Invalidate monthly summary since we deleted a log
    if (deletedData && deletedData.week_start_date) {
      invalidateMonthlySummary(userId, deletedData.week_start_date).catch(err => {
        console.error('Failed to invalidate monthly summary on entry delete:', err)
      })
    }

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete entry error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
