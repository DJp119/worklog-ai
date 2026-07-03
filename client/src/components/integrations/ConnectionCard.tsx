/**
 * client/src/components/integrations/ConnectionCard.tsx
 *
 * Card for a single integration (JIRA, GitHub, Slack) with connect/disconnect
 * button and status indicator. NEVER displays ciphertext.
 */
import { useTranslation } from 'react-i18next'

interface ConnectionCardProps {
  title: string
  description: string
  connected: boolean
  provider: 'jira' | 'github' | 'slack' | 'github_app'
  scope: 'user' | 'org'
  onConnect: () => void
  onDisconnect: () => void
  busy?: boolean
  extra?: React.ReactNode
}

const PROVIDER_COLORS: Record<ConnectionCardProps['provider'], string> = {
  jira: 'from-blue-500 to-cyan-500',
  github: 'from-gray-700 to-gray-900',
  github_app: 'from-gray-700 to-gray-900',
  slack: 'from-purple-500 to-pink-500',
}

export function ConnectionCard({
  title,
  description,
  connected,
  provider,
  scope,
  onConnect,
  onDisconnect,
  busy,
  extra,
}: ConnectionCardProps) {
  const { t } = useTranslation()
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {scope === 'org' ? t('integrations.orgScope') : t('integrations.userScope')}
          </p>
        </div>
        <div
          className={`h-10 w-10 rounded-lg bg-gradient-to-br ${PROVIDER_COLORS[provider]} flex items-center justify-center text-white font-bold`}
        >
          {title.charAt(0)}
        </div>
      </div>
      <p className="text-sm text-gray-300">{description}</p>
      {extra}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? 'bg-emerald-400' : 'bg-gray-500'
            }`}
          />
          <span className="text-xs text-gray-400">
            {connected ? t('integrations.connected') : t('integrations.notConnected')}
          </span>
        </div>
        {connected ? (
          <button
            onClick={onDisconnect}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {t('integrations.disconnect')}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50"
          >
            {t('integrations.connect')}
          </button>
        )}
      </div>
    </div>
  )
}
