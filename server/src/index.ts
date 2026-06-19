import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { authRoutes } from './routes/auth.js'
import { entriesRoutes } from './routes/entries.js'
import { appraisalRoutes } from './routes/appraisal.js'
import { userRoutes } from './routes/users.js'
import { summariesRoutes } from './routes/summaries.js'
import { chatRoutes } from './routes/chat.js'
import { feedbackRoutes } from './routes/feedback.js'
import { aiPulseRoutes } from './routes/aiPulse.js'
import { translateRoutes } from './routes/translate.js'
import { waitlistRoutes } from './routes/waitlist.js'
import { organizationRoutes } from './routes/organizations.js'
import { teamRoutes } from './routes/teams.js'
import { goalRoutes } from './routes/goals.js'
import { githubWebhookRoutes } from './routes/webhooks/github.js'
import { jiraWebhookRoutes } from './routes/webhooks/jira.js'
import { slackWebhookRoutes } from './routes/webhooks/slack.js'
import { integrationRoutes } from './routes/integrations.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { reportRoutes } from './routes/reports.js'
import { reminderJob } from './jobs/reminderJob.js'
import { monthlySummaryJob } from './jobs/monthlySummaryJob.js'
import { newsCollectionJob } from './jobs/newsCollectionJob.js'
import { weeklyDigestJob } from './jobs/weeklyDigestJob.js'
import { weeklySyncJob } from './jobs/weeklySyncJob.js'
import { goalRollupJob } from './jobs/goalRollupJob.js'
import { goalDigestJob } from './jobs/goalDigestJob.js'
import { pruneJob } from './jobs/pruneJob.js'
import { getPostHogClient, shutdownPostHog, captureException, captureEvent } from './lib/posthog.js'
import { logger } from './lib/logger.js'
import { requestIdMiddleware } from './middleware/requestId.js'
import { getErrorMessageSync } from './i18n/errors.js'


const app = express()
const PORT = process.env.PORT || 3001
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// Comma-separated allowlist of Vercel production app hostnames (e.g.
// "worklog-ai.vercel.app,worklog-ai-staging.vercel.app"). Preview deploys
// under those *projects* are still allowed via the prefix match — but
// random *.vercel.app URLs owned by other Vercel users are NOT (Bug 23).
const allowedVercelApps = (process.env.VERCEL_ALLOWED_APPS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function isAllowedVercelOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (!host.endsWith('.vercel.app')) return false
    // Match against the explicit allowlist (with or without the .vercel.app suffix)
    return allowedVercelApps.some((allowed) => {
      const a = allowed.replace(/\.vercel\.app$/i, '').toLowerCase()
      return host === `${a}.vercel.app`
    })
  } catch {
    return false
  }
}

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true)
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    if (isAllowedVercelOrigin(origin)) {
      return callback(null, true)
    }
    logger.warn('CORS blocked: {}', origin)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

// Middleware
// Raw-body capture for webhook signature verification (MUST be before express.json)
app.use('/api/webhooks/github', express.json({ verify: (req: any, _: any, buf: Buffer) => { req.rawBody = buf } }))
app.use('/api/webhooks/jira', express.json({ verify: (req: any, _: any, buf: Buffer) => { req.rawBody = buf } }))
app.use('/api/webhooks/slack', express.urlencoded({ extended: true, verify: (req: any, _: any, buf: Buffer) => { req.rawBody = buf } }))
// Paddle sends a JSON body whose raw bytes must be HMAC-verified; capture as
// text (raw) then parse in the handler.
app.use('/api/webhooks/paddle', express.text({ type: 'application/json', verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf } }))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Trust proxy (Render) for correct client IP in rate limiting
app.set('trust proxy', 1)

// Rate limiting (disabled for development)
const isDevelopment = process.env.NODE_ENV === 'development'

if (!isDevelopment) {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: { error: getErrorMessageSync('rateLimited') },
  })
  app.use(limiter)

  // Auth-specific rate limiting
  const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 auth attempts per hour
    message: { error: getErrorMessageSync('tooManyAuthAttempts') },
  })
  app.use('/api/auth', authLimiter)
}

// Request logging with PostHog
app.use(requestIdMiddleware)

app.use((req, res, next) => {
  if (req.url === '/health') return next() // Skip noise

  const startTime = Date.now()
  logger.info('Incoming request: {} {}', req.method, req.path)

  res.on('finish', () => {
    const duration = Date.now() - startTime
    logger
      .with('durationMs', duration)
      .with('statusCode', res.statusCode)
      .info('Request completed: {} {} → {}', req.method, req.path, res.statusCode)

    // Capture to PostHog if configured
    const posthog = getPostHogClient()
    if (posthog && req.headers.authorization) {
      // Extract user ID from JWT if available
      try {
        const authHeader = req.headers.authorization as string
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7)
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
          posthog.capture({
            distinctId: payload.userId,
            event: 'api_request',
            properties: {
              method: req.method,
              path: req.path,
              status: res.statusCode,
              duration_ms: duration,
              user_agent: req.headers['user-agent'],
            },
          })
        }
      } catch {
        // Ignore JWT parse errors for logging
      }
    }
  })

  next()
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/entries', entriesRoutes)
app.use('/api/appraisal', appraisalRoutes)
app.use('/api/users', userRoutes)
app.use('/api/summaries', summariesRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/ai-pulse', aiPulseRoutes)
app.use('/api/translate', translateRoutes)
app.use('/api/waitlist', waitlistRoutes)
app.use('/api/orgs', organizationRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/goals', goalRoutes)
app.use('/api/webhooks/github', githubWebhookRoutes)
app.use('/api/webhooks/jira', jiraWebhookRoutes)
app.use('/api/webhooks/slack', slackWebhookRoutes)
app.use('/api/integrations', integrationRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
// Paddle webhooks are handled by the subscription routes (/webhook sub-route).
app.use('/api/webhooks/paddle', subscriptionRoutes)
app.use('/api/reports', reportRoutes)

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'WorkLog AI API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      auth: 'POST /api/auth/login, POST /api/auth/verify, POST /api/auth/logout',
      entries: 'GET/POST /api/entries, GET/PUT/DELETE /api/entries/:id',
      appraisal: 'POST /api/appraisal/generate, GET /api/appraisal/:id',
      users: 'GET/PUT /api/users/profile, PUT /api/users/reminder',
    },
  })
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { // eslint-disable-line no-unused-vars -- Express requires 4-arg error handler signature
  logger.with('err', err).error('Unhandled error: {}', err.message)
  captureException(err)
  res.status(500).json({ success: false, error: getErrorMessageSync('internal') })
})

