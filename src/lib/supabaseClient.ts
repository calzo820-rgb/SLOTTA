import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | undefined

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!cachedClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

    if (!url || !anonKey) {
      throw new Error('Missing required public Supabase environment variables')
    }

    cachedClient = createBrowserClient(url, anonKey)
  }

  return cachedClient
}

// Keep the existing client API without constructing the browser client while
// Next.js is importing modules for a credential-free build.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getSupabaseBrowserClient()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
