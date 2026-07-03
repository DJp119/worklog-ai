import { useState, useEffect, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateProfile } from '../lib/api'
import { usePageMeta } from '../hooks/usePageMeta'
import { supportedLanguages } from '../i18n/useAutoLocale'
import { getLocalizedDayNames, formatHourOption } from '../lib/formatters'
import {
  INDUSTRY_OPTIONS,
  FUNCTION_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  REVIEW_FREQUENCY_OPTIONS,
} from '../lib/onboardingOptions'

interface Profile {
  company_name: string
  job_title: string
  industry: string
  function: string
  years_experience: string
  company_size: string
  review_frequency: string
  org_goals_alignment: boolean
  reminder_day: number
  reminder_hour: number
  reminder_enabled: boolean
  preferred_language: string
}

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * Convert a local hour (0-23) to UTC hour (0-23)
 */
function localHourToUtc(localHour: number): string {
  const now = new Date()
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(), localHour, 0, 0)
  const utcHour = local.getUTCHours()
  return `${utcHour.toString().padStart(2, '0')}:00`
}

/**
 * Convert a UTC time string "HH:00" to local hour (0-23)
 */
function utcTimeToLocalHour(utcTime: string): number {
  const utcHour = parseInt(utcTime?.split(':')[0] || '9', 10)
  const now = new Date()
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), utcHour, 0, 0))
  return utcDate.getHours()
}

