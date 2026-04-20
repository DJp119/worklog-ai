import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

function firstDefined(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim().length > 0) {
      return value
    }
  }
  return undefined
}

const supabaseUrl = firstDefined(['SUPABASE_URL', 'VITE_SUPABASE_URL'])
const supabaseServiceKey = firstDefined([
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
])
const supabaseAnonKey = firstDefined([
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
])

export const isSupabaseConfigured = Boolean(supabaseUrl && (supabaseServiceKey || supabaseAnonKey))
export const canRunReminderJobs = Boolean(supabaseUrl && supabaseServiceKey)

if (!isSupabaseConfigured) {
  console.error('Missing Supabase environment variables:')
  if (!supabaseUrl) {
    console.error('  - Set SUPABASE_URL (or VITE_SUPABASE_URL)')
  }
  if (!supabaseServiceKey && !supabaseAnonKey) {
    console.error('  - Set SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY')
  }
  console.error('Continuing startup without Supabase. API routes depending on Supabase will fail until env vars are set.')
}

const runtimeSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co'
const runtimeSupabaseKey = supabaseServiceKey || supabaseAnonKey || 'placeholder-key'

export const supabase = createClient(runtimeSupabaseUrl, runtimeSupabaseKey)

export function getSupabaseClient(accessToken?: string) {
  return createClient(runtimeSupabaseUrl, runtimeSupabaseKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
