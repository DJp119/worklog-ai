/**
 * client/src/pages/OrgSettings.tsx
 *
 * Org admin: manage departments, teams, members. Owner-only: rebuild closure.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listMyOrgs,
  listOrgGoals,
  createDepartment,
  createTeam,
  getOrgMembers,
  rebuildClosure,
  reparentTeam,
  deleteTeam,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  type MyOrgRow,
} from '../lib/teamsApi'
import { usePageMeta } from '../hooks/usePageMeta'
import { useHasOrg } from '../hooks/useHasOrg'
import { TeamTree } from '../components/teams/TeamTree'
import { MemberList } from '../components/teams/MemberList'
import type {
  Department,
  Team,
  TeamMember,
  OrgMember,
  TeamRole,
} from 'shared'

export default function OrgSettings() {
  const { t } = useTranslation()
  usePageMeta({ title: t('orgSettings.titlePage'), noIndex: true })

  const [orgs, setOrgs] = useState<MyOrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [newDeptName, setNewDeptName] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [newMemberId, setNewMemberId] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<TeamRole>('member')
  const [loading, setLoading] = useState(true)
  // Gate the page on the user having at least one org. Server still
  // re-validates; this is a UX early-return so we don't fire a flurry
  // of 403s.
  const hasOrg = useHasOrg()
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'teams' | 'departments' | 'members'>('teams')

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    if (activeOrgId) loadOrgData(activeOrgId)
  }, [activeOrgId])

  async function loadOrgs() {
    try {
      const data = await listMyOrgs()
      setOrgs(data ?? [])
      if (data && data.length > 0) setActiveOrgId(data[0].org_id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadOrgData(orgId: string) {
    try {
      const [allGoals, orgMembers] = await Promise.all([
        listOrgGoals(orgId),
        getOrgMembers(orgId),
      ])
      setMembers(orgMembers ?? [])
      const teamMap = new Map<string, Team>()
      allGoals.forEach((g) => {
        if (g.team_id) {
          teamMap.set(g.team_id, {
            id: g.team_id,
            org_id: orgId,
            name: g.team_id,
            created_at: '',
            updated_at: '',
          })
        }
      })
      setTeams(Array.from(teamMap.values()))
      const deptMap = new Map<string, Department>()
      allGoals.forEach((g) => {
        if (g.department_id) {
          deptMap.set(g.department_id, {
            id: g.department_id,
            org_id: orgId,
            name: g.department_id,
            created_at: '',
            updated_at: '',
          })
        }
      })
      setDepartments(Array.from(deptMap.values()))
    } catch (err) {
      console.error(err)
    }
  }

  async function loadTeamMembers(teamId: string) {
    // Server endpoint for team-member listing isn't implemented yet; the
    // mutation endpoints are used directly from this form.
    void teamId
    setTeamMembers([])
  }

  async function handleCreateDepartment() {
    if (!newDeptName.trim() || !activeOrgId) return
    try {
      await createDepartment(activeOrgId, { name: newDeptName.trim() })
      setNewDeptName('')
      await loadOrgData(activeOrgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim() || !activeOrgId) return
    try {
      await createTeam(activeOrgId, {
        name: newTeamName.trim(),
        parentTeamId: selectedTeamId,
      })
      setNewTeamName('')
      await loadOrgData(activeOrgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleAddMember() {
    if (!newMemberId.trim() || !selectedTeamId) return
    try {
      await addTeamMember(selectedTeamId, newMemberId.trim(), newMemberRole)
      setNewMemberId('')
      await loadTeamMembers(selectedTeamId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleChangeRole(userId: string, role: TeamRole) {
    if (!selectedTeamId) return
    try {
      await updateTeamMemberRole(selectedTeamId, userId, role)
      await loadTeamMembers(selectedTeamId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleRemove(userId: string) {
    if (!selectedTeamId) return
    try {
      await removeTeamMember(selectedTeamId, userId)
      await loadTeamMembers(selectedTeamId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleReparent(team: Team) {
    const newParent = prompt(t('orgSettings.newParentPrompt'), '')
    if (newParent === null) return
    try {
      await reparentTeam(team.id, newParent || null)
      if (activeOrgId) await loadOrgData(activeOrgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDeleteTeam(team: Team) {
    if (!confirm(t('orgSettings.confirmDeleteTeam', { name: team.name }))) return
    try {
      await deleteTeam(team.id)
      setSelectedTeamId(null)
      if (activeOrgId) await loadOrgData(activeOrgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleRebuildClosure() {
    if (!activeOrgId) return
    try {
      await rebuildClosure(activeOrgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (loading) return <div className="text-gray-400">{t('common.loading')}</div>
  if (orgs.length === 0) return <p className="text-gray-400">{t('orgSettings.noOrgs')}</p>

  // Early-return guard: no org, no settings. Placed AFTER all hooks above
  // so React's Rules of Hooks are satisfied.
  if (!hasOrg) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
        <h1 className="text-2xl font-semibold mb-2">{t('orgSettings.titlePage')}</h1>
        <p className="text-gray-400">{t('orgSettings.noOrg')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-white">{t('orgSettings.titlePage')}</h1>
        <div className="flex items-center gap-2">
          <select
            value={activeOrgId ?? ''}
            onChange={(e) => setActiveOrgId(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
          >
            {orgs.map((o) => (
              <option key={o.org_id} value={o.org_id}>
                {o.organizations?.name ?? o.org_id}
              </option>
            ))}
          </select>
          <button
            onClick={handleRebuildClosure}
            className="px-3 py-2 rounded text-xs text-gray-400 hover:text-white border border-white/10"
          >
            {t('orgSettings.rebuildClosure')}
          </button>
        </div>
      </div>

      {error && <p className="text-red-300 text-sm">{error}</p>}

      <div className="flex gap-2 border-b border-white/5">
        {(['teams', 'departments', 'members'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab
                ? 'text-white border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t(`orgSettings.tab.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <aside className="glass rounded-2xl p-4 space-y-2">
            <TeamTree
              teams={teams}
              selectedTeamId={selectedTeamId ?? undefined}
              onSelect={(tm) => {
                setSelectedTeamId(tm.id)
                loadTeamMembers(tm.id)
              }}
              orgId={activeOrgId ?? ''}
            />
            <div className="pt-2 space-y-1">
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder={t('orgSettings.newTeamName')}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-sm text-white"
              />
              <button
                onClick={handleCreateTeam}
                className="w-full px-3 py-1 rounded bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/50 text-sm"
              >
                {t('orgSettings.addChildTeam')}
              </button>
            </div>
            {selectedTeamId && (
              <div className="pt-2 space-y-1">
                <button
                  onClick={() => {
                    const t = teams.find((x) => x.id === selectedTeamId)
                    if (t) handleReparent(t)
                  }}
                  className="w-full px-3 py-1 rounded text-xs text-gray-300 hover:bg-white/5"
                >
                  {t('orgSettings.reparent')}
                </button>
                <button
                  onClick={() => {
                    const t = teams.find((x) => x.id === selectedTeamId)
                    if (t) handleDeleteTeam(t)
                  }}
                  className="w-full px-3 py-1 rounded text-xs text-red-300 hover:bg-red-500/10"
                >
                  {t('common.delete')}
                </button>
              </div>
            )}
          </aside>

          <main className="md:col-span-2 glass rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              {t('orgSettings.teamMembers')}
            </h2>
            <MemberList
              members={teamMembers}
              onChangeRole={handleChangeRole}
              onRemove={handleRemove}
            />
            <div className="pt-2 space-y-1">
              <input
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
                placeholder={t('orgSettings.userIdPlaceholder')}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-sm text-white"
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as TeamRole)}
                className="rounded bg-white/5 border border-white/10 px-2 py-1 text-sm text-white"
              >
                {(['member', 'manager', 'admin', 'owner'] as TeamRole[]).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                className="w-full px-3 py-1 rounded bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/50 text-sm"
              >
                {t('orgSettings.addMember')}
              </button>
            </div>
          </main>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            {t('orgSettings.departments')}
          </h2>
          <ul className="space-y-1">
            {departments.map((d) => (
              <li key={d.id} className="px-3 py-2 rounded bg-white/5 text-white">
                {d.name}
              </li>
            ))}
            {departments.length === 0 && (
              <li className="text-sm text-gray-500">{t('orgSettings.noDepartments')}</li>
            )}
          </ul>
          <div className="pt-2 flex gap-2">
            <input
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder={t('orgSettings.newDeptName')}
              className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-sm text-white"
            />
            <button
              onClick={handleCreateDepartment}
              className="px-3 py-1 rounded bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/50 text-sm"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            {t('orgSettings.orgMembers')}
          </h2>
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
              >
                <div>
                  <p className="text-white text-sm">
                    {m.user?.name ?? m.user?.email ?? m.user_id}
                  </p>
                  {m.user?.email && <p className="text-xs text-gray-500">{m.user.email}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                  {m.role}
                </span>
              </li>
            ))}
            {members.length === 0 && (
              <li className="text-sm text-gray-500">{t('orgSettings.noMembers')}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
