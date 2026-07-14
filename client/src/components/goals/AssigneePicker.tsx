/**
 * client/src/components/goals/AssigneePicker.tsx
 *
 * Add/remove assignees to a goal. Lists org members.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addAssignee, removeAssignee } from '../../lib/goalsApi'
import { getOrgMembers } from '../../lib/teamsApi'
import type { OrgMember, GoalAssignee } from 'shared'

interface AssigneePickerProps {
  orgId: string
  goalId: string
  assignees: GoalAssignee[]
  onChange: () => void
}

export function AssigneePicker({ orgId, goalId, assignees, onChange }: AssigneePickerProps) {
  const { t } = useTranslation()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    getOrgMembers(orgId).then(setMembers).catch(() => setMembers([]))
  }, [orgId])

  const assignedIds = new Set(assignees.map((a) => a.user_id))
  const candidates = members.filter((m) => !assignedIds.has(m.user_id))

  async function handleAdd(userId: string) {
    await addAssignee(goalId, userId)
    setAdding(false)
    onChange()
  }

  async function handleRemove(userId: string) {
    await removeAssignee(goalId, userId)
    onChange()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {assignees.map((a) => (
          <span
            key={a.user_id}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-sm text-indigo-100"
          >
            {a.user?.name ?? a.user?.email ?? a.user_id}
            <button
              onClick={() => handleRemove(a.user_id)}
              className="text-indigo-300 hover:text-white"
              aria-label={t('common.delete')}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {adding ? (
        <div className="glass rounded-lg p-2 space-y-1">
          {candidates.length === 0 ? (
            <p className="text-xs text-gray-500">{t('goals.noMembers')}</p>
          ) : (
            candidates.map((m) => (
              <button
                key={m.user_id}
                onClick={() => handleAdd(m.user_id)}
                className="block w-full text-left rounded px-2 py-1 text-sm text-white hover:bg-white/10"
              >
                {m.user?.name ?? m.user?.email ?? m.user_id}
                <span className="ml-2 text-xs text-gray-500">{m.role}</span>
              </button>
            ))
          )}
          <button
            onClick={() => setAdding(false)}
            className="text-xs text-gray-400 hover:text-white"
          >
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          + {t('goals.addAssignee')}
        </button>
      )}
    </div>
  )
}
