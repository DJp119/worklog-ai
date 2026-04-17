import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      await signIn(email)
      setMessage('Check your email for the login link!')
      // Redirect to home after successful login (auth state will update)
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send login link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-600">Worklog AI</h1>
          <h2 className="mt-2 text-xl text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-gray-600">
            Enter your email to receive a magic link
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          {message && (
            <div className="text-green-600 text-sm bg-green-50 p-3 rounded">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>

        {/* Info */}
        <div className="text-center text-sm text-gray-500">
          <p>No password needed. We'll email you a one-time login link.</p>
        </div>
      </div>
    </div>
  )
}
