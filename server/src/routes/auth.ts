import { Router, Request, Response } from 'express'
import { supabase } from '../lib/database.js'
import {
    hashPassword,
    comparePassword,
    generateToken,
    isValidEmail,
    validatePasswordStrength,
} from '../lib/auth-utils.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js'
import {
    generateAccessToken,
    generateRefreshToken,
    createRefreshToken,
    revokeRefreshToken,
    validateRefreshToken,
    type JWTPayload,
} from '../middleware/auth.js'

export const authRoutes = Router()

// Extended request type for auth routes
interface AuthRequest extends Request {
    body: Record<string, any>
}

/**
 * POST /api/auth/signup
 * Create new user account
 */
authRoutes.post('/signup', async (req: AuthRequest, res: Response) => {
    try {
        const { email, password, name, company_name, job_title } = req.body

        // Validate inputs
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' })
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Valid email required' })
        }

        const passwordValidation = validatePasswordStrength(password)
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.errors.join(', ') })
        }

        // Hash password
        const passwordHash = await hashPassword(password)

        // Create user in database
        const { data: userData, error: userError } = await supabase
            .from('users')
            .insert({
                email: email.toLowerCase(),
                password_hash: passwordHash,
                name,
                company_name,
                job_title,
                email_verified: false,
            })
            .select()
            .single()

        if (userError) {
            if (userError.code === '23505') {
                // Unique violation
                return res.status(400).json({ error: 'Email already registered' })
            }
            console.error('Signup user create error:', userError)
            return res.status(500).json({ error: 'Failed to create account' })
        }

        // Generate email verification token
        const emailToken = generateToken()
        const emailExpiresAt = new Date()
        emailExpiresAt.setHours(emailExpiresAt.getHours() + 24)

        const { error: verificationError } = await supabase
            .from('email_verifications')
            .insert({
                user_id: userData.id,
                token: emailToken,
                expires_at: emailExpiresAt.toISOString(),
            })

        if (verificationError) {
            console.error('Verification token error:', verificationError)
            // Don't fail signup if token creation fails, but log the error
        }

        // Send verification email (don't fail signup if email fails)
        const emailSent = await sendVerificationEmail(email, userData.id, emailToken)
        if (!emailSent) {
            console.warn('Verification email not sent (Brevo not configured or failed)')
        }

        res.status(201).json({
            success: true,
            message: 'Account created. Please check your email to verify.',
            data: {
                id: userData.id,
                email: userData.email,
                name: userData.name,
            },
        })
    } catch (error) {
        console.error('Signup error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
authRoutes.post('/login', async (req: AuthRequest, res: Response) => {
    try {
        const { email, password, rememberMe } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' })
        }

        // Find user by email
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single()

        if (!user) {
            // Generic error to prevent email enumeration
            return res.status(401).json({ error: 'Invalid email or password' })
        }

        // Check if email is verified
        if (!user.email_verified) {
            return res.status(403).json({ error: 'Please verify your email before logging in' })
        }

        // Verify password
        const isValid = await comparePassword(password, user.password_hash)
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' })
        }

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
        })

        const refreshToken = generateRefreshToken()
        const tokenExpiryDays = rememberMe ? 30 : 7
        await createRefreshToken(user.id, refreshToken, tokenExpiryDays)

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    companyName: user.company_name,
                    jobTitle: user.job_title,
                },
                accessToken,
                refreshToken,
                expiresIn: 900, // 15 minutes in seconds
            },
        })
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * POST /api/auth/logout
 * Revoke refresh token
 */
