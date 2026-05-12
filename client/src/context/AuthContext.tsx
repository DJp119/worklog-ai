import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import LogRocket from 'logrocket'

interface User {
  id: string
  email: string
  name?: string
  companyName?: string
  jobTitle?: string
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signup: (email: string, password: string, name?: string, companyName?: string, jobTitle?: string) => Promise<void>
  logout: () => Promise<void>
  verifyEmail: (userId: string, token: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAuthState()
  }, [])

  useEffect(() => {
    if (accessToken) {
      const interval = setInterval(handleRefreshToken, 14 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [accessToken])

  async function loadAuthState() {
    try {
      const savedAccessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const savedRefreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')

      if (savedAccessToken && savedRefreshToken) {
        setAccessToken(savedAccessToken)
        setRefreshToken(savedRefreshToken)

        try {
          const response = await fetch(`${API_URL}/api/users/profile`, {
            headers: { Authorization: `Bearer ${savedAccessToken}` },
          })

          if (response.ok) {
            const data = await response.json()
            setUser(data.data)
            LogRocket.identify(data.data.id, {
              email: data.data.email,
              name: data.data.name,
              jobTitle: data.data.jobTitle,
            })
          } else {
            clearAuth()
          }
        } catch (error) {
          console.error('Failed to verify token:', error)
          clearAuth()
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function login(email: string, password: string, rememberMe: boolean = false) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    const data = await response.json()
    const newAccessToken = data.data.accessToken
    const newRefreshToken = data.data.refreshToken

    setAccessToken(newAccessToken)
    setRefreshToken(newRefreshToken)
    setUser(data.data.user)

    LogRocket.identify(data.data.user.id, {
      email: data.data.user.email,
      name: data.data.user.name,
      jobTitle: data.data.user.jobTitle,
    })

    if (rememberMe) {
      localStorage.setItem('accessToken', newAccessToken)
      localStorage.setItem('refreshToken', newRefreshToken)
    } else {
      sessionStorage.setItem('accessToken', newAccessToken)
      sessionStorage.setItem('refreshToken', newRefreshToken)
    }
  }

  async function signup(email: string, password: string, name?: string, companyName?: string, jobTitle?: string) {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, company_name: companyName, job_title: jobTitle }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Signup failed')
    }

    return await response.json()
  }

  async function logout() {
    if (refreshToken) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
      } catch (error) {
        console.error('Logout API error:', error)
      }
    }
    clearAuth()
  }

  async function verifyEmail(userId: string, token: string) {
    const response = await fetch(`${API_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Verification failed')
    }
  }

  async function handleRefreshToken() {
    if (!refreshToken) return

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        clearAuth()
        return
      }

      const data = await response.json()
      const newAccessToken = data.data.accessToken
      const newRefreshToken = data.data.refreshToken

      setAccessToken(newAccessToken)
      setRefreshToken(newRefreshToken)

      if (localStorage.getItem('refreshToken')) {
        localStorage.setItem('accessToken', newAccessToken)
        localStorage.setItem('refreshToken', newRefreshToken)
      } else {
        sessionStorage.setItem('accessToken', newAccessToken)
        sessionStorage.setItem('refreshToken', newRefreshToken)
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      clearAuth()
    }
  }

  function clearAuth() {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('refreshToken')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        signup,
        logout,
        verifyEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
