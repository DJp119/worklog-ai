// SECURITY: req.supabase is built with the SERVICE ROLE key and bypasses RLS.
// Every route handler that uses req.supabase MUST scope queries by req.userId
// (e.g. .eq('user_id', req.userId) or .eq('id', req.userId)). A handler that
// uses req.supabase without an explicit user filter can read or write any
// user's data. All current handlers in this repo follow this rule; treat it
// as a hard requirement for new handlers.

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { supabase, runtimeSupabaseKey, runtimeSupabaseUrl } from '../lib/database.js'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../lib/logger.js'
import { getMdcContext } from '../lib/mdc.js'

export interface AuthRequest extends Request {
    userId?: string
    user?: {
        id: string
        email: string
        name?: string
    }
    supabase?: SupabaseClient
}

export interface JWTPayload {
    userId: string
    email: string
}

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET
if (!ACCESS_TOKEN_SECRET || ACCESS_TOKEN_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters')
}
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m'

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    })
}

/**
 * Generate refresh token (random string)
 */
export function generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex')
}

/**
 * Create refresh token in database
 */
export async function createRefreshToken(userId: string, token: string, expiryDays: number = 30) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiryDays)

    const { data, error } = await supabase
        .from('refresh_tokens')
        .insert({
            user_id: userId,
            token_hash: hashToken(token),
            expires_at: expiresAt.toISOString(),
            session_ttl_days: expiryDays,
        })
        .select()
        .single()

    if (error) {
        logger.with('err', error).error('Create refresh token error: {}', error.message)
        throw error
    }

    return data
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(token: string) {
    const revokedAt = new Date()

    await supabase
        .from('refresh_tokens')
        .update({
            revoked: true,
            revoked_at: revokedAt.toISOString(),
        })
        .eq('token_hash', hashToken(token))
        .eq('revoked', false)
}

/**
 * Validate refresh token
 */
export async function validateRefreshToken(token: string) {
    const now = new Date().toISOString()

    const { data: tokenRecord } = await supabase
        .from('refresh_tokens')
        .select('*, users(id, email, name)')
        .eq('token_hash', hashToken(token))
        .eq('revoked', false)
        .gte('expires_at', now)
        .single()

    if (!tokenRecord) {
        return null
    }

    return tokenRecord
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, ACCESS_TOKEN_SECRET) as JWTPayload
    } catch {
        return null
    }
}

/**
 * Middleware to verify JWT token from Authorization header
 * Expects: Authorization: Bearer <token>
 *
 * SECURITY: `req.supabase` is built with the SERVICE ROLE key, which bypasses
 * RLS. Every route handler that uses `req.supabase` MUST scope all queries
 * by `req.userId` (e.g. `.eq('id', req.userId)`). Forgetting this is a
 * privilege-escalation bug. If you need a user-scoped client, prefer the
 * per-user Supabase client created from the request's JWT.
 */
export async function requireAuth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('[Auth] Missing or invalid auth header')
            res.status(401).json({ error: 'Unauthorized: Missing authorization header' })
            return
        }

        const token = authHeader.substring(7)
        const payload = verifyToken(token)

        if (!payload) {
            logger.with('tokenPrefix', token.substring(0, 10)).warn('[Auth] Invalid or expired token')
            res.status(401).json({ error: 'Unauthorized: Invalid or expired token' })
            return
        }

        // Verify user still exists in database
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, name')
            .eq('id', payload.userId)
            .single()

        if (userError || !user) {
            logger.with('targetUserId', payload.userId).with('err', userError).warn('[Auth] User not found in database')
            res.status(401).json({ error: 'Unauthorized: User not found' })
            return
        }

        req.userId = user.id
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
        }

        // Add userId to MDC! Now every logger.info() call automatically gets userId.
        const context = getMdcContext()
        if (context) {
            context.userId = user.id
        }

        // Create a new Supabase client for this request using the service key
        // This allows the route handlers to make database queries
        req.supabase = createClient(runtimeSupabaseUrl || 'https://placeholder.supabase.co', runtimeSupabaseKey || 'placeholder', {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        })

        next()
    } catch (error) {
        logger.with('err', error).error('[Auth] Middleware error: {}', error instanceof Error ? error.message : String(error))
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
            const payload = verifyToken(token)

            if (payload) {
                const { data: user } = await supabase
                    .from('users')
                    .select('id, email, name')
                    .eq('id', payload.userId)
                    .single()

                if (user) {
                    req.userId = user.id
                    req.user = {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                    }

                    const context = getMdcContext()
                    if (context) {
                        context.userId = user.id
                    }
                    req.supabase = createClient(runtimeSupabaseUrl || 'https://placeholder.supabase.co', runtimeSupabaseKey || 'placeholder', {
                        auth: {
                            autoRefreshToken: false,
                            persistSession: false,
                        },
                    })
                }
            }
        }

        next()
    } catch {
        // Silently continue - auth is optional
        next()
    }
}

/**
 * Hash a token using SHA-256 for secure DB storage
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
}
