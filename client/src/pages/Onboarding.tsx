import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { updateProfile } from '../lib/api'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  INDUSTRY_OPTIONS,
  FUNCTION_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  REVIEW_FREQUENCY_OPTIONS,
} from '../lib/onboardingOptions'

interface Details {
  industry: string
  function: string
  yearsExperience: string
  companySize: string
  reviewFrequency: string
  orgGoalsAlignment: boolean
  companyName: string
}

const SELECT_CLASS =
  'mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all'

export default function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  usePageMeta({ title: t('onboarding.step1Title'), noIndex: true })

  const [step, setStep] = useState(1)
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [details, setDetails] = useState<Details>({
    industry: '',
    function: '',
    yearsExperience: '',
    companySize: '',
    reviewFrequency: '',
    orgGoalsAlignment: false,
    companyName: user?.companyName || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = <K extends keyof Details>(field: K, value: Details[K]) =>
    setDetails((prev) => ({ ...prev, [field]: value }))

  const goToStep2 = (e: FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) {
      setError(t('onboarding.firstNameRequired'))
      return
    }
    setError(null)
    setStep(2)
  }

  const detailsComplete =
    !!details.industry &&
    !!details.function &&
    !!details.yearsExperience &&
    !!details.companySize &&
    !!details.reviewFrequency

  const handleFinish = async (e: FormEvent) => {
    e.preventDefault()
    if (!detailsComplete) return
    setSaving(true)
    setError(null)
    try {
      await updateProfile({
        firstName: firstName.trim(),
        industry: details.industry,
        function: details.function,
        yearsExperience: details.yearsExperience,
        companySize: details.companySize,
        reviewFrequency: details.reviewFrequency,
        orgGoalsAlignment: details.orgGoalsAlignment,
        companyName: details.companyName.trim() || undefined,
        onboardingCompleted: true,
      })
      await refreshProfile()
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('onboarding.error'))
      setSaving(false)
    }
  }

  // Skip marks onboarding as "seen" so the user isn't forced back into the
  // wizard, but leaves the personalization fields empty so the dashboard
  // banner can nudge completion.
  const handleSkip = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateProfile({
        firstName: firstName.trim() || undefined,
        onboardingCompleted: true,
      })
      await refreshProfile()
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('onboarding.error'))
      setSaving(false)
    }
  }

  return (
    <div className="bg-futuristic min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-lg w-full glass-strong p-8 rounded-2xl border border-white/10 relative z-10 glow-primary">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          <span className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-indigo-500' : 'bg-white/10'}`}></span>
          <span className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-indigo-500' : 'bg-white/10'}`}></span>
        </div>

        {step === 1 ? (
          <form onSubmit={goToStep2} className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold gradient-text">{t('onboarding.step1Title')}</h1>
            </div>
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-300">
                {t('onboarding.firstNameLabel')}
              </label>
              <input
                id="firstName"
                type="text"
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('onboarding.firstNamePlaceholder')}
                className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 transition-all glow-primary"
            >
              {t('onboarding.continue')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleFinish} className="space-y-5">
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">
                {t('onboarding.step2Header', { name: firstName.trim() })}
              </h1>
            </div>

            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-300">
                {t('onboarding.industryLabel')}
              </label>
              <select id="industry" value={details.industry} onChange={(e) => setField('industry', e.target.value)} className={SELECT_CLASS}>
                <option value="" className="bg-[#0a0a0f]">{t('onboarding.selectPlaceholder')}</option>
                {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="function" className="block text-sm font-medium text-gray-300">
                {t('onboarding.functionLabel')}
              </label>
              <select id="function" value={details.function} onChange={(e) => setField('function', e.target.value)} className={SELECT_CLASS}>
                <option value="" className="bg-[#0a0a0f]">{t('onboarding.selectPlaceholder')}</option>
                {FUNCTION_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="yearsExperience" className="block text-sm font-medium text-gray-300">
                  {t('onboarding.yearsLabel')}
                </label>
                <select id="yearsExperience" value={details.yearsExperience} onChange={(e) => setField('yearsExperience', e.target.value)} className={SELECT_CLASS}>
                  <option value="" className="bg-[#0a0a0f]">{t('onboarding.selectPlaceholder')}</option>
                  {YEARS_EXPERIENCE_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="companySize" className="block text-sm font-medium text-gray-300">
                  {t('onboarding.companySizeLabel')}
                </label>
                <select id="companySize" value={details.companySize} onChange={(e) => setField('companySize', e.target.value)} className={SELECT_CLASS}>
                  <option value="" className="bg-[#0a0a0f]">{t('onboarding.selectPlaceholder')}</option>
                  {COMPANY_SIZE_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="reviewFrequency" className="block text-sm font-medium text-gray-300">
                {t('onboarding.reviewFrequencyLabel')}
              </label>
              <select id="reviewFrequency" value={details.reviewFrequency} onChange={(e) => setField('reviewFrequency', e.target.value)} className={SELECT_CLASS}>
                <option value="" className="bg-[#0a0a0f]">{t('onboarding.selectPlaceholder')}</option>
                {REVIEW_FREQUENCY_OPTIONS.map((o) => <option key={o} value={o} className="bg-[#0a0a0f]">{o}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-300">
                {t('onboarding.companyNameLabel')}
              </label>
              <input
                id="companyName"
                type="text"
                value={details.companyName}
                onChange={(e) => setField('companyName', e.target.value)}
                placeholder={t('onboarding.companyNamePlaceholder')}
                className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Org goals alignment toggle */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <div>
                <p className="text-sm font-medium text-gray-200">{t('onboarding.orgGoalsLabel')}</p>
                <p className="text-xs text-gray-500 mt-1">{t('onboarding.orgGoalsHelp')}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={details.orgGoalsAlignment}
                onClick={() => setField('orgGoalsAlignment', !details.orgGoalsAlignment)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${details.orgGoalsAlignment ? 'bg-indigo-500' : 'bg-white/10'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${details.orgGoalsAlignment ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={saving}
                className="px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
              >
                {t('onboarding.back')}
              </button>
              <button
                type="submit"
                disabled={saving || !detailsComplete}
                className="flex-1 flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-primary"
              >
                {saving ? t('onboarding.saving') : t('onboarding.finish')}
              </button>
            </div>
          </form>
        )}

        {/* Unobtrusive skip */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            {t('onboarding.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
