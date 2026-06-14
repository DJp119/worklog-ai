import { Router, Request, Response } from 'express'
import { supabase } from '../lib/database.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { hashPassword, comparePassword, validatePasswordStrength } from '../lib/auth-utils.js'
import { captureEvent, captureException } from '../lib/posthog.js'
import { logger } from '../lib/logger.js'
import { getErrorMessage, getErrorMessageSync } from '../i18n/errors.js'
import { isSupportedEmailLang } from '../lib/email.js'

export const userRoutes = Router()

// Apply auth middleware to all user routes
userRoutes.use(requireAuth)

/**
 * GET /api/users/profile
 * Get current user's profile
 */
userRoutes.get('/profile', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!

        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, name, first_name, company_name, job_title, industry, function, years_experience, company_size, review_frequency, org_goals_alignment, onboarding_completed, reminder_day, reminder_time, reminder_enabled, email_verified, created_at')
            .eq('id', userId)
            .single()

        if (error || !user) {
            logger.warn('Get profile failed: Profile not found')
            return res.status(404).json({ success: false, error: await getErrorMessage(req, 'profileNotFound') })
        }

        // preferred_language lives in user_profiles (per the i18n migration);
        // join it here so the client receives the full profile in one round-trip.
        const { data: profileRow } = await supabase
            .from('user_profiles')
            .select('preferred_language')
            .eq('id', userId)
            .maybeSingle()

        logger.info('Successfully fetched user profile')

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                firstName: user.first_name ?? null,
                companyName: user.company_name,
                jobTitle: user.job_title,
                industry: user.industry ?? null,
                function: user.function ?? null,
                yearsExperience: user.years_experience ?? null,
                companySize: user.company_size ?? null,
                reviewFrequency: user.review_frequency ?? null,
                orgGoalsAlignment: user.org_goals_alignment ?? false,
                onboardingCompleted: user.onboarding_completed ?? false,
                reminderDay: user.reminder_day,
                reminderTime: user.reminder_time,
                reminderEnabled: user.reminder_enabled,
                emailVerified: user.email_verified,
                preferredLanguage: profileRow?.preferred_language ?? null,
                createdAt: user.created_at,
            },
        })
    } catch (error) {
        logger.error('Get profile error: {}', error instanceof Error ? error.message : String(error), error)
        res.status(500).json({ success: false, error: getErrorMessageSync('internal') })
    }
})

/**
 * PUT /api/users/profile
 * Update user profile
 */
userRoutes.put('/profile', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!
        const body = req.body

        // Accept both camelCase (from API client) and snake_case
        const name = body.name
        const first_name = body.first_name ?? body.firstName
        const company_name = body.company_name ?? body.companyName
        const job_title = body.job_title ?? body.jobTitle
        const industry = body.industry
        const job_function = body.function ?? body.jobFunction
        const years_experience = body.years_experience ?? body.yearsExperience
        const company_size = body.company_size ?? body.companySize
        const review_frequency = body.review_frequency ?? body.reviewFrequency
        const org_goals_alignment = body.org_goals_alignment ?? body.orgGoalsAlignment
        const onboarding_completed = body.onboarding_completed ?? body.onboardingCompleted
        const reminder_day = body.reminder_day ?? body.reminderDay
        const reminder_time = body.reminder_time ?? body.reminderTime
        const reminder_enabled = body.reminder_enabled ?? body.reminderEnabled
        const preferred_language = body.preferred_language ?? body.preferredLanguage ?? null

        // Validate preferred_language against supported enum (null is allowed — means "auto")
        if (preferred_language !== null && preferred_language !== undefined && !isSupportedEmailLang(preferred_language)) {
            logger.with('preferred_language', preferred_language).warn('Update profile validation failed: unsupported language code')
            return res.status(400).json({ success: false, error: await getErrorMessage(req, 'failedToUpdateProfile'), detail: 'Unsupported preferred_language value' })
        }

        // Validate reminder_day if provided
        if (reminder_day !== undefined && (reminder_day < 0 || reminder_day > 6)) {
            logger.warn('Update profile validation failed: reminder_day must be 0-6')
            return res.status(400).json({ success: false, error: await getErrorMessage(req, 'reminderDayOutOfRange') })
        }

        const updateData: Record<string, any> = {}

        if (name !== undefined) updateData.name = name
        if (first_name !== undefined) updateData.first_name = first_name
        if (company_name !== undefined) updateData.company_name = company_name
        if (job_title !== undefined) updateData.job_title = job_title
        if (industry !== undefined) updateData.industry = industry
        if (job_function !== undefined) updateData.function = job_function
        if (years_experience !== undefined) updateData.years_experience = years_experience
        if (company_size !== undefined) updateData.company_size = company_size
        if (review_frequency !== undefined) updateData.review_frequency = review_frequency
        if (org_goals_alignment !== undefined) updateData.org_goals_alignment = org_goals_alignment
        if (onboarding_completed !== undefined) updateData.onboarding_completed = onboarding_completed
        if (reminder_day !== undefined) updateData.reminder_day = reminder_day
        if (reminder_time !== undefined) updateData.reminder_time = reminder_time
        if (reminder_enabled !== undefined) updateData.reminder_enabled = reminder_enabled

        if (preferred_language !== undefined) {
            // Upsert into user_profiles (the table that holds preferred_language).
            // `email` is NOT NULL UNIQUE on user_profiles, so it must be included
            // — otherwise the first upsert (no row exists) fails silently.
            // Look up the email from the users table since this row may not yet
            // exist in user_profiles.
            const { data: existingProfile } = await supabase
                .from('user_profiles')
                .select('email')
                .eq('id', userId)
                .maybeSingle()

            const { data: existingUser } = await supabase
                .from('users')
                .select('email')
                .eq('id', userId)
                .single()

            const profileEmail = existingProfile?.email || existingUser?.email
            if (!profileEmail) {
                logger.error('Cannot upsert user_profiles: no email on file for user')
                return res.status(500).json({ success: false, error: await getErrorMessage(req, 'failedToUpdateProfile'), detail: 'Missing user email' })
            }

            const { error: profileError } = await supabase
                .from('user_profiles')
                .upsert(
                    {
                        id: userId,
                        email: profileEmail,
                        preferred_language,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'id' }
                )

            if (profileError) {
                logger.error('Profile upsert error: {}', profileError.message, profileError)
                return res.status(500).json({ success: false, error: await getErrorMessage(req, 'failedToUpdateProfile'), detail: profileError.message })
            }
        }

        updateData.updated_at = new Date().toISOString()

        logger.with('updateData', updateData).info('Updating profile for user')

        const { data: user, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single()

        if (error) {
            logger.error('Profile update Supabase error: {}', error.message, error)
            return res.status(500).json({ success: false, error: await getErrorMessage(req, 'failedToUpdateProfile'), detail: error.message })
        }

        if (!user) {
            logger.error('No user returned after update')
            return res.status(500).json({ success: false, error: await getErrorMessage(req, 'noUpdate') })
        }

        captureEvent(userId, 'profile_updated', {
            updated_fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
        })

        logger.info('Successfully updated user profile')

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                firstName: user.first_name ?? null,
                companyName: user.company_name,
                jobTitle: user.job_title,
                industry: user.industry ?? null,
                function: user.function ?? null,
                yearsExperience: user.years_experience ?? null,
                companySize: user.company_size ?? null,
                reviewFrequency: user.review_frequency ?? null,
                orgGoalsAlignment: user.org_goals_alignment ?? false,
                onboardingCompleted: user.onboarding_completed ?? false,
                reminderDay: user.reminder_day,
                reminderTime: user.reminder_time,
                reminderEnabled: user.reminder_enabled,
                preferredLanguage: preferred_language,
            },
        })
    } catch (error) {
        logger.error('Update profile error: {}', error instanceof Error ? error.message : String(error), error)
        captureException(error)
        res.status(500).json({ success: false, error: getErrorMessageSync('internal') })
    }
})

