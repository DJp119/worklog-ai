import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.tsx'

// PostHog configuration
const posthogApiKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN || import.meta.env.VITE_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || import.meta.env.VITE_POSTHOG_HOST

const posthogOptions = {
  api_host: posthogHost || 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: true,
  autocapture: true,
} as const

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider apiKey={posthogApiKey} options={posthogOptions}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PostHogProvider>
  </StrictMode>,
)