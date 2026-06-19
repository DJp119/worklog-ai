/**
 * client/src/components/teams/MemberList.tsx
 *
 * List team members with role chips.
 */
import { useTranslation } from 'react-i18next'
import type { TeamMember, TeamRole } from 'shared'

interface MemberListProps {
  members: TeamMember[]
  onChangeRole?: (userId: string, role: TeamRole) => void
  onRemove?: (userId: string) => void
  readOnly?: boolean
}

const ROLE_COLORS: Record<TeamRole, string> = {
  member: 'bg-gray-500/20 text-gray-300',
  manager: 'bg-blue-500/20 text-blue-300',
  admin: 'bg-amber-500/20 text-amber-300',
  owner: 'bg-purple-500/20 text-purple-300',
}

export function MemberList({ members, onChangeRole, onRemove, readOnly }: MemberListProps) {
  const { t } = useTranslation()
  if (members.length === 0) {
    return <p className="text-sm text-gray-500">{t('teams.noMembers')}</p>
  }
  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li
          key={m.id}
          className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
        >
          <div>
            <p className="text-white text-sm">
              {m.user?.name ?? m.user?.email ?? m.user_id}
            </p>
            {m.user?.email && (
              <p className="text-xs text-gray-500">{m.user.email}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {readOnly ? (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}
              >
                {m.role}
              </span>
            ) : (
              <>
                <select
                  value={m.role}
                  onChange={(e) => onChangeRole?.(m.user_id, e.target.value as TeamRole)}
                  className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
                >
                  {(['member', 'manager', 'admin', 'owner'] as TeamRole[]).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {onRemove && (
                  <button
                    onClick={() => onRemove(m.user_id)}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
