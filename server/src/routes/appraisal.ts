import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { mistral, chatModel } from '../lib/mistral.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import type { GeneratedAppraisal, GenerateAppraisalRequest, ApiResponse } from 'shared'
import { captureEvent, captureException } from '../lib/posthog.js'
import { logger } from '../lib/logger.js'
import { resolveUserLanguage, languageInstruction } from '../lib/userLanguage.js'
import { callOpenRouter } from '../lib/openRouter.js'

export const appraisalRoutes = Router()

// Strict rate limiting for public playground endpoint to prevent abuse
const playgroundLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 generations per hour
  message: {
    success: false,
    error: 'Playground generation limit exceeded. Please sign up or log in for unlimited use.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * POST /api/appraisal/playground-generate
 * Generate playground self-appraisal draft (public rate-limited endpoint)
 */
appraisalRoutes.post('/playground-generate', playgroundLimiter, async (req, res) => {
  try {
    const { userInput, role, tone } = req.body

    if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
      return res.status(400).json({ success: false, error: 'User input is required' })
    }

    if (userInput.length > 1000) {
      return res.status(400).json({ success: false, error: 'User input is too long (maximum 1000 characters)' })
    }

    const systemPrompt = `You are a professional performance appraisal generator.
Analyze the user's raw achievement, role, and desired writing tone, and generate a professional self-appraisal draft.

You MUST respond ONLY with a valid JSON object in this exact format:
{
  "accomplishment": "A concise, high-impact one-sentence accomplishment summary",
  "appraisal": "A detailed, professional self-appraisal paragraph or two using first-person ('I') and matching the selected tone"
}

Do NOT include any markdown code block formatting (no \`\`\`json, no \`\`\`), no extra text, explanations, or notes. Just raw JSON.`

    const prompt = `
Raw achievement: "${userInput}"
Role: "${role || 'general'}"
Tone: "${tone || 'data'}"
`

    logger.info('Starting OpenRouter API call for playground appraisal generation')

    const rawResponse = await callOpenRouter({
      prompt,
      systemPrompt
    })

    if (!rawResponse) {
      logger.error('Empty response received from OpenRouter')
      return res.status(500).json({ success: false, error: 'Failed to generate playground appraisal' })
    }

    // Clean JSON content if wrapped in markdown
    const cleanText = rawResponse.replace(/```json\s?/g, '').replace(/```/g, '').trim()
    
    let parsedData
    try {
      parsedData = JSON.parse(cleanText)
    } catch (parseError) {
      logger.error('Failed to parse JSON response from OpenRouter: {}', cleanText, parseError)
      return res.status(500).json({ success: false, error: 'Failed to parse generated response format' })
    }

    if (!parsedData.accomplishment || !parsedData.appraisal) {
      logger.error('Parsed OpenRouter response is missing required fields: {}', cleanText)
      return res.status(500).json({ success: false, error: 'Incomplete generated content' })
    }

    res.json({
      success: true,
      data: {
        accomplishment: parsedData.accomplishment,
        appraisal: parsedData.appraisal
      }
    })

  } catch (error) {
    logger.error('Playground generation error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})


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
      logger.warn('Appraisal generation failed: Missing required fields')
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
      logger.error('Fetch work logs error: {}', fetchError.message, fetchError)
      return res.status(500).json({ success: false, error: 'Failed to fetch work logs' })
    }

    if (!workLogs || workLogs.length === 0) {
      logger.warn('Appraisal generation failed: No work logs found for period {} to {}', body.period_start, body.period_end)
      return res.status(400).json({
        success: false,
        error: 'No work logs found for the specified period'
      })
    }

    // Resolve the user's preferred language for AI output
    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('preferred_language')
      .eq('id', userId)
      .single()
    const lang = await resolveUserLanguage(req, profileRow?.preferred_language)
    const langInstruction = languageInstruction(lang)

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
${langInstruction}
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

    logger.info('Starting Mistral API call for appraisal generation')

    // Call Mistral API
    let result
    try {
      result = await mistral.chat.complete({
        model: chatModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 2048,
      })
    } catch (apiError: unknown) {
      // Handle specific Mistral API errors
      if (apiError instanceof Error && 'status' in apiError) {
        const status = (apiError as { status?: number }).status
        if (status === 429) {
          logger.error('Mistral API quota exceeded')
          return res.status(503).json({
            success: false,
            error: 'AI service temporarily unavailable due to quota limits. Please try again tomorrow.'
          })
        }
        if (status === 400 || status === 401 || status === 403) {
          logger.error('Mistral API configuration error: {}', apiError.message, apiError)
          return res.status(400).json({
            success: false,
            error: 'Invalid API configuration. Please contact support.'
          })
        }
      }
      throw apiError
    }

    const content = result.choices?.[0]?.message?.content
    const generatedText = (typeof content === 'string' ? content : '') || ''

    if (!generatedText) {
      logger.error('No content generated from Mistral API')
      return res.status(500).json({
        success: false,
        error: 'Failed to generate appraisal content'
      })
    }

    logger.info('Successfully generated appraisal content from Mistral API')

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
      logger.error('Save appraisal error: {}', saveError.message, saveError)
    }

    const wordCount = generatedText.split(/\s+/).length
    captureEvent(userId, 'appraisal_generated', {
      appraisal_id: appraisal?.id,
      period_start: body.period_start,
      period_end: body.period_end,
      work_log_count: workLogs.length,
      word_count: wordCount,
      has_company_goals: !!body.company_goals,
      has_values: !!body.values,
      output_language: lang,
    })

    logger.with('appraisalId', appraisal?.id).info('Successfully saved generated appraisal')

    res.json({
      success: true,
      data: {
        id: appraisal?.id || '',
        user_id: userId,
        period_start: body.period_start,
        period_end: body.period_end,
        generated_text: generatedText,
        word_count: wordCount,
        created_at: new Date().toISOString(),
      }
    })
  } catch (error) {
    logger.error('Generate appraisal error: {}', error instanceof Error ? error.message : String(error), error)
    captureException(error)
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
      logger.error('Fetch appraisal history error: {}', error.message, error)
      return res.status(500).json({ success: false, error: 'Failed to fetch appraisal history' })
    }

    logger.with('count', data?.length || 0).info('Successfully fetched appraisal history')

    res.json({ success: true, data: data || [] })
  } catch (error) {
    logger.error('Appraisal history error: {}', error instanceof Error ? error.message : String(error), error)
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
      logger.with('appraisalId', id).warn('Appraisal not found or unauthorized')
      return res.status(404).json({ success: false, error: 'Appraisal not found' })
    }

    logger.with('appraisalId', id).info('Successfully fetched appraisal')

    res.json({ success: true, data })
  } catch (error) {
    logger.error('Fetch appraisal error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
