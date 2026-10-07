import { NextResponse } from 'next/server'
import { enforceDistributedRateLimit } from '@/lib/apiGuard'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: Request) {
  const limited = await enforceDistributedRateLimit(request, 'municipality-search', 90, 60_000)
  if (limited) return limited

  const params = new URL(request.url).searchParams
  const query = (params.get('q') || '')
    .replace(/[^\p{L}\p{M}'’ -]/gu, '')
    .trim()
    .slice(0, 60)

  if (query.length < 2) {
    return NextResponse.json({ municipalities: [] })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('italian_municipalities')
    .select('code_istat, name, province_code, province_name, region_name')
    .ilike('name', `${query}%`)
    .order('name')
    .limit(25)

  if (error) {
    console.error('municipality search failed', { code: error.code })
    return NextResponse.json({ error: 'Impossibile caricare l’elenco dei comuni.' }, { status: 503 })
  }

  return NextResponse.json(
    { municipalities: data || [] },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  )
}
