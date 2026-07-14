import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initAnalytics } from './lib/analytics'
import './i18n'
import './index.css'
import App from './App.tsx'

const posthogApiKey =
  import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ||
  import.meta.env.VITE_POSTHOG_KEY

const posthogHost =
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
  import.meta.env.VITE_POSTHOG_HOST ||
  'https://us.i.posthog.com'

const startPosthog = () => {
  initAnalytics(posthogApiKey, posthogHost).catch(() => {})
}
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(startPosthog)
} else {
  setTimeout(startPosthog, 1)
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('ServiceWorker registration failed: ', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
