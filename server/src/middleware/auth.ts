import { Request, Response, NextFunction } from 'express'
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase.js'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuthRequest extends Request {
  userId?: string
  user?: {
    id: string
    email: string
  }
  supabase?: SupabaseClient
}

/**
 * Middleware to verify JWT token from Authorization header
 * Expects: Authorization: Bearer <token>
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isSupabaseConfigured) {
      res.status(503).json({ error: 'Service unavailable: Supabase backend is not configured' })
      return
    }

    const authHeader = req.headers.authorization

    console.log(`[Auth] Request from ${req.ip}, Auth header: ${authHeader ? 'present' : 'missing'}`)

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[Auth] No Bearer token found')
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' })
      return
    }

    const token = authHeader.substring(7)
    console.log(`[Auth] Token received (first 20 chars): ${token.substring(0, 20)}...`)

    // Verify token with Supabase
    const supabase = getSupabaseClient(token)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.error('[Auth] Token verification failed:', error?.message || 'Invalid token')
      res.status(401).json({ error: 'Unauthorized: Invalid token' })
      return
    }

    // Attach user to request
    req.userId = user.id
    req.user = {
      id: user.id,
      email: user.email || '',
    }
    req.supabase = supabase

    console.log(`[Auth] User authenticated: ${user.email}`)
    next()
  } catch (error) {
    console.error('[Auth] Middleware error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const supabase = getSupabaseClient(token)
      const { data: { user } } = await supabase.auth.getUser(token)

      if (user) {
        req.userId = user.id
        req.user = {
          id: user.id,
          email: user.email || '',
        }
        req.supabase = supabase
      }
    }

    next()
  } catch (error) {
    // Silently continue - auth is optional
    next()
  }
}
