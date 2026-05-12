import { useState, FormEvent, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { createEntry, getEntries, updateEntry, getEntry, deleteEntry } from '../lib/api'
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
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingEntry, setExistingEntry] = useState<WorkLogEntry | null>(null)
  const [searchParams] = useSearchParams()
  const editEntryId = searchParams.get('edit')
  const navigate = useNavigate()

  const [form, setForm] = useState<LogEntryForm>({
    week_start_date: '',
    accomplishments: '',
    challenges: '',
    learnings: '',
    goals_next_week: '',
    hours_logged: '',
  })

  // Either load specific entry by ID, or check for current week's entry
  useEffect(() => {
    const loadEntry = async () => {
      if (editEntryId && editEntryId !== 'null') {
        // Load specific entry by ID
        try {
          const entry = await getEntry(editEntryId)
          setExistingEntry(entry)
          setForm({
            week_start_date: entry.week_start_date,
            accomplishments: entry.accomplishments,
            challenges: entry.challenges,
            learnings: entry.learnings,
            goals_next_week: entry.goals_next_week,
            hours_logged: entry.hours_logged?.toString() || '',
          })
        } catch (err) {
          console.error('Failed to load entry:', err)
          setError('Failed to load the work log entry')
        }
      } else {
        // Pre-fill current week's start date (Monday)
        const today = new Date()
        const dayOfWeek = today.getDay()
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(today.setDate(diff))
        const year = monday.getFullYear()
        const month = String(monday.getMonth() + 1).padStart(2, '0')
        const day = String(monday.getDate()).padStart(2, '0')
        const weekStart = `${year}-${month}-${day}`
        setForm((prev) => ({ ...prev, week_start_date: weekStart }))
        await checkExistingEntry(weekStart)
      }
    }

    loadEntry()
  }, [editEntryId])

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

    if (!form.week_start_date || !form.accomplishments) {
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
        const newEntry = await createEntry(payload)
        setExistingEntry(newEntry)
        setMessage('Work log saved successfully!')
      }

      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        navigate('/dashboard')
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save work log')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!existingEntry) return

    setDeleting(true)
    setError(null)
    setMessage(null)
    setShowDeleteConfirm(false)

    try {
      await deleteEntry(existingEntry.id)
      setMessage('Work log deleted successfully!')
      setExistingEntry(null)
      navigate('/log', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete work log')
    } finally {
      setDeleting(false)
    }
  }

  const handleChange = (field: keyof LogEntryForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-strong rounded-2xl p-8 border border-white/10">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mr-3 glow-primary">
              <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {editEntryId ? 'Edit Work Log Entry' : existingEntry ? 'Update Your Work Log' : 'Log Your Week'}
              </h1>
              <p className="text-gray-400 text-sm">
                {editEntryId
                  ? 'Edit an existing work log entry'
                  : existingEntry
                    ? 'Update your work log for this week'
                    : 'Take 5 minutes to reflect on your week'}
              </p>
            </div>
          </div>
          {existingEntry && (
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : showDeleteConfirm ? 'Cancel' : 'Delete'}
            </button>
          )}
        </div>

        {showDeleteConfirm && existingEntry && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm mb-3">
              Are you sure you want to delete this work log entry? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-8">
          {/* Week Start Date */}
          <div>
            <label htmlFor="week_start_date" className="block text-sm font-medium text-gray-300">
              Week Starting
            </label>
            <input
              type="date"
              id="week_start_date"
              value={form.week_start_date}
              onChange={(e) => handleChange('week_start_date', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Accomplishments */}
          <div>
            <label htmlFor="accomplishments" className="block text-sm font-medium text-gray-300">
              Accomplishments <span className="text-red-400">*</span>
            </label>
            <textarea
              id="accomplishments"
              rows={4}
              value={form.accomplishments}
              onChange={(e) => handleChange('accomplishments', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="What did you accomplish this week? What did you ship? What problems did you solve?"
              required
            />
          </div>

          {/* Challenges */}
          <div>
            <label htmlFor="challenges" className="block text-sm font-medium text-gray-300">
              Challenges (optional)
            </label>
            <textarea
              id="challenges"
              rows={3}
              value={form.challenges}
              onChange={(e) => handleChange('challenges', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="What obstacles did you face? What didn't go as planned?"
            />
          </div>

          {/* Learnings */}
          <div>
            <label htmlFor="learnings" className="block text-sm font-medium text-gray-300">
              Learnings (optional)
            </label>
            <textarea
              id="learnings"
              rows={3}
              value={form.learnings}
              onChange={(e) => handleChange('learnings', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="What did you learn? Any new skills, insights, or discoveries?"
            />
          </div>

          {/* Goals Next Week */}
          <div>
            <label htmlFor="goals_next_week" className="block text-sm font-medium text-gray-300">
              Goals for Next Week (optional)
            </label>
            <textarea
              id="goals_next_week"
              rows={3}
              value={form.goals_next_week}
              onChange={(e) => handleChange('goals_next_week', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="What are your priorities for next week?"
            />
          </div>

          {/* Hours Logged */}
          <div>
            <label htmlFor="hours_logged" className="block text-sm font-medium text-gray-300">
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
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., 40"
            />
          </div>

          {/* Messages */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
              {error}
            </div>
          )}

          {message && (
            <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
              {message}
            </div>
          )}

          {/* Submit Button */}
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
                Saving...
              </span>
            ) : (
              existingEntry ? 'Update Log' : 'Save Log'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
