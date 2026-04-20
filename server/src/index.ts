import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { authRoutes } from './routes/auth.js'
import { entriesRoutes } from './routes/entries.js'
import { appraisalRoutes } from './routes/appraisal.js'
import { reminderJob } from './jobs/reminderJob.js'
import { isSupabaseConfigured } from './lib/supabase.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS configuration - allow localhost in development
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true)
    // Allow any localhost port in development
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true)
    }
    // Allow configured production URL
    if (origin === process.env.FRONTEND_URL) {
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

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/entries', entriesRoutes)
app.use('/api/appraisal', appraisalRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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
  console.log(`Server running on http://localhost:${PORT}`)

  // Start reminder job
  if (process.env.NODE_ENV !== 'test') {
    if (isSupabaseConfigured) {
      reminderJob.start()
    } else {
      console.warn('Skipping reminder job startup because Supabase is not configured.')
    }
  }
})
