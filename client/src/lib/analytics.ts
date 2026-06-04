import type posthogNs from 'posthog-js'

let ph: typeof posthogNs | null = null

export const posthog = {
  init: (...args: Parameters<typeof posthogNs.init>) => ph?.init(...args),
  identify: (...args: Parameters<typeof posthogNs.identify>) => ph?.identify(...args),
  reset: (...args: Parameters<typeof posthogNs.reset>) => ph?.reset(...args),
  capture: (...args: Parameters<typeof posthogNs.capture>) => ph?.capture(...args),
  isFeatureEnabled: (...args: Parameters<typeof posthogNs.isFeatureEnabled>) => ph?.isFeatureEnabled(...args),
} as Pick<typeof posthogNs, 'init' | 'identify' | 'reset' | 'capture' | 'isFeatureEnabled'>

let initPromise: Promise<void> | null = null

export function initAnalytics(apiKey: string, host: string): Promise<void> {
  if (!apiKey) return Promise.resolve()
  if (initPromise) return initPromise
  initPromise = import('posthog-js').then((mod) => {
    ph = mod.default
    ph.init(apiKey, {
      api_host: host,
      defaults: '2026-01-30',
      person_profiles: 'identified_only',
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
    })
  })
  return initPromise
}
