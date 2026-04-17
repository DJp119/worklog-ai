import { useState, FormEvent } from 'react'
import { generateAppraisal, getAppraisalHistory } from '../lib/api'
import type { GeneratedAppraisal } from 'shared'

interface AppraisalForm {
  period_start: string
  period_end: string
  criteria_text: string
  company_goals: string
  values: string
}

export default function Appraisal() {
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
      setError('Please fill in all required fields')
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
      setError(err instanceof Error ? err.message : 'Failed to generate appraisal')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyToClipboard = () => {
    if (result?.generated_text) {
      navigator.clipboard.writeText(result.generated_text)
      alert('Copied to clipboard!')
    }
  }

  const loadHistory = async () => {
    setLoading(true)
    try {
      const appraisals = await getAppraisalHistory()
      setHistory(appraisals)
      setShowHistory(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Generate Appraisal Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Generate Self-Appraisal
        </h1>
        <p className="text-gray-600 mb-6">
          Input your company's appraisal criteria and let AI write your self-appraisal based on your work logs.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="period_start" className="block text-sm font-medium text-gray-700">
                Period Start <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="period_start"
                value={form.period_start}
                onChange={(e) => handleChange('period_start', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="period_end" className="block text-sm font-medium text-gray-700">
                Period End <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="period_end"
                value={form.period_end}
                onChange={(e) => handleChange('period_end', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Criteria Text */}
          <div>
            <label htmlFor="criteria_text" className="block text-sm font-medium text-gray-700">
              Appraisal Criteria <span className="text-red-500">*</span>
            </label>
            <textarea
              id="criteria_text"
              rows={6}
              value={form.criteria_text}
              onChange={(e) => handleChange('criteria_text', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Paste your company's self-appraisal criteria here. For example:
- Demonstrate technical excellence and innovation
- Drive project delivery and meet commitments
- Collaborate effectively with team members
- Show leadership and mentorship"
              required
            />
          </div>

          {/* Company Goals */}
          <div>
            <label htmlFor="company_goals" className="block text-sm font-medium text-gray-700">
              Company Goals (optional)
            </label>
            <textarea
              id="company_goals"
              rows={3}
              value={form.company_goals}
              onChange={(e) => handleChange('company_goals', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What are your company or team goals for this period?"
            />
          </div>

          {/* Company Values */}
          <div>
            <label htmlFor="values" className="block text-sm font-medium text-gray-700">
              Company Values (optional)
            </label>
            <textarea
              id="values"
              rows={3}
              value={form.values}
              onChange={(e) => handleChange('values', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Your company's core values"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={generating}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating...' : 'Generate Appraisal'}
          </button>
        </form>
      </div>

      {/* Generated Result */}
      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Your Generated Appraisal</h2>
            <div className="flex space-x-2">
              <span className="text-sm text-gray-500">
                {result.word_count} words
              </span>
              <button
                onClick={handleCopyToClipboard}
                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>

          <div className="prose max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {result.generated_text}
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              <strong>Tip:</strong> Review and personalize this draft before submitting. Add specific metrics or examples that only you would know.
            </p>
          </div>
        </div>
      )}

      {/* History Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Appraisal History</h2>
          <button
            onClick={loadHistory}
            disabled={loading}
            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Loading...' : showHistory ? 'Refresh' : 'Load History'}
          </button>
        </div>

        {showHistory && history.length === 0 && (
          <p className="text-gray-500 text-sm">No appraisals generated yet.</p>
        )}

        {history.length > 0 && (
          <div className="space-y-4">
            {history.map((appraisal) => (
              <div
                key={appraisal.id}
                className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setResult(appraisal)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(appraisal.period_start).toLocaleDateString()} - {new Date(appraisal.period_end).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Generated {new Date(appraisal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {appraisal.word_count} words
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
