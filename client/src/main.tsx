import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.tsx'

// PostHog initialization — call posthog.init() once at startup
const posthogApiKey =
  import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ||
  import.meta.env.VITE_POSTHOG_KEY

const posthogHost =
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
  import.meta.env.VITE_POSTHOG_HOST ||
  'https://us.i.posthog.com'

const startPosthog = () => {
  if (posthogApiKey) {
    posthog.init(posthogApiKey, {
      api_host: posthogHost,
      defaults: '2026-01-30',
      person_profiles: 'identified_only',
      capture_pageview: true,
      autocapture: true,
      loaded: (ph) => {
        if (import.meta.env.DEV) ph.debug()
      },
    })
  }
}
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(startPosthog)
} else {
  setTimeout(startPosthog, 1)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PostHogProvider>
  </StrictMode>,
)