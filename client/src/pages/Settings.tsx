import { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

interface Profile {
  company_name: string
  job_title: string
  reminder_day: number // 0-6 (Sunday-Saturday)
  reminder_time: string // HH:MM format
  reminder_enabled: boolean
}

export default function Settings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile>({
    company_name: '',
    job_title: '',
    reminder_day: 1, // Monday
    reminder_time: '09:00',
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
      const { data, error } = await supabase
        .from('user_profiles')
        .select('company_name, job_title, reminder_day, reminder_time, reminder_enabled')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Load profile error:', error)
        return
      }

      if (data) {
        setProfile({
          company_name: data.company_name || '',
          job_title: data.job_title || '',
          reminder_day: data.reminder_day ?? 1,
          reminder_time: data.reminder_time || '09:00',
          reminder_enabled: data.reminder_enabled ?? true,
        })
      }
    } catch (err) {
      console.error('Failed to load profile:', err)
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
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email,
          company_name: profile.company_name,
          job_title: profile.job_title,
          reminder_day: profile.reminder_day,
          reminder_time: profile.reminder_time,
          reminder_enabled: profile.reminder_enabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })

      if (error) {
        console.error('Save profile error:', error)
        throw error
      }

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your profile and reminder preferences</p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={user?.email || ''}
              disabled
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
          </div>

          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              type="text"
              id="company_name"
              value={profile.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Your company name"
            />
          </div>

          <div>
            <label htmlFor="job_title" className="block text-sm font-medium text-gray-700">
              Job Title
            </label>
            <input
              type="text"
              id="job_title"
              value={profile.job_title}
              onChange={(e) => handleChange('job_title', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., Software Engineer"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Reminder Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reminder Preferences</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={profile.reminder_enabled}
                onChange={(e) => handleChange('reminder_enabled', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Enable weekly reminders
              </span>
            </label>
            <p className="mt-1 text-xs text-gray-500 ml-6">
              Get a reminder email every week to log your work
            </p>
          </div>

          {profile.reminder_enabled && (
            <>
              <div>
                <label htmlFor="reminder_day" className="block text-sm font-medium text-gray-700">
                  Reminder Day
                </label>
                <select
                  id="reminder_day"
                  value={profile.reminder_day}
                  onChange={(e) => handleChange('reminder_day', parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {dayOptions.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reminder_time" className="block text-sm font-medium text-gray-700">
                  Reminder Time
                </label>
                <input
                  type="time"
                  id="reminder_time"
                  value={profile.reminder_time}
                  onChange={(e) => handleChange('reminder_time', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Account created</span>
            <span className="text-sm text-gray-900">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">User ID</span>
            <span className="text-sm text-gray-900 font-mono text-xs">{user?.id}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="text-green-600 text-sm bg-green-50 p-3 rounded">
          {message}
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
          {error}
        </div>
      )}
    </div>
  )
}
