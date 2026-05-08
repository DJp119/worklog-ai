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
import { reminderJob } from './jobs/reminderJob.js'
import { monthlySummaryJob } from './jobs/monthlySummaryJob.js'
import { isDatabaseConfigured } from './lib/database.js'

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

// Rate limiting
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

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
    next()
})

// Routes
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/entries', entriesRoutes)
app.use('/api/appraisal', appraisalRoutes)
app.use('/api/users', userRoutes)
app.use('/api/summaries', summariesRoutes)
app.use('/api/chat', chatRoutes)

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: isDatabaseConfigured ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development',
    })
})

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err)
    res.status(500).json({ error: 'Internal server error' })
})

// Start server
app.listen(PORT, () => {
<<<<<<< Updated upstream
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`Database: ${isDatabaseConfigured ? 'configured' : 'not configured'}`)

    // Start reminder job
    if (process.env.NODE_ENV !== 'test') {
        console.log('Reminder job: initialized')
    }
=======
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  
  // Start background jobs
  monthlySummaryJob.start()
>>>>>>> Stashed changes
})
