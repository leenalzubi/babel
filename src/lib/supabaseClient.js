import { createClient } from '@supabase/supabase-js'

function trimEnv(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const supabaseUrl = trimEnv(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = trimEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

/**
 * `null` when URL or anon key is missing: avoids crashing the app at import time.
 * @type {import('@supabase/supabase-js').SupabaseClient | null}
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null
