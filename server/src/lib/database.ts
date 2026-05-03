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

export const isDatabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey)

if (!isDatabaseConfigured) {
    console.error('Missing database environment variables:')
    if (!supabaseUrl) {
        console.error(' - Set SUPABASE_URL (or VITE_SUPABASE_URL)')
    }
    if (!supabaseServiceKey) {
        console.error(' - Set SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY')
    }
    console.error('Continuing startup without database. API routes will fail until env vars are set.')
}

export const runtimeSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co'
export const runtimeSupabaseKey = supabaseServiceKey || 'placeholder-key'

// Database client for Supabase Postgres (data only, not auth)
export const supabase = createClient(runtimeSupabaseUrl, runtimeSupabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
})