// Start server
async function startServer() {
  // Issue CU: clear orphaned locks from prior crashes before starting jobs.
  // Without this, a user stuck in `is_syncing=true` from a previous server
  // crash would have to wait 15 minutes for the timeout to expire; same for
  // token refresh locks (30s) and global cron locks.
  try {
    const { supabase } = await import('./lib/database.js')
    const now = new Date().toISOString()
    await Promise.all([
      supabase.from('integration_preferences').update({ is_syncing: false, sync_started_at: null }).eq('is_syncing', true),
      supabase.from('user_integrations').update({ is_refreshing: false, refresh_started_at: null }).eq('is_refreshing', true),
      supabase.from('org_integrations').update({ is_refreshing: false, refresh_started_at: null }).eq('is_refreshing', true),
      // Prune expired temp/cache tables so they don't accumulate forever
      supabase.from('temp_oauth_states').delete().lt('expires_at', now),
      supabase.from('temp_slack_codes').delete().lt('expires_at', now),
      supabase.from('slack_command_sessions').delete().lt('expires_at', now),
      supabase.from('integration_events').delete().lt('received_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])
    logger.info('✓ Orphaned locks and expired temp records cleared at startup')
  } catch (err) {
    logger.with('err', err).warn('Startup lock cleanup failed (continuing)')
  }

  app.listen(PORT, () => {
  logger.info('Server running on http://localhost:{}', PORT)
  logger.info('Environment: {}', process.env.NODE_ENV || 'development')

  // Critical environment variable checks
  logger.info('--- Environment Check ---')
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    logger.warn('⚠️ WARNING: JWT_SECRET is missing or too short (< 32 chars)')
    logger.warn('   Authentication will FAIL in production!')
  } else {
    logger.info('✓ JWT_SECRET configured')
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    logger.warn('⚠️ WARNING: SUPABASE_SERVICE_KEY is missing')
    logger.warn('   Database queries will FAIL!')
  } else {
    logger.info('✓ SUPABASE_SERVICE_KEY configured')
  }

  if (!process.env.FRONTEND_URL) {
    logger.warn('⚠️ WARNING: FRONTEND_URL not set, CORS may be limited')
  } else {
    logger.info('✓ FRONTEND_URL configured')
  }

  // Check AI providers
  const hasNim = !!process.env.NVIDIA_NIM_API_KEY
  const hasMistral = !!process.env.MISTRAL_API_KEY
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY
  if (!hasNim && !hasMistral && !hasOpenRouter) {
    logger.warn('⚠️ WARNING: No AI provider configured (NVIDIA_NIM_API_KEY, MISTRAL_API_KEY, or OPENROUTER_API_KEY)')
    logger.warn('   Chat and appraisal features will FAIL!')
  } else {
    if (hasNim) logger.info('✓ NVIDIA NIM configured')
    if (hasMistral) logger.info('✓ Mistral AI configured')
    if (hasOpenRouter) logger.info('✓ OpenRouter AI configured')
  }
  logger.info('---------------')

  // Initialize PostHog
  const posthog = getPostHogClient()
  if (posthog) {
    logger.info('✓ PostHog initialized')
    captureEvent('system', 'server_started', {
      has_jwt: !!process.env.JWT_SECRET,
      has_supabase: !!process.env.SUPABASE_SERVICE_KEY,
      has_nim: hasNim,
      has_mistral: hasMistral,
      has_openrouter: hasOpenRouter,
    })
  } else {
    logger.info('PostHog not configured (set POSTHOG_API_KEY env var)')
  }

  // Start background jobs
  reminderJob.start()
  monthlySummaryJob.start()
  newsCollectionJob.start()
  weeklyDigestJob.start()
  weeklySyncJob.start()
  goalRollupJob.start()
  goalDigestJob.start()
  pruneJob.start()
  })
} // end startServer

startServer().catch((err) => {
  logger.with('err', err).error('Failed to start server')
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...')
  reminderJob.stop()
  monthlySummaryJob.stop()
  newsCollectionJob.stop()
  weeklyDigestJob.stop()
  weeklySyncJob.stop()
  goalRollupJob.stop()
  goalDigestJob.stop()
  pruneJob.stop()
  await shutdownPostHog()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...')
  reminderJob.stop()
  monthlySummaryJob.stop()
  newsCollectionJob.stop()
  weeklyDigestJob.stop()
  weeklySyncJob.stop()
  goalRollupJob.stop()
  goalDigestJob.stop()
  pruneJob.stop()
  await shutdownPostHog()
  process.exit(0)
})
