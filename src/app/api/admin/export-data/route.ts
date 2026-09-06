import { NextResponse } from 'next/server'
import { getMyMembership } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  safeExportFilenamePart,
  TENANT_EXPORT_TABLES,
  type TenantExportTable,
} from '@/lib/dataExport'

const PAGE_SIZE = 1_000
const MAX_ROWS_PER_TABLE = 100_000

async function readTenantTable(table: TenantExportTable, tenantId: string) {
  const rows: Record<string, unknown>[] = []

  for (let from = 0; from < MAX_ROWS_PER_TABLE; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq(table === 'tenants' ? 'id' : 'tenant_id', tenantId)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as Record<string, unknown>[]
    rows.push(...page)

    if (page.length < PAGE_SIZE) return rows
  }

  throw new Error(`Export limit reached for ${table}`)
}

export async function GET() {
  try {
    const membership = await getMyMembership()

    if (!membership) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
    }
    if (membership.role !== 'owner') {
      return NextResponse.json({ error: 'Operazione riservata al proprietario.' }, { status: 403 })
    }

    const results = await Promise.all(
      TENANT_EXPORT_TABLES.map(table => readTenantTable(table, membership.tenant_id)),
    )
    const data = Object.fromEntries(
      TENANT_EXPORT_TABLES.map((table, index) => [table, results[index]]),
    )
    const tenant = results[0][0]
    const slug = safeExportFilenamePart(String(tenant?.slug || tenant?.name || 'attivita'))
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(
      JSON.stringify(
        {
          format: 'slotta-tenant-export',
          version: 1,
          generated_at: new Date().toISOString(),
          tenant_id: membership.tenant_id,
          data,
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="slotta-${slug}-${date}.json"`,
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    )
  } catch (error) {
    console.error('tenant data export failed', error)
    return NextResponse.json(
      { error: 'Non è stato possibile preparare l’esportazione.' },
      { status: 500 },
    )
  }
}
