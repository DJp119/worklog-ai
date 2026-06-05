import { useState, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { generateAppraisal, getAppraisalHistory } from '../lib/api'
import type { GeneratedAppraisal } from 'shared'
import { usePageMeta } from '../hooks/usePageMeta'

interface AppraisalForm {
  period_start: string
  period_end: string
  criteria_text: string
  company_goals: string
  values: string
}

export default function Appraisal() {
  const { t } = useTranslation()
  usePageMeta({ title: t('appraisal.title'), noIndex: true })
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedAppraisal | null>(null)
  const [history, setHistory] = useState<GeneratedAppraisal[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const [form, setForm] = useState<AppraisalForm>({
    period_start: '',
    period_end: '',
    criteria_text: '',
    company_goals: '',
    values: '',
  })

  const handleChange = (field: keyof AppraisalForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!form.period_start || !form.period_end || !form.criteria_text) {
      setError(t('appraisal.requiredFields'))
      return
    }

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const appraisal = await generateAppraisal({
        period_start: form.period_start,
        period_end: form.period_end,
        criteria_text: form.criteria_text,
        company_goals: form.company_goals || undefined,
        values: form.values || undefined,
      })

      setResult(appraisal)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('appraisal.errorGenerate'))
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyToClipboard = () => {
    if (result?.generated_text) {
      navigator.clipboard.writeText(result.generated_text)
      alert(t('appraisal.copied'))
    }
  }

  const loadHistory = async () => {
    setLoading(true)
    try {
      const appraisals = await getAppraisalHistory()
      setHistory(appraisals)
      setShowHistory(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-3 glow-accent">
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('appraisal.title')}</h1>
          <p className="text-gray-400 text-sm">{t('appraisal.subtitle')}</p>
        </div>
      </div>

      {/* Generate Appraisal Form */}
      <div className="glass-strong rounded-2xl p-8 border border-white/10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="period_start" className="block text-sm font-medium text-gray-300">
                {t('appraisal.periodStart')} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                id="period_start"
                value={form.period_start}
                onChange={(e) => handleChange('period_start', e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div>
              <label htmlFor="period_end" className="block text-sm font-medium text-gray-300">
                {t('appraisal.periodEnd')} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                id="period_end"
                value={form.period_end}
                onChange={(e) => handleChange('period_end', e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          {/* Criteria Text */}
          <div>
            <label htmlFor="criteria_text" className="block text-sm font-medium text-gray-300">
              {t('appraisal.criteria')} <span className="text-red-400">*</span>
            </label>
            <textarea
              id="criteria_text"
              rows={6}
              value={form.criteria_text}
              onChange={(e) => handleChange('criteria_text', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('appraisal.criteriaPlaceholder')}
              required
            />
          </div>

          {/* Company Goals */}
          <div>
            <label htmlFor="company_goals" className="block text-sm font-medium text-gray-300">
              {t('appraisal.companyGoals')} <span className="text-gray-500">({t('common.optional')})</span>
            </label>
            <textarea
              id="company_goals"
              rows={3}
              value={form.company_goals}
              onChange={(e) => handleChange('company_goals', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('appraisal.companyGoalsPlaceholder')}
            />
          </div>

          {/* Company Values */}
          <div>
            <label htmlFor="values" className="block text-sm font-medium text-gray-300">
              {t('appraisal.companyValues')} <span className="text-gray-500">({t('common.optional')})</span>
            </label>
            <textarea
              id="values"
              rows={3}
              value={form.values}
              onChange={(e) => handleChange('values', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('appraisal.companyValuesPlaceholder')}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={generating}
            className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-accent"
          >
            {generating ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('appraisal.generating')}
              </span>
            ) : (
              t('appraisal.generate')
            )}
          </button>
        </form>
      </div>

      {/* Generated Result */}
      {result && (
        <div className="glass-strong rounded-2xl p-8 border border-white/10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mr-3 glow-cyan">
                <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                  <path d="M9.353 10.353a.5.5 0 00.707 0l2-2a.5.5 0 10-.707-.707L10 9.293 8.646 7.94a.5.5 0 00-.707.707l1.414 1.414z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">{t('appraisal.resultTitle')}</h2>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                {t('appraisal.words', { count: result.word_count })}
              </span>
              <button
                onClick={handleCopyToClipboard}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
              >
                {t('appraisal.copy')}
              </button>
            </div>
          </div>

          <div className="glass bg-white/5 rounded-xl p-6 border border-white/5">
            <div className="whitespace-pre-wrap text-gray-200 leading-relaxed">
              {result.generated_text}
            </div>
          </div>

          <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <p className="text-sm text-gray-300">
              <strong className="text-indigo-400">{t('appraisal.tip')}</strong> {t('appraisal.tipBody')}
            </p>
          </div>
        </div>
      )}

      {/* History Section */}
      <div className="glass-strong rounded-2xl p-8 border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{t('appraisal.history')}</h2>
          <button
            onClick={loadHistory}
            disabled={loading}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('common.loading')}
              </span>
            ) : (
              showHistory ? t('appraisal.refresh') : t('appraisal.loadHistory')
            )}
          </button>
        </div>

        {showHistory && history.length === 0 && (
          <p className="text-gray-400 text-sm">{t('appraisal.noHistory')}</p>
        )}

        {history.length > 0 && (
          <div className="space-y-3">
            {history.map((appraisal) => (
              <div
                key={appraisal.id}
                className="glass bg-white/5 rounded-xl p-4 border border-white/5 hover:border-indigo-500/30 cursor-pointer transition-all card-hover"
                onClick={() => {
                  setResult(appraisal)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-white">
                      {new Date(appraisal.period_start).toLocaleDateString()} - {new Date(appraisal.period_end).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {t('appraisal.generatedOn', { date: new Date(appraisal.created_at).toLocaleDateString() })}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                    {t('appraisal.words', { count: appraisal.word_count })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
