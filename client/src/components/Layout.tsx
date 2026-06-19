import { ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useHasOrg } from '../hooks/useHasOrg'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const hasOrg = useHasOrg()

  const handleSignOut = async () => {
    try {
      await logout()
      navigate('/')
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative flex items-center">
                  <svg className="h-8 w-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h1 className="ml-2 text-xl font-bold gradient-text">{t('brand.name')}</h1>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    to="/log"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {t('nav.logWork')}
                  </Link>
                  <Link
                    to="/appraisals"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {t('nav.appraisals')}
                  </Link>
                  <Link
                    to="/goals"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {t('nav.goals')}
                  </Link>
                  <Link
                    to="/team-goals"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {t('nav.teamGoals')}
                  </Link>
                  {hasOrg && (
                    <Link
                      to="/integrations"
                      className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                    >
                      {t('nav.integrations')}
                    </Link>
                  )}
                  <Link
                    to="/chat"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 flex items-center gap-1"
                  >
                    {t('nav.aiChat')}
                  </Link>
                  <Link
                    to="/ai-pulse"
                    className="text-indigo-300 hover:text-indigo-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-indigo-500/10 flex items-center gap-1 relative"
                  >
                    {t('nav.aiPulse')}
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                  </Link>
                  <Link
                    to="/settings"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {t('nav.settings')}
                  </Link>
                  <Link
                    to="/feedback"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {t('nav.feedback')}
                  </Link>
                  <div className="w-px h-6 bg-white/10 mx-2"></div>
                  <span className="text-gray-400 text-sm mr-3">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {t('nav.signOut')}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-4">
                  <Link
                    to="/ai-pulse"
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 flex items-center gap-1.5 relative"
                  >
                    {t('nav.aiPulse')}
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  </Link>
                  <LanguageSwitcher />
                  <Link
                    to="/login"
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 transition-all glow-primary"
                  >
                    {t('nav.signIn')}
                  </Link>
                </div>
              )}
            </nav>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-300 hover:text-white focus:outline-none p-2 rounded-md hover:bg-white/5"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden glass-strong border-t border-white/5">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                  >
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    to="/log"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                  >
                    {t('nav.logWork')}
                  </Link>
                  <Link
                    to="/appraisals"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                  >
                    {t('nav.appraisals')}
                  </Link>
                  <Link
                    to="/chat"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                  >
                    {t('nav.aiChat')}
                  </Link>
                  <Link
                    to="/ai-pulse"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10 flex items-center gap-2"
                  >
                    {t('nav.aiPulse')}
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                  >
                    {t('nav.settings')}
                  </Link>
                  <Link
                    to="/feedback"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                  >
                    {t('nav.feedback')}
                  </Link>
                  <div className="border-t border-white/10 mt-4 pt-4 pb-1">
                    <div className="px-3 mb-2 text-sm text-gray-400 truncate">
                      {user.email}
                    </div>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        handleSignOut()
                      }}
                      className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5"
                    >
                      {t('nav.signOut')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/ai-pulse"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                  >
                    {t('nav.aiPulse')}
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-indigo-400 hover:text-indigo-300 hover:bg-white/5"
                  >
                    {t('nav.signIn')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="glass-strong border-t border-white/5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center mb-4">
                <svg className="h-6 w-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h3 className="ml-2 text-lg font-bold gradient-text">{t('brand.name')}</h3>
              </div>
              <p className="text-gray-400 text-sm">
                {t('footer.tagline')}
              </p>
            </div>

            {/* Links */}
            <div className="flex justify-center space-x-6">
              <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
                {t('nav.dashboard')}
              </Link>
              <Link to="/log" className="text-gray-400 hover:text-white text-sm transition-colors">
                {t('nav.logWork')}
              </Link>
              <Link to="/appraisals" className="text-gray-400 hover:text-white text-sm transition-colors">
                {t('nav.appraisals')}
              </Link>
              <Link to="/chat" className="text-gray-400 hover:text-white text-sm transition-colors">
                {t('nav.aiChat')}
              </Link>
              <Link to="/ai-pulse" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors font-medium">
                {t('nav.aiPulse')}
              </Link>
              <Link to="/feedback" className="text-gray-400 hover:text-white text-sm transition-colors">
                {t('nav.feedback')}
              </Link>
            </div>

            {/* Legal */}
            <div className="text-right flex flex-col items-end space-y-2">
              <p className="text-gray-500 text-sm">
                {t('footer.copyright', { year: new Date().getFullYear() })}
              </p>
              <div className="flex space-x-4">
                <Link to="/terms" className="text-gray-400 hover:text-white text-xs transition-colors">
                  {t('footer.terms')}
                </Link>
                <Link to="/privacy" className="text-gray-400 hover:text-white text-xs transition-colors">
                  {t('footer.privacy')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
