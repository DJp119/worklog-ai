import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEntry, getEntries, updateEntry } from '../lib/api'
import type { WorkLogEntry } from 'shared'

interface LogEntryForm {
  week_start_date: string
  accomplishments: string
  challenges: string
  learnings: string
  goals_next_week: string
  hours_logged: string
}

export default function LogEntry() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingEntry, setExistingEntry] = useState<WorkLogEntry | null>(null)

  const [form, setForm] = useState<LogEntryForm>({
    week_start_date: '',
    accomplishments: '',
    challenges: '',
    learnings: '',
    goals_next_week: '',
    hours_logged: '',
  })

  // Pre-fill current week's start date (Monday)
  useEffect(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust to Monday
    const monday = new Date(today.setDate(diff))
    const weekStart = monday.toISOString().split('T')[0]
    setForm((prev) => ({ ...prev, week_start_date: weekStart }))

    // Check if entry already exists for this week
    checkExistingEntry(weekStart)
  }, [])

  async function checkExistingEntry(weekStart: string) {
    try {
      const entries = await getEntries()
      const existing = entries.find((e) => e.week_start_date === weekStart)
      if (existing) {
        setExistingEntry(existing)
        setForm({
          week_start_date: existing.week_start_date,
          accomplishments: existing.accomplishments,
          challenges: existing.challenges,
          learnings: existing.learnings,
          goals_next_week: existing.goals_next_week,
          hours_logged: existing.hours_logged?.toString() || '',
        })
      }
    } catch (err) {
      console.error('Failed to check existing entry:', err)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!form.week_start_date || !form.accomplishments || !form.challenges) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const payload = {
        week_start_date: form.week_start_date,
        accomplishments: form.accomplishments,
        challenges: form.challenges,
        learnings: form.learnings,
        goals_next_week: form.goals_next_week,
        hours_logged: form.hours_logged ? parseFloat(form.hours_logged) : undefined,
      }

      if (existingEntry) {
        await updateEntry(existingEntry.id, payload)
        setMessage('Work log updated successfully!')
      } else {
        await createEntry(payload)
        setMessage('Work log saved successfully!')
      }

      // Clear form after successful save (if new entry)
      if (!existingEntry) {
        setForm({
          week_start_date: form.week_start_date,
          accomplishments: '',
          challenges: '',
          learnings: '',
          goals_next_week: '',
          hours_logged: '',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save work log')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof LogEntryForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {existingEntry ? 'Update Your Work Log' : 'Log Your Week'}
        </h1>
        <p className="text-gray-600 mb-6">
          {existingEntry
            ? 'Update your work log for this week'
            : 'Take 5 minutes to reflect on your week'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Week Start Date */}
          <div>
            <label htmlFor="week_start_date" className="block text-sm font-medium text-gray-700">
              Week Starting
            </label>
            <input
              type="date"
              id="week_start_date"
              value={form.week_start_date}
              onChange={(e) => handleChange('week_start_date', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {/* Accomplishments */}
          <div>
            <label htmlFor="accomplishments" className="block text-sm font-medium text-gray-700">
              Accomplishments <span className="text-red-500">*</span>
            </label>
            <textarea
              id="accomplishments"
              rows={4}
              value={form.accomplishments}
              onChange={(e) => handleChange('accomplishments', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What did you accomplish this week? What did you ship? What problems did you solve?"
              required
            />
          </div>

          {/* Challenges */}
          <div>
            <label htmlFor="challenges" className="block text-sm font-medium text-gray-700">
              Challenges <span className="text-red-500">*</span>
            </label>
            <textarea
              id="challenges"
              rows={3}
              value={form.challenges}
              onChange={(e) => handleChange('challenges', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What obstacles did you face? What didn't go as planned?"
              required
            />
          </div>

          {/* Learnings */}
          <div>
            <label htmlFor="learnings" className="block text-sm font-medium text-gray-700">
              Learnings
            </label>
            <textarea
              id="learnings"
              rows={3}
              value={form.learnings}
              onChange={(e) => handleChange('learnings', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What did you learn? Any new skills, insights, or discoveries?"
            />
          </div>

          {/* Goals Next Week */}
          <div>
            <label htmlFor="goals_next_week" className="block text-sm font-medium text-gray-700">
              Goals for Next Week
            </label>
            <textarea
              id="goals_next_week"
              rows={3}
              value={form.goals_next_week}
              onChange={(e) => handleChange('goals_next_week', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What are your priorities for next week?"
            />
          </div>

          {/* Hours Logged */}
          <div>
            <label htmlFor="hours_logged" className="block text-sm font-medium text-gray-700">
              Hours Logged (optional)
            </label>
            <input
              type="number"
              id="hours_logged"
              step="0.5"
              min="0"
              max="168"
              value={form.hours_logged}
              onChange={(e) => handleChange('hours_logged', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., 40"
            />
          </div>

          {/* Messages */}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : existingEntry ? 'Update Log' : 'Save Log'}
          </button>
        </form>
      </div>
    </div>
  )
}
