/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_API_URL: string
  // PostHog Analytics
  readonly VITE_PUBLIC_POSTHOG_PROJECT_TOKEN: string
  readonly VITE_PUBLIC_POSTHOG_HOST: string
  // Legacy PostHog keys (backward compatible)
  readonly VITE_POSTHOG_KEY: string
  readonly VITE_POSTHOG_HOST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
