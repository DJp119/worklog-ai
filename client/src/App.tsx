import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LogEntry from './pages/LogEntry'
import Appraisal from './pages/Appraisal'
import Settings from './pages/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-gray-600">Loading...</div>
        </div>
      </Layout>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  // Redirect logged-in users to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="text-center py-16">
      <h1 className="text-4xl font-bold text-indigo-600 mb-4">
        Welcome to Worklog AI
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Track your work weekly. Generate self-appraisals in seconds.
      </p>
      <div className="space-x-4">
        <Link
          to="/login"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Sign In
        </Link>
      </div>

      {/* Features */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="text-3xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Weekly Logging
          </h3>
          <p className="text-gray-600">
            Spend 5 minutes each week logging your accomplishments, challenges, and learnings.
          </p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="text-3xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            AI-Powered
          </h3>
          <p className="text-gray-600">
            Generate polished self-appraisals that map your work to company criteria.
          </p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="text-3xl mb-4">📧</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Email Reminders
          </h3>
          <p className="text-gray-600">
            Never forget to log your week with automated Monday morning reminders.
          </p>
        </div>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/log"
        element={
          <ProtectedRoute>
            <LogEntry />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appraisals"
        element={
          <ProtectedRoute>
            <Appraisal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
