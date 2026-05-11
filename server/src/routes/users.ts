import { Router, Request, Response } from 'express'
import { supabase } from '../lib/database.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { hashPassword, comparePassword, validatePasswordStrength } from '../lib/auth-utils.js'

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
            .select('id, email, name, company_name, job_title, reminder_day, reminder_time, reminder_enabled, email_verified, created_at')
            .eq('id', userId)
            .single()

        if (error || !user) {
            return res.status(404).json({ success: false, error: 'Profile not found' })
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                companyName: user.company_name,
                jobTitle: user.job_title,
                reminderDay: user.reminder_day,
                reminderTime: user.reminder_time,
                reminderEnabled: user.reminder_enabled,
                emailVerified: user.email_verified,
                createdAt: user.created_at,
            },
        })
    } catch (error) {
        console.error('Get profile error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
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
        const company_name = body.company_name ?? body.companyName
        const job_title = body.job_title ?? body.jobTitle
        const reminder_day = body.reminder_day ?? body.reminderDay
        const reminder_time = body.reminder_time ?? body.reminderTime
        const reminder_enabled = body.reminder_enabled ?? body.reminderEnabled

        // Validate reminder_day if provided
        if (reminder_day !== undefined && (reminder_day < 0 || reminder_day > 6)) {
            return res.status(400).json({ success: false, error: 'reminder_day must be 0-6 (Sunday-Saturday)' })
        }

        const updateData: Record<string, any> = {}

        if (name !== undefined) updateData.name = name
        if (company_name !== undefined) updateData.company_name = company_name
        if (job_title !== undefined) updateData.job_title = job_title
        if (reminder_day !== undefined) updateData.reminder_day = reminder_day
        if (reminder_time !== undefined) updateData.reminder_time = reminder_time
        if (reminder_enabled !== undefined) updateData.reminder_enabled = reminder_enabled

        updateData.updated_at = new Date().toISOString()

        console.log('[Profile Update] userId:', userId, 'updateData:', JSON.stringify(updateData))

        const { data: user, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single()

        if (error) {
            console.error('[Profile Update] Supabase error:', JSON.stringify(error))
            return res.status(500).json({ success: false, error: 'Failed to update profile', detail: error.message })
        }

        if (!user) {
            console.error('[Profile Update] No user returned after update for userId:', userId)
            return res.status(500).json({ success: false, error: 'Update matched no rows' })
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                companyName: user.company_name,
                jobTitle: user.job_title,
                reminderDay: user.reminder_day,
                reminderTime: user.reminder_time,
                reminderEnabled: user.reminder_enabled,
            },
        })
    } catch (error) {
        console.error('Update profile error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
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
            return res.status(400).json({ success: false, error: 'Current password and new password required' })
        }

        // Get current user's password hash
        const { data: user } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', userId)
            .single()

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' })
        }

        // Verify current password
        const isValid = await comparePassword(currentPassword, user.password_hash)
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' })
        }

        // Validate new password
        const passwordValidation = validatePasswordStrength(newPassword)
        if (!passwordValidation.valid) {
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
            console.error('Password update error:', error)
            return res.status(500).json({ success: false, error: 'Failed to update password' })
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

        res.json({
            success: true,
            message: 'Password updated successfully. Please log in again.',
        })
    } catch (error) {
        console.error('Change password error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
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
            console.error('Account deletion error:', error)
            return res.status(500).json({ success: false, error: 'Failed to delete account' })
        }

        res.json({
            success: true,
            message: 'Account deleted successfully',
        })
    } catch (error) {
        console.error('Delete account error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
})
