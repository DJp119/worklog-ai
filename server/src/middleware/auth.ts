import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { supabase } from '../lib/database.js'
import crypto from 'crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

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

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m'
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '30d'

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
 */
export async function requireAuth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing authorization header' })
            return
        }

        const token = authHeader.substring(7)
        const payload = verifyToken(token)

        if (!payload) {
            res.status(401).json({ error: 'Unauthorized: Invalid or expired token' })
            return
        }

        // Verify user still exists in database
        const { data: user } = await supabase
            .from('users')
            .select('id, email, name')
            .eq('id', payload.userId)
            .single()

        if (!user) {
            res.status(401).json({ error: 'Unauthorized: User not found' })
            return
        }

        req.userId = user.id
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
        }

        next()
    } catch (error) {
        console.error('[Auth] Middleware error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
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
            token: token,
            expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

    if (error) {
        console.error('Create refresh token error:', error)
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
        .eq('token', token)
        .eq('revoked', false)
}

/**
 * Validate refresh token
 */
export async function validateRefreshToken(token: string) {
    const { data: tokenRecord } = await supabase
        .from('refresh_tokens')
        .select('*, users(id, email, name)')
        .eq('token', token)
        .eq('revoked', false)
        .gte('expires_at', new Date().toISOString())
        .single()

    if (!tokenRecord) {
        return null
    }

    return tokenRecord
}
