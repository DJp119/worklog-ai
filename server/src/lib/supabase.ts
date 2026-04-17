import { createClient } from '@supabase/supabase-js'

let supabaseUrl = process.env.SUPABASE_URL
let supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// Fallback to .env file if not set in environment
if (!supabaseUrl || !supabaseServiceKey) {
  const dotenv = await import('dotenv')
  dotenv.config()
  supabaseUrl = process.env.SUPABASE_URL
  supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  console.error('Please check server/.env file')
  process.exit(1)
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
