/**
 * client/src/components/goals/GoalCard.tsx
 *
 * Renders a single goal summary tile — title, scope badge, status, progress bar.
 */
import { useTranslation } from 'react-i18next'
import type { Goal } from 'shared'
import { GoalProgressBar } from './GoalProgressBar'
import { RoleBadge } from './RoleBadge'

interface GoalCardProps {
  goal: Goal
  onClick?: () => void
}

export function GoalCard({ goal, onClick }: GoalCardProps) {
  const { t } = useTranslation()
  return (
    <div
      onClick={onClick}
      className={`glass rounded-2xl p-4 transition-all ${
        onClick ? 'cursor-pointer card-hover' : ''
      }`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-white font-semibold leading-tight line-clamp-2">
          {goal.title}
        </h3>
        <RoleBadge scope={goal.scope} status={goal.status} />
      </div>
      {goal.description && (
        <p className="text-sm text-gray-400 line-clamp-2 mb-3">{goal.description}</p>
      )}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <span>{t(`goals.period.${goal.period}`)}</span>
        <span>•</span>
        <span>
          {goal.start_date} → {goal.due_date}
        </span>
      </div>
      <GoalProgressBar value={goal.progress} mode={goal.progress_mode} />
    </div>
  )
}
