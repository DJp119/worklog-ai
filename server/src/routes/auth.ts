import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

export const authRoutes = Router()

/**
 * POST /api/auth/login
 * Send magic link to user's email
 */
authRoutes.post('/login', async (req, res) => {
  try {
    const { email } = req.body

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
    })

    if (error) {
      console.error('Supabase auth error:', error)
      return res.status(500).json({ error: 'Failed to send login link' })
    }

    res.json({
      success: true,
      message: 'Login link sent to your email'
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/auth/logout
 * Sign out current user
 */
authRoutes.post('/logout', async (req, res) => {
  try {
    const { access_token } = req.body

    if (access_token) {
      await supabase.auth.setSession({
        access_token: access_token,
        refresh_token: '',
      })
    }

    await supabase.auth.signOut()

    res.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Failed to logout' })
  }
})
