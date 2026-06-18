import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import { useAutoLocale } from './i18n/useAutoLocale'
import LandingPage from './components/LandingPage'

const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const LogEntry = lazy(() => import('./pages/LogEntry'))
const Appraisal = lazy(() => import('./pages/Appraisal'))
const Chat = lazy(() => import('./pages/Chat'))
const Settings = lazy(() => import('./pages/Settings'))
const Feedback = lazy(() => import('./pages/Feedback'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const AIPulseHub = lazy(() => import('./pages/ai-pulse/Hub').then(m => ({ default: m.AIPulseHub })))
const Goals = lazy(() => import('./pages/Goals'))
const TeamGoals = lazy(() => import('./pages/TeamGoals'))
const OrgSettings = lazy(() => import('./pages/OrgSettings'))
const Integrations = lazy(() => import('./pages/Integrations'))

function ProtectedRoute({
  children,
  requireOnboarding = true,
}: {
  children: React.ReactNode
  requireOnboarding?: boolean
}) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-gray-600">{t('common.loading')}</div>
        </div>
      </Layout>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // First-run gate: force unfinished users into the onboarding flow once.
  // Only redirects on an explicit `false` so partially-hydrated user objects
  // (field absent) don't bounce the user mid-load.
  if (requireOnboarding && user.onboardingCompleted === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Layout>{children}</Layout>
}

// Onboarding renders full-screen (no Layout chrome) but still requires auth.
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="bg-futuristic min-h-screen flex items-center justify-center">
        <div className="text-gray-400">{t('common.loading')}</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  useAutoLocale()
  const { t } = useTranslation()
  return (
    <Suspense fallback={<Layout><div className="flex items-center justify-center min-h-[60vh]"><div className="text-gray-600">{t('common.loading')}</div></div></Layout>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
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
        <Route
          path="/feedback"
          element={
            <ProtectedRoute>
              <Feedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/goals"
          element={
            <ProtectedRoute>
              <Goals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team-goals"
          element={
            <ProtectedRoute>
              <TeamGoals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/org-settings"
          element={
            <ProtectedRoute>
              <OrgSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/integrations"
          element={
            <ProtectedRoute>
              <Integrations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <Onboarding />
            </OnboardingRoute>
          }
        />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/terms" element={<Layout><Terms /></Layout>} />
        <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
        <Route path="/ai-pulse" element={<Layout><AIPulseHub /></Layout>} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
