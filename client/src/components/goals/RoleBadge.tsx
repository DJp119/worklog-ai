/**
 * client/src/components/goals/RoleBadge.tsx
 *
 * Compact pill that shows goal scope + status colors.
 */
import type { GoalScope, GoalStatus } from 'shared'

interface RoleBadgeProps {
  scope: GoalScope
  status: GoalStatus
}

const SCOPE_COLORS: Record<GoalScope, string> = {
  organization: 'bg-purple-500/20 text-purple-300',
  department: 'bg-blue-500/20 text-blue-300',
  team: 'bg-emerald-500/20 text-emerald-300',
  individual: 'bg-amber-500/20 text-amber-300',
}

const STATUS_COLORS: Record<GoalStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  active: 'bg-green-500/20 text-green-300',
  at_risk: 'bg-yellow-500/20 text-yellow-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  cancelled: 'bg-red-500/20 text-red-300',
}

export function RoleBadge({ scope, status }: RoleBadgeProps) {
  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-medium ${SCOPE_COLORS[scope]}`}>
        {scope}
      </span>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status]}`}>
        {status.replace('_', ' ')}
      </span>
    </div>
  )
}
