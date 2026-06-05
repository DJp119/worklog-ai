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
import { reminderJob } from './jobs/reminderJob.js'
import { monthlySummaryJob } from './jobs/monthlySummaryJob.js'
import { newsCollectionJob } from './jobs/newsCollectionJob.js'
import { weeklyDigestJob } from './jobs/weeklyDigestJob.js'
import { isDatabaseConfigured } from './lib/database.js'
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

function isAllowedVercelOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app')
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
      } catch (e) {
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
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.with('err', err).error('Unhandled error: {}', err.message)
  captureException(err)
  res.status(500).json({ success: false, error: getErrorMessageSync('internal') })
})

// Start server
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
  if (!hasNim && !hasMistral) {
    logger.warn('⚠️ WARNING: No AI provider configured (NVIDIA_NIM_API_KEY or MISTRAL_API_KEY)')
    logger.warn('   Chat and appraisal features will FAIL!')
  } else {
    if (hasNim) logger.info('✓ NVIDIA NIM configured')
    if (hasMistral) logger.info('✓ Mistral AI configured')
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
    })
  } else {
    logger.info('PostHog not configured (set POSTHOG_API_KEY env var)')
  }

  // Start background jobs
  reminderJob.start()
  monthlySummaryJob.start()
  newsCollectionJob.start()
  weeklyDigestJob.start()
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...')
  reminderJob.stop()
  monthlySummaryJob.stop()
  newsCollectionJob.stop()
  weeklyDigestJob.stop()
  await shutdownPostHog()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...')
  reminderJob.stop()
  monthlySummaryJob.stop()
  newsCollectionJob.stop()
  weeklyDigestJob.stop()
  await shutdownPostHog()
  process.exit(0)
})
