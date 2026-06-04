import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, AuthError } from '../context/AuthContext'
import { usePageMeta } from '../hooks/usePageMeta'

export default function Login() {
    usePageMeta({
      title: 'Sign In',
      description:
        'Sign in to Impactly AI to log your weekly achievements and generate promotion-ready self-appraisals. Email or Google/GitHub OAuth. No credit card required.',
      path: '/login',
    })

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isLogin, setIsLogin] = useState(true)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
    const [resending, setResending] = useState(false)
    const [resendMessage, setResendMessage] = useState<string | null>(null)
    const [resendError, setResendError] = useState<string | null>(null)
    const [resendCooldown, setResendCooldown] = useState(0)

    const { login, signup, resendVerificationEmail } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (resendCooldown <= 0) return
        const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
        return () => clearTimeout(timer)
    }, [resendCooldown])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address')
            return
        }

        if (!password || password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        setLoading(true)
        setError(null)
        setMessage(null)
        setUnverifiedEmail(null)
        setResendMessage(null)
        setResendError(null)

        try {
            if (isLogin) {
                await login(email, password)
                setMessage('Login successful! Redirecting...')
                setTimeout(() => navigate('/dashboard'), 1500)
            } else {
                await signup(email, password, 'New User', 'Company', 'Developer')
                setMessage('Account created! Please login with your credentials.')
                setIsLogin(true)
            }
        } catch (err) {
            if (err instanceof AuthError && err.code === 'EMAIL_NOT_VERIFIED' && err.email) {
                setUnverifiedEmail(err.email)
                setError(null)
            } else {
                setError(err instanceof Error ? err.message : 'Operation failed')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        if (!unverifiedEmail || resending || resendCooldown > 0) return

        setResending(true)
        setResendError(null)
        setResendMessage(null)

        try {
            await resendVerificationEmail(unverifiedEmail)
            setResendMessage('Verification email sent! Check your inbox.')
            setResendCooldown(60)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to resend verification email'
            setResendError(message)
            if (message.toLowerCase().includes('wait')) {
                setResendCooldown(60)
            }
        } finally {
            setResending(false)
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
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold gradient-text">Worklog AI</h1>
                    <h2 className="mt-2 text-xl text-white">
                        {isLogin ? 'Sign in to your account' : 'Create a new account'}
                    </h2>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                            Email address
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                            Password
                        </label>
                        <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            Forgot password?
                        </Link>
                    </div>
                    <div>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="Enter your password"
                        />
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {unverifiedEmail && (
                        <div className="text-amber-200 text-sm bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg space-y-3">
                            <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.34 16a2 2 0 001.73 3z" />
                                </svg>
                                <div>
                                    <p className="font-medium text-amber-100">Email not verified</p>
                                    <p className="text-amber-200/80 mt-1">
                                        We sent a verification link to <span className="font-semibold">{unverifiedEmail}</span>. Please check your inbox to activate your account.
                                    </p>
                                </div>
                            </div>

                            {resendMessage && (
                                <div className="text-green-300 bg-green-500/10 border border-green-500/30 p-2 rounded">
                                    {resendMessage}
                                </div>
                            )}

                            {resendError && (
                                <div className="text-red-300 bg-red-500/10 border border-red-500/30 p-2 rounded">
                                    {resendError}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={resending || resendCooldown > 0}
                                className="w-full flex justify-center items-center py-2 px-4 rounded-lg text-sm font-medium text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {resending ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending...
                                    </span>
                                ) : resendCooldown > 0 ? (
                                    `Resend in ${resendCooldown}s`
                                ) : (
                                    'Resend Verification Email'
                                )}
                            </button>
                        </div>
                    )}

                    {message && (
                        <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                            {message}
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
                                Processing...
                            </span>
                        ) : (
                            isLogin ? 'Sign In' : 'Create Account'
                        )}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin)
                            setError(null)
                            setMessage(null)
                            setUnverifiedEmail(null)
                            setResendMessage(null)
                            setResendError(null)
                        }}
                        className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                </div>
            </div>
        </div>
    )
}
