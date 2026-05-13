import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 glass-strong p-8 rounded-2xl border border-white/10 relative z-10 glow-primary">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center glow-primary">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text">Reset Password</h1>
          <p className="mt-2 text-gray-400">
            {submitted
              ? 'Check your inbox'
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        {submitted ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                If an account exists for <span className="text-white font-medium">{email}</span>,
                you'll receive a password reset link shortly.
              </p>
              <p className="text-gray-500 text-xs mt-3">
                Didn't receive the email? Check your spam folder or try again.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => { setSubmitted(false); setEmail('') }}
                className="w-full py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all glow-primary"
              >
                Try another email
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 px-4 rounded-lg text-sm font-medium text-indigo-400 hover:text-indigo-300 bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-300">
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-primary"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
