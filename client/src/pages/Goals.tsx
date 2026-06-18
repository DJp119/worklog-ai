/**
 * client/src/pages/Goals.tsx
 *
 * "My Goals" — individual goals the current user has created or been assigned,
 * plus the goals of any orgs the user belongs to. Includes a "+ New Goal" form
 * scoped to individual.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listMyOrgs, listOrgGoals, createOrg, type MyOrgRow } from '../lib/teamsApi'
import { createGoal } from '../lib/goalsApi'
import { useAuth } from '../context/AuthContext'
import { usePageMeta } from '../hooks/usePageMeta'
import { GoalCard } from '../components/goals/GoalCard'
import { GoalForm } from '../components/goals/GoalForm'
import type { Goal } from 'shared'

export default function Goals() {
  const { t } = useTranslation()
  const { user } = useAuth()
  usePageMeta({ title: t('goals.titlePage'), noIndex: true })

  const [orgs, setOrgs] = useState<MyOrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingOrg, setCreatingOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgSlug, setNewOrgSlug] = useState('')

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    if (activeOrgId) loadGoals(activeOrgId)
  }, [activeOrgId])

  async function loadOrgs() {
    setLoading(true)
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

  async function loadGoals(orgId: string) {
    try {
      const data = await listOrgGoals(orgId)
      // Filter to goals the current user created OR is assigned to (Issue T fallback)
      const mine = (data ?? []).filter((g) => {
        if (g.created_by === user?.id) return true
        return g.scope === 'organization' || g.scope === 'team' || g.scope === 'department'
      })
      setGoals(mine)
    } catch (err) {
      console.error(err)
      setGoals([])
    }
  }

  async function handleCreateOrg() {
    if (!newOrgName.trim() || !newOrgSlug.trim()) return
    try {
      const { id } = await createOrg({ name: newOrgName.trim(), slug: newOrgSlug.trim() })
      setNewOrgName('')
      setNewOrgSlug('')
      setCreatingOrg(false)
      await loadOrgs()
      setActiveOrgId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSaved(_goal: Goal) {
    void _goal
    setShowForm(false)
    if (activeOrgId) await loadGoals(activeOrgId)
  }

  if (loading) {
    return <div className="text-gray-400">{t('common.loading')}</div>
  }

  if (orgs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white">{t('goals.titlePage')}</h1>
        <div className="glass rounded-2xl p-6 space-y-3">
          <p className="text-gray-300">{t('goals.noOrgs')}</p>
          {creatingOrg ? (
            <div className="space-y-2">
              <input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder={t('goals.orgName')}
                className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
              <input
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
                placeholder="slug"
                className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateOrg}
                  className="px-4 py-2 rounded bg-indigo-500 text-white"
                >
                  {t('common.save')}
                </button>
                <button
                  onClick={() => setCreatingOrg(false)}
                  className="px-4 py-2 rounded text-gray-300 hover:bg-white/5"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreatingOrg(true)}
              className="px-4 py-2 rounded bg-indigo-500 text-white"
            >
              {t('goals.createOrg')}
            </button>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-white">{t('goals.titlePage')}</h1>
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
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm"
          >
            {showForm ? t('common.cancel') : `+ ${t('goals.new')}`}
          </button>
        </div>
      </div>

      {showForm && activeOrgId && (
        <div className="glass rounded-2xl p-5">
          <GoalForm
            orgId={activeOrgId}
            userId={user?.id ?? ''}
            defaultScope="individual"
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {goals.length === 0 ? (
        <p className="text-gray-400">{t('goals.noGoals')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}
    </div>
  )
}

// re-export to keep tree-shake honest for createGoal
void createGoal
