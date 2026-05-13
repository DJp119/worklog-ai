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
  requireAuth,
  type JWTPayload,
} from '../middleware/auth.js'
import { captureEvent, captureException, identifyUser } from '../lib/posthog.js'

export const authRoutes = Router()

// Extended request type for auth routes
interface AuthRequest extends Request {
  body: Record<string, any>
  userId?: string
  supabase?: any
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
    console.log('=== EMAIL DEBUG ===')
    console.log('Sending verification email to:', email)
    console.log('User ID:', userData.id)
    console.log('BREVO_FROM_EMAIL:', process.env.BREVO_FROM_EMAIL)
    console.log('BREVO_API_KEY configured:', !!process.env.BREVO_API_KEY)
    const emailSent = await sendVerificationEmail(email, userData.id, emailToken)
    console.log('Email sent result:', emailSent ? 'SUCCESS' : 'FAILED')
    console.log('=== END EMAIL DEBUG ===')
    if (!emailSent) {
      console.warn('Verification email not sent (Brevo not configured or failed)')
    }

    identifyUser(userData.id, {
      email: userData.email,
      name: userData.name,
      company_name,
      job_title,
      $set_once: { first_seen: new Date().toISOString() },
    })
    captureEvent(userData.id, 'user_signed_up', {
      email: userData.email,
      name: userData.name,
      has_company: !!company_name,
      has_job_title: !!job_title,
    })

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
    captureException(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
authRoutes.post('/verify-email', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, token } = req.body

    if (!userId || !token) {
      return res.status(400).json({ error: 'User ID and token required' })
    }

    // Find verification record
    const { data: verifyData, error: verifyError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('user_id', userId)
      .eq('token', token)
      .single()

    if (verifyError || !verifyData) {
      return res.status(400).json({ error: 'Invalid or expired verification token' })
    }

    // Check if token is expired
    const expiresAt = new Date(verifyData.expires_at)
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' })
    }

    // Mark user as verified
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', userId)

    if (updateError) {
      console.error('Email verification update error:', updateError)
      return res.status(500).json({ error: 'Failed to verify email' })
    }

    // Delete verification token
    await supabase.from('email_verifications').delete().eq('id', verifyData.id)

    captureEvent(userId, 'email_verified')

    res.json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error) {
    console.error('Email verification error:', error)
    captureException(error)
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
    const accessToken = generateAccessToken({ userId: user.id, email: user.email })
    const refreshToken = generateRefreshToken()
    const tokenExpiryDays = rememberMe ? 30 : 7
    await createRefreshToken(user.id, refreshToken, tokenExpiryDays)

    identifyUser(user.id, {
      email: user.email,
      name: user.name,
      company_name: user.company_name,
      job_title: user.job_title,
    })
    captureEvent(user.id, 'user_logged_in', {
      remember_me: !!rememberMe,
    })

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
    captureException(error)
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
      const tokenRecord = await validateRefreshToken(refreshToken)
      const logoutUserId = tokenRecord ? (tokenRecord as any).users?.id : undefined
      await revokeRefreshToken(refreshToken)
      if (logoutUserId) {
        captureEvent(logoutUserId, 'user_logged_out')
      }
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/auth/me
 * Get current user profile
 */
authRoutes.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !user) {
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
        createdAt: user.created_at,
      },
    })
  } catch (error) {
    console.error('Get user profile error:', error)
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

    // Find user by email
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

    // Generate reset token
    const resetToken = generateToken()
    const resetExpiresAt = new Date()
    resetExpiresAt.setHours(resetExpiresAt.getHours() + 1) // 1 hour expiry

    // Store reset token (delete any existing ones first)
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', user.id)

    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: resetToken,
        expires_at: resetExpiresAt.toISOString(),
      })

    if (tokenError) {
      console.error('Password reset token error:', tokenError)
      // Don't fail the request, just log the error
    }

    // Send reset email
    const emailSent = await sendPasswordResetEmail(user.email, user.id, resetToken)
    if (!emailSent) {
      console.warn('Password reset email not sent (Brevo not configured)')
    }

    captureEvent(user.id, 'password_reset_requested', {
      email_sent: emailSent,
    })

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    captureException(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
authRoutes.post('/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' })
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword)
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.errors.join(', ') })
    }

    // Find valid reset token
    const { data: resetData, error: resetError } = await supabase
      .from('password_reset_tokens')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (resetError || !resetData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    // Check if token is expired
    const expiresAt = new Date(resetData.expires_at)
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' })
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword)

    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', resetData.user_id)

    if (updateError) {
      console.error('Password update error:', updateError)
      return res.status(500).json({ error: 'Failed to reset password' })
    }

    // Delete used reset token
    await supabase.from('password_reset_tokens').delete().eq('id', resetData.user_id)

    captureEvent(resetData.user_id, 'password_reset_completed')

    res.json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    captureException(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
authRoutes.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' })
    }

    // Validate refresh token
    const tokenRecord = await validateRefreshToken(refreshToken)
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }

    // Get user from token record (already joined in validateRefreshToken)
    const user = (tokenRecord as any).users
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Revoke old refresh token
    await revokeRefreshToken(refreshToken)

    // Generate new tokens
    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email })
    const newRefreshToken = generateRefreshToken()
    await createRefreshToken(user.id, newRefreshToken, 30) // 30 days

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      },
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
