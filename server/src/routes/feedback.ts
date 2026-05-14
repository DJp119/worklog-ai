import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/database.js'

const router = Router()

/**
 * POST /api/feedback - Submit feedback
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, rating, message, page_context } = req.body

    // Validate required fields
    if (!category || !rating || !message) {
      res.status(400).json({ error: 'Category, rating, and message are required' })
      return
    }

    // Validate category
    const validCategories = ['bug', 'feature', 'improvement', 'general']
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: 'Invalid category. Must be one of: bug, feature, improvement, general' })
      return
    }

    // Validate rating
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be a number between 1 and 5' })
      return
    }

    // Validate message length
    if (message.length < 10) {
      res.status(400).json({ error: 'Message must be at least 10 characters long' })
      return
    }

    if (message.length > 2000) {
      res.status(400).json({ error: 'Message must be less than 2000 characters' })
      return
    }

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: req.userId,
        category,
        rating,
        message: message.trim(),
        page_context: page_context || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[Feedback] Insert error:', error)
      res.status(500).json({ error: 'Failed to submit feedback' })
      return
    }

    console.log(`[Feedback] New feedback from user ${req.userId}: ${category} (${rating}/5)`)

    res.status(201).json({
      success: true,
      data,
      message: 'Thank you for your feedback!',
    })
  } catch (error) {
    console.error('[Feedback] Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/feedback - Get user's own feedback history
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Feedback] Fetch error:', error)
      res.status(500).json({ error: 'Failed to fetch feedback' })
      return
    }

    res.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('[Feedback] Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export const feedbackRoutes = router
