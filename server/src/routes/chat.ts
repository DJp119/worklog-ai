import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { mistral, chatModel } from '../lib/mistral.js'
import {
  getSummariesForRange,
  stitchSummaries,
  buildSystemPrompt,
  applySlidingWindow
} from '../lib/chatService.js'
import { resolveUserLanguage } from '../lib/userLanguage.js'
import { logger } from '../lib/logger.js'

export const chatRoutes = Router()

/**
 * GET /api/chat/sessions
 * List user's chat sessions
 */
chatRoutes.get('/sessions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      logger.error('Fetch chat sessions error: {}', error.message, error)
      return res.status(500).json({ success: false, error: 'Failed to fetch chat sessions' })
    }

    logger.with('count', data?.length || 0).info('Successfully fetched chat sessions')

    res.json({ success: true, data: data || [] })
  } catch (error) {
    logger.error('Chat sessions error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /api/chat/sessions
 * Create new chat session
 */
chatRoutes.post('/sessions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!
    const { period_start, period_end } = req.body

    if (!period_start || !period_end) {
      logger.warn('Create chat session validation failed: period_start and period_end are required')
      return res.status(400).json({ success: false, error: 'period_start and period_end are required' })
    }

    const title = `Chat: ${period_start} to ${period_end}`

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        title,
        period_start,
        period_end
      })
      .select()
      .single()

    if (error) {
      logger.error('Create chat session error: {}', error.message, error)
      return res.status(500).json({ success: false, error: 'Failed to create chat session' })
    }

    logger.with('sessionId', data?.id).info('Successfully created chat session')

    res.status(201).json({ success: true, data })
  } catch (error) {
    logger.error('Create chat session error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * DELETE /api/chat/sessions/:id
 * Delete a chat session
 */
chatRoutes.delete('/sessions/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!
    const { id } = req.params

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      logger.error('Delete chat session error: {}', error.message, error)
      return res.status(500).json({ success: false, error: 'Failed to delete chat session' })
    }

    logger.with('sessionId', id).info('Successfully deleted chat session')

    res.json({ success: true, data: null })
  } catch (error) {
    logger.error('Delete chat session error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/chat/sessions/:id/messages
 * Get message history for a session
 */
chatRoutes.get('/sessions/:id/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!.trim()
    const supabase = req.supabase!
    const id = String(req.params.id).trim()

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (sessionError) {
      logger.error('Session verify error: {}', sessionError.message, sessionError)
    }

    if (!session) {
      logger.with('sessionId', id).warn('Chat messages fetch failed: Session not found')
      return res.status(404).json({ success: false, error: 'Session not found', details: sessionError })
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('Fetch chat messages error: {}', error.message, error)
      return res.status(500).json({ success: false, error: 'Failed to fetch messages' })
    }

    logger.with('count', data?.length || 0).with('sessionId', id).info('Successfully fetched chat messages')

    res.json({ success: true, data: data || [] })
  } catch (error) {
    logger.error('Chat messages error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /api/chat/sessions/:id/messages
 * Send message and get SSE stream response
 */
chatRoutes.post('/sessions/:id/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!.trim()
    const supabase = req.supabase!
    const id = String(req.params.id).trim()
    const { content } = req.body

    if (!content || typeof content !== 'string') {
      logger.warn('Chat stream validation failed: Message content is required')
      return res.status(400).json({ success: false, error: 'Message content is required' })
    }

    // 1. Get session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (sessionError) {
      logger.error('Session verify error in POST: {}', sessionError.message, sessionError)
    }

    if (sessionError || !session) {
      logger.with('sessionId', id).warn('Chat stream failed: Session not found')
      return res.status(404).json({ success: false, error: 'Session not found', details: sessionError })
    }

    // 2. Save user message
    await supabase.from('chat_messages').insert({
      session_id: id,
      user_id: userId,
      role: 'user',
      content
    })

    // Update session updated_at
    await supabase.from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)

    // 3. Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // 4. Get monthly summaries
    const summaries = await getSummariesForRange(userId, session.period_start, session.period_end)
    const stitchedSummaries = stitchSummaries(summaries)
    const requestLang = await resolveUserLanguage(req, profile?.preferred_language)
    const systemPrompt = buildSystemPrompt(stitchedSummaries, profile || {}, requestLang)

    // 5. Get message history
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', id)
      .order('created_at', { ascending: true })

    const fullHistory = applySlidingWindow(history || [])

    // 6. Setup SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const abortController = new AbortController()
    req.on('close', () => {
      abortController.abort()
    })

    // 7. Call Mistral
    let assistantMessage = ''
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...fullHistory
      ]

      logger.info('Starting chat stream')

      const stream = await mistral.chat.stream({
        model: chatModel,
        messages: messages as any
      })

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          break
        }
        const text = chunk.data.choices[0]?.delta?.content
        if (text) {
          assistantMessage += text
          res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    } catch (aiError: any) {
      if (aiError.name === 'AbortError' || abortController.signal.aborted) {
        logger.info('Stream aborted by client')
      } else {
        logger.error('Mistral API error: {}', aiError instanceof Error ? aiError.message : String(aiError), aiError)
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI generation failed' })}\n\n`)
      }
    }

    // 8. Save assistant message if not empty
    if (assistantMessage) {
      await supabase.from('chat_messages').insert({
        session_id: id,
        user_id: userId,
        role: 'assistant',
        content: assistantMessage
      })
    }

    logger.info('Chat stream completed successfully')

    res.end()

  } catch (error) {
    logger.error('Chat stream error: {}', error instanceof Error ? error.message : String(error), error)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error' })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`)
      res.end()
    }
  }
})
