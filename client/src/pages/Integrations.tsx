/**
 * client/src/pages/Integrations.tsx
 *
 * Connect/disconnect JIRA, GitHub, Slack (and org-level installs) for the
 * active user / org. OAuth confirm flow handled here for JIRA site selection.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  listUserIntegrations,
  listOrgIntegrations,
  startJiraConnect,
  confirmJiraOAuth,
  getJiraSites,
  selectJiraSite,
  startGithubConnect,
  confirmGithubOAuth,
  startOrgJiraConnect,
  confirmOrgJiraOAuth,
  startOrgSlackConnect,
  confirmOrgSlackOAuth,
  startGithubAppConnect,
  disconnectUserIntegration,
  disconnectOrgIntegration,
  confirmSlackLinkPin,
} from '../lib/integrationsApi'
import { listMyOrgs, type MyOrgRow } from '../lib/teamsApi'
import { usePageMeta } from '../hooks/usePageMeta'
import { ConnectionCard } from '../components/integrations/ConnectionCard'
import type { JiraSite, OrgIntegration, UserIntegration } from 'shared'

export default function Integrations() {
  const { t } = useTranslation()
  usePageMeta({ title: t('integrations.titlePage'), noIndex: true })
  const [params, setParams] = useSearchParams()

  const [orgs, setOrgs] = useState<MyOrgRow[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([])
  const [orgIntegrations, setOrgIntegrations] = useState<OrgIntegration[]>([])
  const [siteSelection, setSiteSelection] = useState<{ key: string; sites: JiraSite[] } | null>(null)
  const [slackPin, setSlackPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    const provider = params.get('provider')
    if (code && state && provider) {
      if (provider === 'jira' || provider === 'github') {
        handleOAuthCallback(code, state, provider).then(() => {
          params.delete('code'); params.delete('state'); params.delete('provider')
          setParams(params, { replace: true })
        })
      }
    }
  }, [])

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    if (activeOrgId) loadData()
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

  async function loadData() {
    if (!activeOrgId) return
    try {
      const [u, o] = await Promise.all([
        listUserIntegrations(),
        listOrgIntegrations(activeOrgId),
      ])
      setUserIntegrations(u ?? [])
      setOrgIntegrations(o ?? [])
    } catch (err) {
      console.error(err)
    }
  }

  async function handleOAuthCallback(code: string, state: string, provider: string) {
    try {
      if (provider === 'jira') {
        const r = await confirmJiraOAuth({ code, state })
        if (r.requiresSiteSelection && r.key) {
          const { sites } = await getJiraSites(r.key)
          setSiteSelection({ key: r.key, sites })
        }
      } else if (provider === 'github') {
        await confirmGithubOAuth(code, state)
      } else {
        // Unknown provider — surface a clear error rather than silently
        // dropping the OAuth code.
        setError(`Unknown OAuth provider: ${provider}`)
        return
      }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSelectSite(cloudId: string) {
    if (!siteSelection) return
    try {
      await selectJiraSite(siteSelection.key, cloudId)
      setSiteSelection(null)
      await loadData()
      setInfo(t('integrations.jiraConnected'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleConnectJira() {
    try {
      const { authUrl } = await startJiraConnect(activeOrgId ?? undefined)
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleConnectGithub() {
    try {
      const { authUrl } = await startGithubConnect()
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleConnectOrgJira() {
    if (!activeOrgId) return
    try {
      const { authUrl } = await startOrgJiraConnect(activeOrgId)
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleConnectOrgSlack() {
    if (!activeOrgId) return
    try {
      const { authUrl } = await startOrgSlackConnect(activeOrgId)
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleConnectGithubApp() {
    if (!activeOrgId) return
    try {
      const { authUrl } = await startGithubAppConnect(activeOrgId)
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDisconnectUser(provider: string) {
    try {
      await disconnectUserIntegration(provider as 'jira' | 'github')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDisconnectOrg(provider: string) {
    if (!activeOrgId) return
    try {
      await disconnectOrgIntegration(activeOrgId, provider as 'slack' | 'github_app' | 'jira')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleConfirmOrgJiraCallback() {
    if (!activeOrgId) return
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) return
    try {
      const r = await confirmOrgJiraOAuth(activeOrgId, code, state)
      setInfo(t('integrations.jiraWebhookHint', { url: r.webhookUrl }))
      params.delete('code'); params.delete('state'); params.delete('provider')
      setParams(params, { replace: true })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    if (params.get('code') && params.get('state') && activeOrgId) {
      const provider = params.get('provider')
      if (provider === 'jira_org') handleConfirmOrgJiraCallback()
      else if (provider === 'slack_org') handleConfirmOrgSlackCallback()
    }
  }, [activeOrgId])

  async function handleConfirmOrgSlackCallback() {
    if (!activeOrgId) return
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) return
    try {
      await confirmOrgSlackOAuth(code, state)
      setInfo(t('integrations.slackOrgConnected'))
      params.delete('code'); params.delete('state'); params.delete('provider')
      setParams(params, { replace: true })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const jiraConnected = userIntegrations.some((i) => i.provider === 'jira')
  const githubConnected = userIntegrations.some((i) => i.provider === 'github')
  const orgJiraConnected = orgIntegrations.some((i) => i.provider === 'jira' && i.is_active)
  const orgSlackConnected = orgIntegrations.some((i) => i.provider === 'slack' && i.is_active)
  const orgGithubAppConnected = orgIntegrations.some((i) => i.provider === 'github_app' && i.is_active)

  async function handleSlackPinConfirm() {
    if (!slackPin.trim()) return
    try {
      await confirmSlackLinkPin({ code: slackPin.trim() })
      setSlackPin('')
      setInfo(t('integrations.slackLinked'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (loading) return <div className="text-gray-400">{t('common.loading')}</div>

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white">{t('integrations.titlePage')}</h1>
      {error && <p className="text-red-300 text-sm">{error}</p>}
      {info && <p className="text-emerald-300 text-sm">{info}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          {t('integrations.userConnections')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConnectionCard
            title="JIRA"
            description={t('integrations.jiraDesc')}
            provider="jira"
            scope="user"
            connected={jiraConnected}
            onConnect={handleConnectJira}
            onDisconnect={() => handleDisconnectUser('jira')}
          />
          <ConnectionCard
            title="GitHub"
            description={t('integrations.githubDesc')}
            provider="github"
            scope="user"
            connected={githubConnected}
            onConnect={handleConnectGithub}
            onDisconnect={() => handleDisconnectUser('github')}
          />
        </div>
      </section>

      {orgs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              {t('integrations.orgConnections')}
            </h2>
            <select
              value={activeOrgId ?? ''}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white"
            >
              {orgs.map((o) => (
                <option key={o.org_id} value={o.org_id}>
                  {o.organizations?.name ?? o.org_id}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConnectionCard
              title="JIRA (org)"
              description={t('integrations.jiraOrgDesc')}
              provider="jira"
              scope="org"
              connected={orgJiraConnected}
              onConnect={handleConnectOrgJira}
              onDisconnect={() => handleDisconnectOrg('jira')}
            />
            <ConnectionCard
              title="Slack"
              description={t('integrations.slackOrgDesc')}
              provider="slack"
              scope="org"
              connected={orgSlackConnected}
              onConnect={handleConnectOrgSlack}
              onDisconnect={() => handleDisconnectOrg('slack')}
            />
            <ConnectionCard
              title="GitHub App"
              description={t('integrations.githubAppDesc')}
              provider="github_app"
              scope="org"
              connected={orgGithubAppConnected}
              onConnect={handleConnectGithubApp}
              onDisconnect={() => handleDisconnectOrg('github_app')}
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          {t('integrations.slackPinTitle')}
        </h2>
        <div className="glass rounded-2xl p-5 space-y-3">
          <p className="text-sm text-gray-300">
            {t('integrations.slackPinHint')}
          </p>
          <div className="flex gap-2">
            <input
              value={slackPin}
              onChange={(e) => setSlackPin(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="w-32 rounded bg-white/5 border border-white/10 px-3 py-2 text-white text-center font-mono tracking-widest"
            />
            <button
              onClick={handleSlackPinConfirm}
              disabled={!slackPin.trim()}
              className="px-4 py-2 rounded bg-indigo-500 text-white disabled:opacity-50"
            >
              {t('integrations.slackPinConfirm')}
            </button>
          </div>
        </div>
      </section>

      {siteSelection && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl p-6 max-w-md w-full space-y-3">
            <h2 className="text-lg font-bold text-white">
              {t('integrations.selectJiraSite')}
            </h2>
            <ul className="space-y-2">
              {siteSelection.sites.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => handleSelectSite(s.id)}
                    className="w-full text-left rounded-lg bg-white/5 hover:bg-white/10 px-3 py-2"
                  >
                    <p className="text-white text-sm">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.url}</p>
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setSiteSelection(null)}
              className="text-sm text-gray-400 hover:text-white"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
