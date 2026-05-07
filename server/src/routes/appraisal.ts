import { Router } from 'express'
import { mistral, chatModel } from '../lib/mistral.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import type { GeneratedAppraisal, GenerateAppraisalRequest, ApiResponse } from 'shared'

export const appraisalRoutes = Router()

/**
 * POST /api/appraisal/generate
 * Generate self-appraisal from work logs and criteria
 *
 * This is the core AI endpoint. It:
 *  1. Fetches all work entries for the chosen date range
 *  2. Formats them into a structured prompt
 *  3. Calls Mistral API with the user's company criteria
 *  4. Stores and returns the generated text
 */
appraisalRoutes.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body: GenerateAppraisalRequest = req.body
    const supabase = req.supabase!

    // Validate required fields
    if (!body.period_start || !body.period_end || !body.criteria_text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: period_start, period_end, criteria_text'
      })
    }

    // Fetch work logs for the period
    const { data: workLogs, error: fetchError } = await supabase
      .from('work_log_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('week_start_date', body.period_start)
      .lte('week_start_date', body.period_end)
      .order('week_start_date', { ascending: true })

    if (fetchError) {
      console.error('Fetch work logs error:', fetchError)
      return res.status(500).json({ success: false, error: 'Failed to fetch work logs' })
    }

    if (!workLogs || workLogs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No work logs found for the specified period'
      })
    }

    // Build the prompt for Mistral
    const workLogsText = workLogs.map((log, i) => `
Week ${i + 1} (${log.week_start_date}):
- Accomplishments: ${log.accomplishments}
- Challenges: ${log.challenges}
- Learnings: ${log.learnings}
- Goals for next week: ${log.goals_next_week}
${log.hours_logged ? `- Hours logged: ${log.hours_logged}` : ''}
`).join('\n\n')

    const prompt = `You are helping someone write their self-appraisal. Write a professional, polished self-appraisal based on their work logs and the company's appraisal criteria.

COMPANY APPRAISAL CRITERIA:
${body.criteria_text}
${body.company_goals ? `\nCOMPANY GOALS:\n${body.company_goals}` : ''}
${body.values ? `\nCOMPANY VALUES:\n${body.values}` : ''}

WORK LOGS (chronological order):
${workLogsText}

INSTRUCTIONS:
- Write in first person ("I")
- Be specific and cite concrete examples from the work logs
- Map accomplishments directly to the appraisal criteria
- Use professional but authentic language
- Include quantifiable impact where possible
- Address challenges honestly but frame them as learning opportunities
- Keep it concise but comprehensive (aim for 500-800 words)
- Structure with clear paragraphs for each major criterion

Write the self-appraisal:`

    // Call Mistral API
    let result
    try {
      result = await mistral.chat.completions.create({
        model: chatModel,
        messages: [
          {
            role: 'user' as const,
            content: prompt
          }
        ],
        max_tokens: 2048,
      })
    } catch (apiError: unknown) {
      // Handle specific Mistral API errors
      if (apiError instanceof Error && 'status' in apiError) {
        const status = (apiError as { status?: number }).status
        if (status === 429) {
          console.error('Mistral API quota exceeded')
          return res.status(503).json({
            success: false,
            error: 'AI service temporarily unavailable due to quota limits. Please try again tomorrow.'
          })
        }
        if (status === 400 || status === 401 || status === 403) {
          console.error('Mistral API configuration error:', apiError)
          return res.status(400).json({
            success: false,
            error: 'Invalid API configuration. Please contact support.'
          })
        }
      }
      throw apiError
    }

    const generatedText = result.choices?.[0]?.message?.content || ''

    if (!generatedText) {
      console.error('No content generated from Mistral API')
      return res.status(500).json({
        success: false,
        error: 'Failed to generate appraisal content'
      })
    }

    // Save to database
    const { data: appraisal, error: saveError } = await supabase
      .from('generated_appraisals')
      .insert({
        user_id: userId,
        period_start: body.period_start,
        period_end: body.period_end,
        generated_text: generatedText,
        word_count: generatedText.split(/\s+/).length,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Save appraisal error:', saveError)
    }

    res.json({
      success: true,
      data: {
        id: appraisal?.id || '',
        user_id: userId,
        period_start: body.period_start,
        period_end: body.period_end,
        generated_text: generatedText,
        word_count: generatedText.split(/\s+/).length,
        created_at: new Date().toISOString(),
      }
    })
  } catch (error) {
    console.error('Generate appraisal error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/appraisal/history
 * Get generated appraisal history
 */
appraisalRoutes.get('/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!

    const { data, error } = await supabase
      .from('generated_appraisals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch appraisal history error:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch appraisal history' })
    }

    res.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Appraisal history error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/appraisal/:id
 * Get single generated appraisal
 */
appraisalRoutes.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const supabase = req.supabase!

    const { data, error } = await supabase
      .from('generated_appraisals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      return res.status(404).json({ success: false, error: 'Appraisal not found' })
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Fetch appraisal error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
