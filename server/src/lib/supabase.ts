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
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
])

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables:')
  if (!supabaseUrl) {
    console.error('  - Set SUPABASE_URL (or VITE_SUPABASE_URL)')
  }
  if (!supabaseServiceKey) {
    console.error('  - Set SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)')
  }
  console.error('On Render, add these in Service > Environment before starting.')
  process.exit(1)
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
