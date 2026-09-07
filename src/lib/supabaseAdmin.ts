import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | undefined

function requireServerEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY') {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`)
  }

  return value
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createClient(
      requireServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireServerEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    )
  }

  return cachedClient
}
