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
import { languageFromAcceptHeader } from '../lib/userLanguage.js'
import {
  generateAccessToken,
  generateRefreshToken,
  createRefreshToken,
  revokeRefreshToken,
  validateRefreshToken,
  requireAuth,
  hashToken,
  type JWTPayload,
} from '../middleware/auth.js'
import { captureEvent, captureException, identifyUser } from '../lib/posthog.js'
import { logger } from '../lib/logger.js'
import { getErrorMessage, getErrorMessageSync } from '../i18n/errors.js'

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
      logger.warn('Signup validation failed: Email and password required')
      return res.status(400).json({ error: await getErrorMessage(req, 'emailPasswordRequired') })
    }

    if (!isValidEmail(email)) {
      logger.warn('Signup validation failed: Invalid email format')
      return res.status(400).json({ error: await getErrorMessage(req, 'validEmailRequired') })
    }

    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      logger.warn('Signup validation failed: Password strength requirements not met')
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
        logger.warn('Signup failed: Email already registered')
        return res.status(400).json({ error: await getErrorMessage(req, 'emailAlreadyRegistered') })
      }
      logger.error('Signup user create error: {}', userError.message, userError)
      return res.status(500).json({ error: getErrorMessageSync('failedToCreateAccount') })
    }

    // Generate email verification token
    const emailToken = generateToken()
    const emailExpiresAt = new Date()
    emailExpiresAt.setHours(emailExpiresAt.getHours() + 24)

    const { error: verificationError } = await supabase
      .from('email_verifications')
      .insert({
        user_id: userData.id,
        token_hash: hashToken(emailToken),
        expires_at: emailExpiresAt.toISOString(),
      })

    if (verificationError) {
      logger.error('Verification token error: {}', verificationError.message, verificationError)
      // Don't fail signup if token creation fails, but log the error
    }

    // Create the user_profiles row alongside the users row. Custom-auth signup
    // does not fire the Supabase Auth trigger that normally populates
    // user_profiles, so the row would otherwise be missing and the first
    // preferred_language upsert would fail on the email NOT NULL constraint.
    const { error: profileCreateError } = await supabase
      .from('user_profiles')
      .upsert(
        { id: userData.id, email: userData.email, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )

    if (profileCreateError) {
      // Don't fail signup if this fails (user is already created); log it so
      // the row can be repaired later.
      logger.error('user_profiles row create error: {}', profileCreateError.message, profileCreateError)
    }

    // Send verification email (don't fail signup if email fails)
    const emailSent = await sendVerificationEmail(email, userData.id, emailToken, languageFromAcceptHeader(req.headers['accept-language'] as string | undefined))
    if (!emailSent) {
      logger.warn('Verification email not sent (Brevo not configured or failed)')
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

    logger.info('New user signed up successfully')

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
    logger.error('Signup error: {}', error instanceof Error ? error.message : String(error), error)
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
      logger.warn('Email verification failed: User ID and token required')
      return res.status(400).json({ error: await getErrorMessage(req, 'userIdAndTokenRequired') })
    }

    // Find verification record
    const { data: verifyData, error: verifyError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('user_id', userId)
      .eq('token_hash', hashToken(token))
      .single()

    if (verifyError || !verifyData) {
      logger.warn('Email verification failed: Invalid or expired token')
      return res.status(400).json({ error: await getErrorMessage(req, 'invalidOrExpiredToken') })
    }

    // Check if token is expired
    const expiresAt = new Date(verifyData.expires_at)
    if (expiresAt < new Date()) {
      logger.warn('Email verification failed: Token has expired')
      return res.status(400).json({ error: await getErrorMessage(req, 'tokenExpired') })
    }

    // Mark user as verified
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', userId)

    if (updateError) {
      logger.error('Email verification update error: {}', updateError.message, updateError)
      return res.status(500).json({ error: getErrorMessageSync('failedToVerifyEmail') })
    }

    // Delete verification token
    await supabase.from('email_verifications').delete().eq('id', verifyData.id)

    captureEvent(userId, 'email_verified')

    logger.info('Email verified successfully')

    res.json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error) {
    logger.error('Email verification error: {}', error instanceof Error ? error.message : String(error), error)
    captureException(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/auth/resend-verification
 * Resend verification email with 60s rate limit
 */
authRoutes.post('/resend-verification', async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: await getErrorMessage(req, 'emailPasswordRequired') })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: await getErrorMessage(req, 'validEmailRequired') })
    }

    // Find user by email
    const { data: user } = await supabase
      .from('users')
      .select('id, email, email_verified')
      .eq('email', email.toLowerCase())
      .single()

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an unverified account exists with this email, a new verification link has been sent.',
      })
    }

    // If already verified, also return generic success (no harm done)
    if (user.email_verified) {
      return res.json({
        success: true,
        message: 'If an unverified account exists with this email, a new verification link has been sent.',
      })
    }

    // Rate limit: check for any verification token created in the last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const { data: recentToken } = await supabase
      .from('email_verifications')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gte('created_at', sixtySecondsAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentToken) {
      return res.status(429).json({ error: await getErrorMessage(req, 'pleaseWaitVerification') })
    }

    // Clean up any old expired/unused tokens for this user
    await supabase
      .from('email_verifications')
      .delete()
      .eq('user_id', user.id)

    // Generate a fresh token with 24h expiry
    const emailToken = generateToken()
    const emailExpiresAt = new Date()
    emailExpiresAt.setHours(emailExpiresAt.getHours() + 24)

    const { error: insertError } = await supabase
      .from('email_verifications')
      .insert({
        user_id: user.id,
        token: emailToken,
        expires_at: emailExpiresAt.toISOString(),
      })

    if (insertError) {
      logger.error('Resend verification token error: {}', insertError.message, insertError)
      return res.status(500).json({ error: getErrorMessageSync('failedToResendVerification') })
    }

    // Send the verification email
    const emailSent = await sendVerificationEmail(user.email, user.id, emailToken, languageFromAcceptHeader(req.headers['accept-language'] as string | undefined))
    if (!emailSent) {
      logger.warn('Resend verification email not sent (Brevo not configured or failed)')
    }

    captureEvent(user.id, 'verification_email_resent', {
      email_sent: emailSent,
    })

    logger.info('Verification email resent successfully')

    res.json({
      success: true,
      message: 'If an unverified account exists with this email, a new verification link has been sent.',
    })
  } catch (error) {
    logger.error('Resend verification error: {}', error instanceof Error ? error.message : String(error), error)
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
      logger.warn('Login validation failed: Email and password required')
      return res.status(400).json({ error: await getErrorMessage(req, 'emailPasswordRequired') })
    }

    // Find user by email
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (!user) {
      // Generic error to prevent email enumeration
      logger.warn('Login failed: Invalid email or password (user not found)')
      return res.status(401).json({ error: await getErrorMessage(req, 'invalidCredentials') })
    }

    // Check if email is verified
    if (!user.email_verified) {
      logger.warn('Login failed: Email not verified')
      return res.status(403).json({
        error: await getErrorMessage(req, 'emailNotVerified'),
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      })
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash)
    if (!isValid) {
      logger.warn('Login failed: Invalid email or password (wrong password)')
      return res.status(401).json({ error: await getErrorMessage(req, 'invalidCredentials') })
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

    logger.info('User logged in successfully')

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.first_name ?? null,
          companyName: user.company_name,
          jobTitle: user.job_title,
          onboardingCompleted: user.onboarding_completed ?? false,
        },
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      },
    })
  } catch (error) {
    logger.error('Login error: {}', error instanceof Error ? error.message : String(error), error)
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
        logger.info('User logged out successfully')
      }
    }

    res.json({ success: true })
  } catch (error) {
    logger.error('Logout error: {}', error instanceof Error ? error.message : String(error), error)
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
      return res.status(404).json({ error: await getErrorMessage(req, 'userNotFound') })
    }

    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('preferred_language')
      .eq('id', userId)
      .maybeSingle()

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyName: user.company_name,
        jobTitle: user.job_title,
        emailVerified: user.email_verified,
        preferredLanguage: profileRow?.preferred_language ?? null,
        createdAt: user.created_at,
      },
    })
  } catch (error) {
    logger.error('Get user profile error: {}', error instanceof Error ? error.message : String(error), error)
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
      return res.status(400).json({ error: await getErrorMessage(req, 'emailPasswordRequired') })
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
        token_hash: hashToken(resetToken),
        expires_at: resetExpiresAt.toISOString(),
      })

    if (tokenError) {
      logger.error('Password reset token error: {}', tokenError.message, tokenError)
      // Don't fail the request, just log the error
    }

    // Send reset email
    const emailSent = await sendPasswordResetEmail(user.email, user.id, resetToken, languageFromAcceptHeader(req.headers['accept-language'] as string | undefined))
    if (!emailSent) {
      logger.warn('Password reset email not sent (Brevo not configured)')
    }

    captureEvent(user.id, 'password_reset_requested', {
      email_sent: emailSent,
    })

    logger.info('Password reset requested successfully')

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    logger.error('Forgot password error: {}', error instanceof Error ? error.message : String(error), error)
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
      return res.status(400).json({ error: await getErrorMessage(req, 'currentAndNewPasswordRequired') })
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword)
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.errors.join(', ') })
    }

    // Find valid reset token
    const { data: resetData, error: resetError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at')
      .eq('token_hash', hashToken(token))
      .single()

    if (resetError || !resetData) {
      return res.status(400).json({ error: await getErrorMessage(req, 'invalidOrExpiredToken') })
    }

    // Check if token is expired
    const expiresAt = new Date(resetData.expires_at)
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: await getErrorMessage(req, 'tokenExpired') })
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword)

    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', resetData.user_id)

    if (updateError) {
      logger.error('Password update error: {}', updateError.message, updateError)
      return res.status(500).json({ error: 'Failed to reset password' })
    }

    // Revoke all active refresh tokens for this user — parity with change-password (users.ts:251-259).
    // Why: the reset-password flow is the account-compromise recovery path; if we don't revoke,
    // an attacker holding a stolen refresh token retains access for the original 7-30 day window.
    await supabase
      .from('refresh_tokens')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', resetData.user_id)
      .eq('revoked', false)

    // Delete used reset token
    await supabase.from('password_reset_tokens').delete().eq('id', resetData.id)

    captureEvent(resetData.user_id, 'password_reset_completed')

    logger.info('Password reset successfully')

    res.json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    logger.error('Reset password error: {}', error instanceof Error ? error.message : String(error), error)
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
      logger.warn('Token refresh failed: Refresh token required')
      return res.status(400).json({ error: await getErrorMessage(req, 'refreshTokenRequired') })
    }

    // Validate refresh token
    const tokenRecord = await validateRefreshToken(refreshToken)
    if (!tokenRecord) {
      logger.warn('Token refresh failed: Invalid or expired refresh token')
      return res.status(401).json({ error: await getErrorMessage(req, 'invalidRefreshToken') })
    }

    // Get user from token record (already joined in validateRefreshToken)
    const user = (tokenRecord as any).users
    if (!user) {
      return res.status(404).json({ error: await getErrorMessage(req, 'userNotFound') })
    }

    // Revoke old refresh token
    await revokeRefreshToken(refreshToken)

    // Honor the original login's rememberMe choice: 30 days if they checked it,
    // 7 days if they didn't. Default to 30 for legacy rows missing the column value.
    const sessionTtlDays = (tokenRecord as any).session_ttl_days ?? 30

    // Generate new tokens
    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email })
    const newRefreshToken = generateRefreshToken()
    await createRefreshToken(user.id, newRefreshToken, sessionTtlDays)

    logger.info('Token refreshed successfully')

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      },
    })
  } catch (error) {
    logger.error('Token refresh error: {}', error instanceof Error ? error.message : String(error), error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