authRoutes.post('/logout', async (req: AuthRequest, res: Response) => {
    try {
        const { refreshToken } = req.body

        if (refreshToken) {
            await revokeRefreshToken(refreshToken)
        }

        res.json({ success: true })
    } catch (error) {
        console.error('Logout error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * POST /api/auth/refresh
 * Get new access token using refresh token
 */
authRoutes.post('/refresh', async (req: AuthRequest, res: Response) => {
    try {
        const { refreshToken } = req.body

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' })
        }

        const tokenData = await validateRefreshToken(refreshToken)
        if (!tokenData) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' })
        }

        const { users } = tokenData

        // Generate new tokens
        const accessToken = generateAccessToken({
            userId: users.id,
            email: users.email,
        })

        const newRefreshToken = generateRefreshToken()
        await createRefreshToken(users.id, newRefreshToken, 30)

        // Revoke old refresh token
        await revokeRefreshToken(refreshToken)

        res.json({
            success: true,
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn: 900,
            },
        })
    } catch (error) {
        console.error('Refresh token error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * GET /api/auth/me
 * Get current user info
 */
authRoutes.get('/me', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const token = authHeader.substring(7)

        // Decode token manually to get user info
        const jwt = require('jsonwebtoken')
        const decoded = jwt.decode(token) as JWTPayload | null

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid token' })
        }

        const { data: user } = await supabase
            .from('users')
            .select('id, email, name, company_name, job_title, email_verified, reminder_day, reminder_time, reminder_enabled')
            .eq('id', (decoded as JWTPayload).userId)
            .single()

        if (!user) {
            return res.status(404).json({ error: 'User not found' })
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                companyName: user.company_name,
                jobTitle: user.job_title,
                emailVerified: user.email_verified,
                reminderDay: user.reminder_day,
                reminderTime: user.reminder_time,
                reminderEnabled: user.reminder_enabled,
            },
        })
    } catch (error) {
        console.error('Get current user error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * POST /api/auth/verify-email
 * Verify email address
 */
authRoutes.post('/verify-email', async (req: AuthRequest, res: Response) => {
    try {
        const { userId, token } = req.body

        if (!userId || !token) {
            return res.status(400).json({ error: 'User ID and token required' })
        }

        // Find verification token
        const { data: verification } = await supabase
            .from('email_verifications')
            .select('*')
            .eq('user_id', userId)
            .eq('token', token)
            .eq('verified', false)
            .gte('expires_at', new Date().toISOString())
            .single()

        if (!verification) {
            return res.status(400).json({ error: 'Invalid or expired verification token' })
        }

        // Mark user as verified
        await supabase
            .from('users')
            .update({
                email_verified: true,
                email_verified_at: new Date().toISOString(),
            })
            .eq('id', userId)

        // Mark token as used
        await supabase
            .from('email_verifications')
            .update({ verified: true })
            .eq('id', verification.id)

        res.json({
            success: true,
            message: 'Email verified successfully',
        })
    } catch (error) {
        console.error('Email verification error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
authRoutes.post('/forgot-password', async (req: AuthRequest, res: Response) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({ error: 'Email required' })
        }

        // Find user
        const { data: user } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email.toLowerCase())
            .single()

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent.',
            })
        }

        // Generate password reset token
        const resetToken = generateToken()
        const resetExpiresAt = new Date()
        resetExpiresAt.setHours(resetExpiresAt.getHours() + 1)

        const { error: resetError } = await supabase
            .from('password_resets')
            .insert({
                user_id: user.id,
                token: resetToken,
                expires_at: resetExpiresAt.toISOString(),
            })

        if (resetError) {
            console.error('Password reset token error:', resetError)
            return res.status(500).json({ error: 'Failed to send reset email' })
        }

        // Send reset email
        await sendPasswordResetEmail(user.email, user.id, resetToken)

        res.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.',
        })
    } catch (error) {
        console.error('Forgot password error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
authRoutes.post('/reset-password', async (req: AuthRequest, res: Response) => {
    try {
        const { userId, token, newPassword } = req.body

        if (!userId || !token || !newPassword) {
            return res.status(400).json({ error: 'User ID, token, and new password required' })
        }

        // Validate new password
        const passwordValidation = validatePasswordStrength(newPassword)
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.errors.join(', ') })
        }

        // Find password reset token
        const { data: resetRecord } = await supabase
            .from('password_resets')
            .select('*')
            .eq('user_id', userId)
            .eq('token', token)
            .eq('used', false)
            .gte('expires_at', new Date().toISOString())
            .single()

        if (!resetRecord) {
            return res.status(400).json({ error: 'Invalid or expired reset token' })
        }

        // Hash new password
        const passwordHash = await hashPassword(newPassword)

        // Update password
        await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('id', userId)

        // Mark token as used
        await supabase
            .from('password_resets')
            .update({ used: true, used_at: new Date().toISOString() })
            .eq('id', resetRecord.id)

        // Revoke all existing refresh tokens
        await supabase
            .from('refresh_tokens')
            .update({ revoked: true, revoked_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('revoked', false)

        res.json({
            success: true,
            message: 'Password reset successfully',
        })
    } catch (error) {
        console.error('Reset password error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})
