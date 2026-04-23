import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEntries } from '../lib/api'
import type { WorkLogEntry } from 'shared'

interface DashboardStats {
  totalWeeks: number
  currentStreak: number
  longestStreak: number
  totalHours: number
  averageHours: number
  missingWeeks: number
  lastLogDate: string | null
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<WorkLogEntry[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [currentWeekLogged, setCurrentWeekLogged] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const data = await getEntries()
      setEntries(data)
      calculateStats(data)
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  function getWeekStart(date: Date): string {
    const d = new Date(date)
    const dayOfWeek = d.getDay()
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  }

  function calculateStats(entries: WorkLogEntry[]) {
    // Calculate current week start
    const now = new Date()
    const currentStart = getWeekStart(now)

    // Check if current week is logged
    const currentWeekLogged = entries.some(e => e.week_start_date === currentStart)
    setCurrentWeekLogged(currentWeekLogged)

    // Sort entries by date
    const sorted = [...entries].sort((a, b) =>
      new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
    )

    // Total weeks logged
    const totalWeeks = entries.length

    // Calculate streaks
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0

    // Get all week starts from entries
    const weekStarts = new Set(entries.map(e => e.week_start_date))

    // Calculate current streak (counting backwards from now)
    const checkDate = new Date()
    if (!currentWeekLogged) {
      // If current week not logged, start checking from last week
      checkDate.setDate(checkDate.getDate() - 7)
    }

    while (true) {
      const weekStart = getWeekStart(checkDate)
      if (weekStarts.has(weekStart)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 7)
      } else {
        break
      }
    }

    // Calculate longest streak
    const allWeeks = Array.from(weekStarts).sort()
    for (let i = 0; i < allWeeks.length; i++) {
      tempStreak = 1
      for (let j = i + 1; j < allWeeks.length; j++) {
        const prevDate = new Date(allWeeks[j - 1])
        const currDate = new Date(allWeeks[j])
        const diffWeeks = (currDate.getTime() - prevDate.getTime()) / (7 * 24 * 60 * 60 * 1000)

        if (diffWeeks === 1) {
          tempStreak++
        } else {
          break
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak)
    }

    // Calculate hours
    const totalHours = entries.reduce((sum, e) => sum + (e.hours_logged || 0), 0)
    const averageHours = totalWeeks > 0 ? totalHours / totalWeeks : 0

    // Calculate missing weeks (weeks without logs in the past 3 months)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90)

    let missingWeeks = 0
    const checkDateMissing = new Date()
    if (!currentWeekLogged) {
      checkDateMissing.setDate(checkDateMissing.getDate() - 7)
    }

    while (checkDateMissing >= threeMonthsAgo) {
      const weekStart = getWeekStart(checkDateMissing)
      if (!weekStarts.has(weekStart)) {
        missingWeeks++
      }
      checkDateMissing.setDate(checkDateMissing.getDate() - 7)
    }

    setStats({
      totalWeeks,
      currentStreak,
      longestStreak,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHours: Math.round(averageHours * 10) / 10,
      missingWeeks,
      lastLogDate: sorted.length > 0 ? sorted[0].week_start_date : null,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Track your logging progress</p>
        </div>
        {!currentWeekLogged && (
          <Link
            to="/log"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 transition-all glow-primary"
          >
            Log This Week
          </Link>
        )}
      </div>

      {/* Current Week Nudge */}
      {!currentWeekLogged && (
        <div className="glass border border-amber-500/20 rounded-xl p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-sm font-medium text-amber-400">
                You haven't logged this week yet
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                Take 5 minutes to log your accomplishments, challenges, and learnings.
                Keeping a consistent record will make appraisal time much easier!
              </p>
              <div className="mt-4">
                <Link
                  to="/log"
                  className="text-sm font-medium text-amber-400 hover:text-amber-300 inline-flex items-center"
                >
                  Log your week now
                  <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Weeks */}
          <div className="glass rounded-xl p-6 card-hover">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg p-3 glow-primary">
                <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Weeks Logged</p>
                <p className="text-2xl font-bold text-white">{stats.totalWeeks}</p>
              </div>
            </div>
          </div>

          {/* Current Streak */}
          <div className="glass rounded-xl p-6 card-hover">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg p-3">
                <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.698-.822 2.483a16.139 16.139 0 01-.57-1.116c-.208-.402-.397-.785-.611-1.115a1 1 0 00-1.45.385C4.78 5.648 4 8.53 4 11c0 3.314 2.686 6 6 6s6-2.686 6-6c0-2.47-.78-5.352-2.105-7.447zM7 11a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Current Streak</p>
                <p className="text-2xl font-bold text-white">{stats.currentStreak} weeks</p>
              </div>
            </div>
          </div>

          {/* Longest Streak */}
          <div className="glass rounded-xl p-6 card-hover">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-3 glow-accent">
                <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Longest Streak</p>
                <p className="text-2xl font-bold text-white">{stats.longestStreak} weeks</p>
              </div>
            </div>
          </div>

          {/* Total Hours */}
          <div className="glass rounded-xl p-6 card-hover">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg p-3 glow-cyan">
                <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Hours</p>
                <p className="text-2xl font-bold text-white">{stats.totalHours}</p>
                <p className="text-xs text-gray-500">Avg: {stats.averageHours}h/week</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Entries */}
      <div className="glass rounded-xl border border-white/5">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Recent Entries</h2>
        </div>
        <div className="divide-y divide-white/5">
          {entries.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-white">No entries yet</h3>
              <p className="mt-2 text-sm text-gray-400">
                Get started by logging your first week.
              </p>
              <div className="mt-6">
                <Link
                  to="/log"
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 transition-all"
                >
                  Log Your Week
                </Link>
              </div>
            </div>
          ) : (
            entries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="px-6 py-4 hover:bg-white/5 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-indigo-400">
                      Week of {new Date(entry.week_start_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="mt-2 text-sm text-gray-300 line-clamp-2">
                      {entry.accomplishments}
                    </p>
                    {entry.hours_logged && (
                      <p className="mt-2 text-xs text-gray-500">
                        {entry.hours_logged} hours logged
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/log?edit=${entry.id}`}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
        {entries.length > 5 && (
          <div className="px-6 py-4 border-t border-white/5">
            <Link
              to="/log"
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all entries →
            </Link>
          </div>
        )}
      </div>

      {/* Missing Weeks */}
      {stats && stats.missingWeeks > 0 && (
        <div className="glass rounded-xl p-6 border border-white/5">
          <h2 className="text-lg font-semibold text-white mb-3">
            Catch Up Needed
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            You're missing {stats.missingWeeks} week{stats.missingWeeks > 1 ? 's' : ''} in the past 3 months.
            Consider filling in the gaps to have a complete record for your appraisal.
          </p>
          <Link
            to="/log"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium glass text-white hover:bg-white/10 transition-all"
          >
            Log Missing Weeks
          </Link>
        </div>
      )}
    </div>
  )
}
