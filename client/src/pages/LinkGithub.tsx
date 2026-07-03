import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listMyOrgs, type MyOrgRow } from '../lib/teamsApi'

export default function LinkGithub() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<MyOrgRow[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const installationId = params.get('installation_id')

  useEffect(() => {
    async function loadOrgs() {
      try {
        const data = await listMyOrgs()
        setOrgs(data ?? [])
        if (data && data.length === 1) {
          setSelectedOrgId(data[0].org_id)
        }
      } catch (err) {
        console.error('Failed to load orgs for GitHub App linking', { err })
        setError(t('integrations.githubAppLinkError'))
      } finally {
        setLoading(false)
      }
    }
    loadOrgs()
  }, [t])

  async function handleLink() {
    if (!selectedOrgId || !installationId) return
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/integrations/github/app-callback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({
            orgId: selectedOrgId,
            installation_id: installationId,
          }),
        },
      )
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error ?? `HTTP ${response.status}`)
      }
      setInfo(t('integrations.githubAppLinked'))
      setTimeout(() => navigate('/integrations', { replace: true }), 1500)
    } catch (err) {
      console.error('GitHub App link failed', { err })
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-gray-400">{t('common.loading')}</div>
  }

  if (!installationId) {
    return (
      <div className="text-red-300 text-sm">
        {t('integrations.githubAppMissingInstallationId')}
      </div>
    )
  }

  if (orgs.length === 0) {
    return (
      <div className="text-yellow-300 text-sm">
        {t('integrations.noOrgsAvailable')}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-white">
        {t('integrations.githubAppLinkTitle')}
      </h1>
      <p className="text-gray-300 text-sm">
        {t('integrations.githubAppLinkDesc', { installationId })}
      </p>
      {error && <p className="text-red-300 text-sm">{error}</p>}
      {info && <p className="text-emerald-300 text-sm">{info}</p>}

      <div className="glass rounded-2xl p-5 space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          {t('integrations.selectOrg')}
        </label>
        <select
          value={selectedOrgId ?? ''}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-white"
        >
          <option value="">{t('integrations.selectOrgPlaceholder')}</option>
          {orgs.map((o) => (
            <option key={o.org_id} value={o.org_id}>
              {o.organizations?.name ?? o.org_id}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleLink}
        disabled={!selectedOrgId || submitting}
        className="w-full px-4 py-2 rounded bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? t('common.saving') : t('integrations.linkGithubApp')}
      </button>

      <button
        onClick={() => navigate('/integrations')}
        className="w-full px-4 py-2 rounded border border-white/20 text-gray-300 hover:text-white"
      >
        {t('common.cancel')}
      </button>
    </div>
  )
}