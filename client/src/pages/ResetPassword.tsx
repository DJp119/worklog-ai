import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    console.log('=== FORM SUBMITTED ===')
    console.log('Token:', token)
    console.log('User ID:', userId)

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
      const response = await fetch('http://localhost:3001/api/auth/reset-password', {
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
      console.log('Response:', data)

      if (response.ok && data.success) {
        setStatus('success')
        setMessage('Password reset successfully!')
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to reset password')
      }
    } catch (error) {
      console.error('Password reset error:', error)
      setStatus('error')
      setMessage('Failed to reset password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show error if no token
  if (!token || !userId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>Invalid Link</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>{message}</p>
          <button
            onClick={() => navigate('/login')}
            style={{ backgroundColor: '#4f46e5', color: 'white', padding: '8px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>Password Reset!</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>Your password has been reset successfully.</p>
          <button
            onClick={() => navigate('/login')}
            style={{ backgroundColor: '#4f46e5', color: 'white', padding: '8px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // Show form
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '28rem', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Reset Password</h2>
          <p style={{ color: '#6b7280', marginTop: '8px' }}>Enter your new password</p>
        </div>

        {message && (
          <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '6px', backgroundColor: status === 'error' ? '#fee2e2' : '#dbeafe', color: status === 'error' ? '#991b1b' : '#1e40af' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="newPassword" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              New Password
            </label>
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Show password</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              backgroundColor: isSubmitting ? '#9ca3af' : '#4f46e5',
              color: 'white',
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: (newPassword && confirmPassword) ? 1 : 0.5
            }}
          >
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