export default function Settings() {
  usePageMeta({ title: 'Settings', noIndex: true })
  const { t, i18n } = useTranslation()
  const { user, logout, accessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile>({
    company_name: '',
    job_title: '',
    industry: '',
    function: '',
    years_experience: '',
    company_size: '',
    review_frequency: '',
    org_goals_alignment: false,
    reminder_day: 1,
    reminder_hour: 9,
    reminder_enabled: true,
    preferred_language: 'auto',
  })

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  async function loadProfile() {
    if (!user) return

    try {
      setInitialLoading(true)
      const data = await getProfile()

      setProfile({
        company_name: data.companyName || '',
        job_title: data.jobTitle || '',
        industry: data.industry || '',
        function: data.function || '',
        years_experience: data.yearsExperience || '',
        company_size: data.companySize || '',
        review_frequency: data.reviewFrequency || '',
        org_goals_alignment: data.orgGoalsAlignment ?? false,
        reminder_day: data.reminderDay ?? 1,
        reminder_hour: utcTimeToLocalHour(data.reminderTime || '09:00'),
        reminder_enabled: data.reminderEnabled ?? true,
        preferred_language: data.preferredLanguage || 'auto',
      })
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setInitialLoading(false)
    }
  }

  const handleChange = (field: keyof Profile, value: string | number | boolean) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const [languageSaving, setLanguageSaving] = useState(false)
  const [languageError, setLanguageError] = useState<string | null>(null)

  const handleLanguageChange = async (value: string) => {
    setProfile((prev) => ({ ...prev, preferred_language: value }))
    // Apply to UI immediately so the user sees the change without waiting
    // for the network round-trip.
    if (value === 'auto') {
      localStorage.removeItem('impactly_language')
      const detected = (navigator.language || 'en').split('-')[0]
      void i18n.changeLanguage(detected)
    } else {
      localStorage.setItem('impactly_language', value)
      void i18n.changeLanguage(value)
    }

    // Persist explicit user choice to localStorage. The global i18n
    // languageChanged listener used to do this for us; now that the
    // listener is a no-op for persistence, the switcher is solely
    // responsible for honoring the user's pick across reloads.
    try {
      if (value === 'auto') {
        localStorage.removeItem('impactly_language')
      } else {
        localStorage.setItem('impactly_language', value)
      }
    } catch {
      /* ignore */
    }

    if (!user) return

    // Persist to the server immediately — language preference is a one-tap
    // setting, not a "Save Profile" form submission.
    setLanguageSaving(true)
    setLanguageError(null)
    try {
      await updateProfile({
        preferredLanguage: value === 'auto' ? null : value,
      })
      setMessage(t('settings.savedSuccess'))
    } catch (err) {
      setLanguageError(err instanceof Error ? err.message : t('settings.errorSaveFailed'))
    } finally {
      setLanguageSaving(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!user) {
      setError(t('settings.errorMustBeLoggedIn'))
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      await updateProfile({
        companyName: profile.company_name,
        jobTitle: profile.job_title,
        industry: profile.industry || null,
        function: profile.function || null,
        yearsExperience: profile.years_experience || null,
        companySize: profile.company_size || null,
        reviewFrequency: profile.review_frequency || null,
        orgGoalsAlignment: profile.org_goals_alignment,
        reminderDay: profile.reminder_day,
        reminderTime: localHourToUtc(profile.reminder_hour),
        reminderEnabled: profile.reminder_enabled,
        preferredLanguage: profile.preferred_language === 'auto' ? null : profile.preferred_language,
      })

      setMessage(t('settings.savedSuccess'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.errorSaveFailed'))
    } finally {
      setLoading(false)
    }
  }

  const dayOptions = getLocalizedDayNames()

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: formatHourOption(i),
  }))

  const handlePasswordChange = (field: keyof PasswordForm, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }))
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError(t('settings.errorFillAllPasswordFields'))
      setPasswordLoading(false)
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(t('settings.errorPasswordsDontMatch'))
      setPasswordLoading(false)
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setError(t('settings.errorPasswordTooShort'))
      setPasswordLoading(false)
      return
    }

    setPasswordLoading(true)
    setMessage(null)
    setError(null)

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${API_URL}/api/users/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage(t('settings.passwordChanged'))
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => logout(), 3000)
      } else {
        setError(data.error || t('settings.errorChangePasswordFailed'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.errorChangePasswordFailed'))
    } finally {
      setPasswordLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mr-3 glow-primary">
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
          <p className="text-gray-400 text-sm">{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* Language & Region */}
      <div className="glass-strong rounded-xl p-6 border border-white/10">
        <div className="flex items-center mb-4">
          <svg className="w-5 h-5 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          <h2 className="text-lg font-semibold text-white">{t('settings.language')}</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">{t('settings.languageHelp')}</p>
        <div>
          <label htmlFor="preferred_language" className="block text-sm font-medium text-gray-300 mb-1">
            {t('settings.languageLabel')}
          </label>
          <select
            id="preferred_language"
            value={profile.preferred_language}
            onChange={(e) => void handleLanguageChange(e.target.value)}
            disabled={languageSaving}
            className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-60"
          >
            {supportedLanguages().map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#0a0a0f]">
                {lang.code === 'auto'
                  ? t('settings.languageAuto')
                  : `${lang.name} — ${lang.englishName}`}
              </option>
            ))}
          </select>
          {languageSaving && (
            <p className="mt-2 text-xs text-gray-500">{t('common.saving')}</p>
          )}
          {languageError && (
            <p className="mt-2 text-xs text-red-400">{languageError}</p>
          )}
        </div>
      </div>

      {/* Profile Settings */}
      <div className="glass-strong rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">{t('settings.profile')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              {t('settings.email')}
            </label>
            <input
              type="email"
              id="email"
              value={user?.email || ''}
              disabled
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">{t('settings.emailReadonly')}</p>
          </div>

          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-300">
              {t('settings.companyName')}
            </label>
            <input
              type="text"
              id="company_name"
              value={profile.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('settings.companyNamePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="job_title" className="block text-sm font-medium text-gray-300">
              {t('settings.jobTitle')}
            </label>
            <input
              type="text"
              id="job_title"
              value={profile.job_title}
              onChange={(e) => handleChange('job_title', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('settings.jobTitlePlaceholder')}
            />
          </div>

          <div className="pt-4">
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
                  {t('common.saving')}
                </span>
              ) : (
                t('settings.saveProfile')
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Personalization Settings */}
      <div className="glass-strong rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-1">{t('settings.personalization')}</h2>
        <p className="text-sm text-gray-400 mb-4">{t('settings.personalizationHelp')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-gray-300">
              {t('settings.industryLabel')}
            </label>
            <select
              id="industry"
              value={profile.industry}
              onChange={(e) => handleChange('industry', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="" className="bg-[#0a0a0f]">{t('settings.notSet')}</option>
              {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="function" className="block text-sm font-medium text-gray-300">
              {t('settings.functionLabel')}
            </label>
            <select
              id="function"
              value={profile.function}
              onChange={(e) => handleChange('function', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="" className="bg-[#0a0a0f]">{t('settings.notSet')}</option>
              {FUNCTION_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="years_experience" className="block text-sm font-medium text-gray-300">
                {t('settings.yearsLabel')}
              </label>
              <select
                id="years_experience"
                value={profile.years_experience}
                onChange={(e) => handleChange('years_experience', e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="" className="bg-[#0a0a0f]">{t('settings.notSet')}</option>
                {YEARS_EXPERIENCE_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="company_size" className="block text-sm font-medium text-gray-300">
                {t('settings.companySizeLabel')}
              </label>
              <select
                id="company_size"
                value={profile.company_size}
                onChange={(e) => handleChange('company_size', e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="" className="bg-[#0a0a0f]">{t('settings.notSet')}</option>
                {COMPANY_SIZE_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="review_frequency" className="block text-sm font-medium text-gray-300">
              {t('settings.reviewFrequencyLabel')}
            </label>
            <select
              id="review_frequency"
              value={profile.review_frequency}
              onChange={(e) => handleChange('review_frequency', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="" className="bg-[#0a0a0f]">{t('settings.notSet')}</option>
              {REVIEW_FREQUENCY_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
            </select>
          </div>

          {/* Org goals alignment toggle */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <div>
              <p className="text-sm font-medium text-gray-200">{t('settings.orgGoalsLabel')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('settings.orgGoalsHelp')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profile.org_goals_alignment}
              onClick={() => handleChange('org_goals_alignment', !profile.org_goals_alignment)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${profile.org_goals_alignment ? 'bg-indigo-500' : 'bg-white/10'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${profile.org_goals_alignment ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-primary"
            >
              {loading ? t('common.saving') : t('settings.savePreferences')}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Section */}
      <div className="glass-strong rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">{t('settings.changePassword')}</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300">
              {t('settings.currentPassword')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="currentPassword"
              value={passwordForm.currentPassword}
              onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('settings.currentPasswordPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300">
              {t('settings.newPassword')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="newPassword"
              value={passwordForm.newPassword}
              onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('settings.newPasswordPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
              {t('settings.confirmPassword')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('settings.confirmPasswordPlaceholder')}
            />
          </div>

          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-400">{t('settings.showPasswords')}</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-primary"
          >
            {passwordLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('settings.changing')}
              </span>
            ) : (
              t('settings.changePassword')
            )}
          </button>
          {message && (
            <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
              {message}
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
              {error}
            </div>
          )}
        </form>
      </div>

      {/* Reminder Settings */}
      <div className="glass-strong rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">{t('settings.reminders')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={profile.reminder_enabled}
                onChange={(e) => handleChange('reminder_enabled', e.target.checked)}
                className="h-5 w-5 rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
              />
              <span className="ml-3 text-sm font-medium text-gray-300">
                {t('settings.enableReminders')}
              </span>
            </label>
            <p className="mt-2 text-xs text-gray-500 ml-8">{t('settings.reminderDesc')}</p>
          </div>

          {profile.reminder_enabled && (
            <>
              <div>
                <label htmlFor="reminder_day" className="block text-sm font-medium text-gray-300">
                  {t('settings.reminderDay')}
                </label>
                <select
                  id="reminder_day"
                  value={profile.reminder_day}
                  onChange={(e) => handleChange('reminder_day', parseInt(e.target.value))}
                  className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  {dayOptions.map((day) => (
                    <option key={day.value} value={day.value} className="bg-[#0a0a0f]">
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reminder_hour" className="block text-sm font-medium text-gray-300">
                  {t('settings.reminderTime')}
                </label>
                <select
                  id="reminder_hour"
                  value={profile.reminder_hour}
                  onChange={(e) => handleChange('reminder_hour', parseInt(e.target.value))}
                  className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  {hourOptions.map((hour) => (
                    <option key={hour.value} value={hour.value} className="bg-[#0a0a0f]">
                      {hour.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{t('settings.localTimezone')}</p>
              </div>
            </>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-primary"
            >
              {loading ? t('common.saving') : t('settings.savePreferences')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
