/**
 * client/src/components/integrations/OAuthButton.tsx
 *
 * Generic OAuth connect button. Window-popup flow that posts back the code.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface OAuthButtonProps {
  label: string
  start: () => Promise<{ authUrl: string }>
  onConnected?: () => void
  className?: string
}

export function OAuthButton({ label, start, onConnected, className }: OAuthButtonProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      const { authUrl } = await start()
      window.open(authUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => onConnected?.(), 1500)
    } catch (err) {
      console.error('OAuth start failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={className ?? 'px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50'}
    >
      {busy ? t('common.loading') : label}
    </button>
  )
}
