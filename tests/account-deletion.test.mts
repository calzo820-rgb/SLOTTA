import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  canCancelDeletion,
  matchesTenantName,
} from '../src/lib/accountDeletion.ts'

test('requires the complete tenant name while ignoring harmless casing and spacing', () => {
  assert.equal(matchesTenantName('  Studio Demo ', 'STUDIO DEMO'), true)
  assert.equal(matchesTenantName('Studio', 'Studio Demo'), false)
  assert.equal(matchesTenantName('', ''), false)
})

test('allows cancellation only before a scheduled deletion', () => {
  const now = Date.parse('2026-09-08T09:00:00.000Z')
  assert.equal(canCancelDeletion('scheduled', '2026-10-08T09:00:00.000Z', now), true)
  assert.equal(canCancelDeletion('scheduled', '2026-09-08T08:59:59.000Z', now), false)
  assert.equal(canCancelDeletion('cancelled', '2026-10-08T09:00:00.000Z', now), false)
  assert.equal(ACCOUNT_DELETION_GRACE_DAYS, 30)
})

test('keeps deletion requests server-only and enforces one active request', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20260908095859_add_tenant_deletion_requests.sql', import.meta.url),
    'utf8',
  )
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /revoke all.*anon, authenticated/i)
  assert.match(migration, /where status = 'scheduled'/i)
  assert.match(migration, /interval '30 days'/i)
})

test('requires an authenticated owner and server-side tenant-name verification', () => {
  const route = readFileSync(
    new URL('../src/app/api/admin/account-deletion/route.ts', import.meta.url),
    'utf8',
  )
  assert.match(route, /membership\.role !== 'owner'/)
  assert.match(route, /readJsonBody\(request, 4_096\)/)
  assert.match(route, /matchesTenantName\(confirmation, tenant\.name\)/)
  assert.match(route, /export_acknowledged === true/)
  assert.match(route, /\.eq\('tenant_id', context\.membership\.tenant_id\)/)
})
