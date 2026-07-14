/**
 * client/src/components/goals/GoalForm.tsx
 *
 * Create/edit a goal. Handles scope/period/progressMode combos and validation.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createGoal, updateGoal, GOAL_PERIODS, GOAL_SCOPES, PROGRESS_MODES } from '../../lib/goalsApi'
import type { CreateGoalRequest, Goal, GoalScope, ProgressMode, GoalPeriod, UpdateGoalRequest } from 'shared'

interface GoalFormProps {
  orgId: string
  userId: string
  teamOptions?: { id: string; name: string }[]
  parentGoalOptions?: Goal[]
  initial?: Goal
  defaultScope?: GoalScope
  defaultTeamId?: string
  onSaved: (g: Goal) => void
  onCancel: () => void
}

export function GoalForm({
  orgId,
  userId,
  teamOptions = [],
  parentGoalOptions = [],
  initial,
  defaultScope = 'individual',
  defaultTeamId,
  onSaved,
  onCancel,
}: GoalFormProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [scope, setScope] = useState<GoalScope>(initial?.scope ?? defaultScope)
  const [teamId, setTeamId] = useState<string | undefined>(initial?.team_id ?? defaultTeamId)
  const [parentGoalId, setParentGoalId] = useState<string | undefined>(initial?.parent_goal_id ?? undefined)
  const [period, setPeriod] = useState<GoalPeriod>(initial?.period ?? 'quarterly')
  const [progressMode, setProgressMode] = useState<ProgressMode>(initial?.progress_mode ?? 'manual')
  const today = new Date().toISOString().split('T')[0]
  const inThreeMonths = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(initial?.start_date ?? today)
  const [dueDate, setDueDate] = useState(initial?.due_date ?? inThreeMonths)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim()) {
      setError(t('goals.titleRequired'))
      return
    }
    setSubmitting(true)
    try {
      let goal: Goal
      if (initial) {
        const body: UpdateGoalRequest = {
          title: title.trim(),
          description: description.trim() || null,
          status: initial.status,
          period,
          startDate,
          dueDate,
          progressMode,
        }
        goal = await updateGoal(initial.id, body)
      } else {
        const body: CreateGoalRequest = {
          orgId,
          scope,
          title: title.trim(),
          period,
          startDate,
          dueDate,
          teamId: scope === 'team' ? teamId : null,
          departmentId: scope === 'department' ? null : null,
          parentGoalId: parentGoalId || null,
          description: description.trim() || null,
          progressMode,
        }
        void userId
        goal = await createGoal(body)
      }
      onSaved(goal)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm text-gray-300 mb-1">{t('goals.title')}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">{t('goals.description')}</label>
        <textarea
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">{t('goals.scope')}</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as GoalScope)}
            disabled={!!initial}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white disabled:opacity-50"
          >
            {GOAL_SCOPES.map((s) => (
              <option key={s} value={s}>
                {t(`goals.scope.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">{t('goals.periodLabel')}</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
          >
            {GOAL_PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`goals.period.${p}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {scope === 'team' && (
        <div>
          <label className="block text-sm text-gray-300 mb-1">{t('goals.team')}</label>
          <select
            value={teamId ?? ''}
            onChange={(e) => setTeamId(e.target.value || undefined)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
            required
          >
            <option value="">—</option>
            {teamOptions.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {parentGoalOptions.length > 0 && (
        <div>
          <label className="block text-sm text-gray-300 mb-1">{t('goals.parentGoal')}</label>
          <select
            value={parentGoalId ?? ''}
            onChange={(e) => setParentGoalId(e.target.value || undefined)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
          >
            <option value="">{t('goals.noParent')}</option>
            {parentGoalOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">{t('goals.startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">{t('goals.dueDate')}</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">{t('goals.progressMode')}</label>
        <select
          value={progressMode}
          onChange={(e) => setProgressMode(e.target.value as ProgressMode)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
        >
          {PROGRESS_MODES.map((m) => (
            <option key={m} value={m}>
              {t(`goals.mode.${m}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50"
        >
          {submitting ? t('common.saving') : initial ? t('common.save') : t('common.create')}
        </button>
      </div>
    </form>
  )
}
