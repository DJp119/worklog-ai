import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  const token = searchParams.get('token')
  const userId = searchParams.get('userId')

  useEffect(() => {
    if (!token || !userId) {
      setStatus('error')
      setMessage('Invalid reset link. Please request a new password reset.')
    }
  }, [token, userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!token || !userId) {
      setStatus('error')
      setMessage('Invalid reset link.')
      return
    }

    if (!newPassword || !confirmPassword) {
      setMessage('Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters')
      return
    }

    setIsSubmitting(true)
    setMessage('Resetting password...')

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus('success')
        setMessage('Password reset successfully!')
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to reset password')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Failed to reset password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show error if no token
  if (!token || !userId) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="glass-strong p-8 rounded-2xl border border-white/10 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Invalid Link</h2>
          <p className="text-gray-400 mb-6">{message}</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // Show success state
  if (status === 'success') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="glass-strong p-8 rounded-2xl border border-white/10 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Password Reset!</h2>
          <p className="text-gray-400 mb-6">Your password has been reset successfully.</p>
          <Link
            to="/login"
            className="inline-block bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // Show form
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="glass-strong p-8 rounded-2xl border border-white/10 max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white">Reset Password</h2>
          <p className="text-gray-400 mt-2">Enter your new password</p>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            status === 'error'
              ? 'text-red-400 bg-red-500/10 border border-red-500/20'
              : 'text-green-400 bg-green-500/10 border border-green-500/20'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
              New Password
            </label>
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-400">Show password</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !newPassword || !confirmPassword}
            className="w-full py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}