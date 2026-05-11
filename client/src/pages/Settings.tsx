import { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateProfile } from '../lib/api'

interface Profile {
  company_name: string
  job_title: string
  reminder_day: number
  reminder_hour: number // local hour 0-23
  reminder_enabled: boolean
}

/**
 * Convert a local hour (0-23) to UTC hour (0-23)
 */
function localHourToUtc(localHour: number): string {
  const now = new Date()
  // Create a date with the local hour
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
  // Create a UTC date with the given hour, then read local hour
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), utcHour, 0, 0))
  return utcDate.getHours()
}

/**
 * Format hour as 12-hour display string
 */
function formatHour(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

export default function Settings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile>({
    company_name: '',
    job_title: '',
    reminder_day: 1,
    reminder_hour: 9,
    reminder_enabled: true,
  })

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
        reminder_day: data.reminderDay ?? 1,
        reminder_hour: utcTimeToLocalHour(data.reminderTime || '09:00'),
        reminder_enabled: data.reminderEnabled ?? true,
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!user) {
      setError('You must be logged in to save settings')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      await updateProfile({
        companyName: profile.company_name,
        jobTitle: profile.job_title,
        reminderDay: profile.reminder_day,
        reminderTime: localHourToUtc(profile.reminder_hour),
        reminderEnabled: profile.reminder_enabled,
      })

      setMessage('Settings saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ]

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: formatHour(i),
  }))

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
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm">Manage your profile and reminder preferences</p>
        </div>
      </div>

      {/* Profile Settings */}
      <div className="glass-strong rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={user?.email || ''}
              disabled
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
          </div>

          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-300">
              Company Name
            </label>
            <input
              type="text"
              id="company_name"
              value={profile.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="Your company name"
            />
          </div>

          <div>
            <label htmlFor="job_title" className="block text-sm font-medium text-gray-300">
              Job Title
            </label>
            <input
              type="text"
              id="job_title"
              value={profile.job_title}
              onChange={(e) => handleChange('job_title', e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="e.g., Software Engineer"
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
                  Saving...
                </span>
              ) : (
                'Save Profile'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Reminder Settings */}
      <div className="glass-strong rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Reminder Preferences</h2>
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
                Enable weekly reminders
              </span>
            </label>
            <p className="mt-2 text-xs text-gray-500 ml-8">
              Get a reminder email every week to log your work
            </p>
          </div>

          {profile.reminder_enabled && (
            <>
              <div>
                <label htmlFor="reminder_day" className="block text-sm font-medium text-gray-300">
                  Reminder Day
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
                  Reminder Time
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
                <p className="mt-1 text-xs text-gray-500">
                  Times are shown in your local timezone
                </p>
              </div>
            </>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-primary"
            >
              {loading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* Messages */}
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
    </div>
  )
}