/**
 * PUT /api/users/password
 * Change password
 */
userRoutes.put('/password', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!
        const { currentPassword, newPassword } = req.body

        if (!currentPassword || !newPassword) {
            logger.warn('Change password validation failed: Current password and new password required')
            return res.status(400).json({ success: false, error: await getErrorMessage(req, 'currentAndNewPasswordRequired') })
        }

        // Get current user's password hash
        const { data: user } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', userId)
            .single()

        if (!user) {
            logger.warn('Change password failed: User not found')
            return res.status(404).json({ success: false, error: await getErrorMessage(req, 'userNotFound') })
        }

        // Verify current password
        const isValid = await comparePassword(currentPassword, user.password_hash)
        if (!isValid) {
            logger.warn('Change password failed: Current password is incorrect')
            return res.status(401).json({ success: false, error: await getErrorMessage(req, 'currentPasswordIncorrect') })
        }

        // Validate new password
        const passwordValidation = validatePasswordStrength(newPassword)
        if (!passwordValidation.valid) {
            logger.warn('Change password failed: Password strength requirements not met')
            return res.status(400).json({ success: false, error: passwordValidation.errors.join(', ') })
        }

        // Hash and update password
        const passwordHash = await hashPassword(newPassword)

        const { error } = await supabase
            .from('users')
            .update({
                password_hash: passwordHash,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

        if (error) {
            logger.error('Password update error: {}', error.message, error)
            return res.status(500).json({ success: false, error: await getErrorMessage(req, 'failedToUpdatePassword') })
        }

        // Revoke all refresh tokens (user will need to log in again)
        await supabase
            .from('refresh_tokens')
            .update({
                revoked: true,
                revoked_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('revoked', false)

        logger.info('Password successfully updated')

        res.json({
            success: true,
            message: await getErrorMessage(req, 'passwordUpdated'),
        })
    } catch (error) {
        logger.error('Change password error: {}', error instanceof Error ? error.message : String(error), error)
        res.status(500).json({ success: false, error: getErrorMessageSync('internal') })
    }
})

/**
 * DELETE /api/users/account
 * Delete user account (with all their data)
 */
userRoutes.delete('/account', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!

        // Delete user (cascade will delete related data)
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId)

        if (error) {
            logger.error('Account deletion error: {}', error.message, error)
            return res.status(500).json({ success: false, error: await getErrorMessage(req, 'failedToDeleteAccount') })
        }

        captureEvent(userId, 'account_deleted')

        logger.info('Account deleted successfully')

        res.json({
            success: true,
            message: await getErrorMessage(req, 'accountDeleted'),
        })
    } catch (error) {
        logger.error('Delete account error: {}', error instanceof Error ? error.message : String(error), error)
        captureException(error)
        res.status(500).json({ success: false, error: getErrorMessageSync('internal') })
    }
})
