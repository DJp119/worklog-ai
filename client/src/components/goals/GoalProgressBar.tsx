/**
 * client/src/components/goals/GoalProgressBar.tsx
 *
 * Animated progress bar. Color-coded by mode.
 */
import type { ProgressMode } from 'shared'

interface GoalProgressBarProps {
  value: number
  mode: ProgressMode
}

export function GoalProgressBar({ value, mode }: GoalProgressBarProps) {
  const safe = Math.max(0, Math.min(100, value || 0))
  const color =
    mode === 'manual'
      ? 'from-indigo-500 to-purple-500'
      : mode === 'key_results'
        ? 'from-emerald-500 to-teal-500'
        : 'from-amber-500 to-orange-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400 capitalize">{mode.replace('_', ' ')}</span>
        <span className="text-white font-medium">{safe.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  )
}
