import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { authRoutes } from './routes/auth.js'
import { entriesRoutes } from './routes/entries.js'
import { appraisalRoutes } from './routes/appraisal.js'
import { userRoutes } from './routes/users.js'
import { summariesRoutes } from './routes/summaries.js'
import { chatRoutes } from './routes/chat.js'
import { feedbackRoutes } from './routes/feedback.js'
import { reminderJob } from './jobs/reminderJob.js'
import { monthlySummaryJob } from './jobs/monthlySummaryJob.js'
import { isDatabaseConfigured } from './lib/database.js'
import { getPostHogClient, shutdownPostHog, captureException } from './lib/posthog.js'

dotenv.config()

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
    console.warn(`CORS blocked: ${origin}`)
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
    message: { error: 'Too many requests, please try again later' },
  })
  app.use(limiter)

  // Auth-specific rate limiting
  const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 auth attempts per hour
    message: { error: 'Too many auth attempts, please try again later' },
  })
  app.use('/api/auth', authLimiter)
}

// Request logging with PostHog
app.use((req, res, next) => {
  const startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - startTime
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`)

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
  console.error('Unhandled error:', err)
  captureException(err)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)

  // Initialize PostHog
  const posthog = getPostHogClient()
  if (posthog) {
    console.log('PostHog initialized')
  } else {
    console.log('PostHog not configured (set POSTHOG_API_KEY env var)')
  }

  // Start background jobs
  reminderJob.start()
  monthlySummaryJob.start()
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  reminderJob.stop()
  monthlySummaryJob.stop()
  await shutdownPostHog()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  reminderJob.stop()
  monthlySummaryJob.stop()
  await shutdownPostHog()
  process.exit(0)
})
