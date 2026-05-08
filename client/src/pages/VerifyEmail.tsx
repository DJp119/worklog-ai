import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email...')

  const token = searchParams.get('token')
  const userId = searchParams.get('userId')

  useEffect(() => {
    async function verifyEmail() {
      if (!token || !userId) {
        setStatus('error')
        setMessage('Invalid verification link. Please try again.')
        return
      }

      try {
        // Call your backend to verify the email token
        const response = await fetch('https://worklog-ai-7qh6.onrender.com/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            token,
          }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setStatus('success')
          setMessage('Email verified successfully! You can now log in.')
        } else {
          setStatus('error')
          setMessage(data.error || 'Failed to verify email. The link may have expired.')
        }
      } catch (error) {
        console.error('Email verification error:', error)
        setStatus('error')
        setMessage('Failed to verify email. Please try again or contact support.')
      }
    }

    verifyEmail()
  }, [token, userId])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{message}</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <a
            href="/login"
            className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <a
          href="/login"
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Go to Login
        </a>
      </div>
    </div>
  )
}
