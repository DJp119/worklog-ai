/**
 * client/src/pages/TeamGoals.tsx
 *
 * Manager view: pick a team, see its goals + roll-up, create/assign goals,
 * drill into a goal to manage key results, assignees, and links.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listMyOrgs, listOrgGoals, getOrgMembers, type MyOrgRow } from '../lib/teamsApi'
import { getGoal, deleteGoal } from '../lib/goalsApi'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTeamRole } from '../hooks/useTeamRole'
import { TeamTree } from '../components/teams/TeamTree'
import { GoalCard } from '../components/goals/GoalCard'
import { GoalForm } from '../components/goals/GoalForm'
import { KeyResultEditor } from '../components/goals/KeyResultEditor'
import { AssigneePicker } from '../components/goals/AssigneePicker'
import type { Goal, GoalWithDetails, Team } from 'shared'

export default function TeamGoals() {
  const { t } = useTranslation()
  const { user } = useAuth()
  usePageMeta({ title: t('teamGoals.titlePage'), noIndex: true })

  // (useTeamRole hook placed after the state declarations below to avoid
  // a temporal-dead-zone reference to selectedTeamId.)

  const [orgs, setOrgs] = useState<MyOrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])

  // Gate write actions on the user's team role. Server still re-validates
  // via requireTeamRole middleware; this is for UX (hiding controls the
  // user can't use). Hook is called unconditionally on a state-derived
  // value to satisfy Rules of Hooks.
  const { role: teamRole } = useTeamRole(selectedTeamId)
  const canManageGoals = teamRole === 'manager' || teamRole === 'admin' || teamRole === 'owner'
  const [openGoal, setOpenGoal] = useState<GoalWithDetails | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    if (activeOrgId) {
      loadOrgData(activeOrgId)
    }
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
      const [_members, allGoals] = await Promise.all([
        getOrgMembers(orgId),
        listOrgGoals(orgId),
      ])
      void _members
      // The full team/department list will be available once
      // /api/orgs/:orgId/teams and /api/orgs/:orgId/departments are
      // implemented on the server. For now, derive placeholder teams
      // from the goal list so the tree renders.
      const teamIds = new Set<string>()
      allGoals.forEach((g) => g.team_id && teamIds.add(g.team_id))
      setTeams(
        Array.from(teamIds).map((id) => ({
          id,
          org_id: orgId,
          name: id,
          created_at: '',
          updated_at: '',
        })),
      )
      setGoals(allGoals ?? [])
    } catch (err) {
      console.error(err)
    }
  }

  async function handleOpenGoal(goal: Goal) {
    try {
      const full = await getGoal(goal.id)
      setOpenGoal(full)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!confirm(t('goals.confirmDelete'))) return
    try {
      await deleteGoal(goalId)
      setOpenGoal(null)
      if (activeOrgId) await loadOrgData(activeOrgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSaved() {
    setShowForm(false)
    if (activeOrgId) await loadOrgData(activeOrgId)
  }

  const filteredGoals = selectedTeamId
    ? goals.filter((g) => g.team_id === selectedTeamId)
    : goals

  const rollupAverage = filteredGoals.length
    ? filteredGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / filteredGoals.length
    : 0

  if (loading) return <div className="text-gray-400">{t('common.loading')}</div>

  if (orgs.length === 0) {
    return <p className="text-gray-400">{t('teamGoals.noOrgs')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-white">{t('teamGoals.titlePage')}</h1>
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
          {selectedTeamId && canManageGoals && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm"
            >
              + {t('goals.new')}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-300 text-sm">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <aside className="glass rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            {t('teams.title')}
          </h2>
          <TeamTree
            teams={teams}
            selectedTeamId={selectedTeamId ?? undefined}
            onSelect={(tm) => setSelectedTeamId(tm.id === selectedTeamId ? null : tm.id)}
            orgId={activeOrgId ?? ''}
          />
        </aside>

        <main className="md:col-span-2 space-y-4">
          {showForm && selectedTeamId && activeOrgId && (
            <div className="glass rounded-2xl p-5">
              <GoalForm
                orgId={activeOrgId}
                userId={user?.id ?? ''}
                defaultScope="team"
                defaultTeamId={selectedTeamId}
                onSaved={handleSaved}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                {t('teamGoals.rollup')} ({filteredGoals.length})
              </h2>
              <span className="text-2xl font-bold text-white">
                {rollupAverage.toFixed(0)}%
              </span>
            </div>
          </div>

          {filteredGoals.length === 0 ? (
            <p className="text-gray-400">{t('teamGoals.noGoals')}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredGoals.map((g) => (
                <GoalCard key={g.id} goal={g} onClick={() => handleOpenGoal(g)} />
              ))}
            </div>
          )}
        </main>
      </div>

      {openGoal && activeOrgId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{openGoal.title}</h2>
              <button
                onClick={() => setOpenGoal(null)}
                className="text-gray-300 hover:text-white"
              >
                ×
              </button>
            </div>
            {openGoal.description && <p className="text-gray-300">{openGoal.description}</p>}

            <section>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                {t('goals.keyResults')}
              </h3>
              <KeyResultEditor
                goalId={openGoal.id}
                keyResults={openGoal.key_results}
                onChange={() => handleOpenGoal(openGoal)}
              />
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                {t('goals.assignees')}
              </h3>
              <AssigneePicker
                orgId={activeOrgId}
                goalId={openGoal.id}
                assignees={openGoal.assignees}
                onChange={() => handleOpenGoal(openGoal)}
              />
            </section>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => handleDeleteGoal(openGoal.id)}
                className="px-4 py-2 rounded-lg text-red-300 hover:bg-red-500/10"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
