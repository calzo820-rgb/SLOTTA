import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL(
    '../supabase/migrations/20260906153835_harden_public_data_api.sql',
    import.meta.url,
  ),
  'utf8',
)
const bookingPage = readFileSync(
  new URL('../src/components/ServiceBookingPageClient.tsx', import.meta.url),
  'utf8',
)

test('removes anonymous database access and direct booking inserts', () => {
  assert.match(migration, /drop policy if exists service_bookings_public_insert/i)
  assert.match(
    migration,
    /revoke all privileges on all tables in schema public from anon/i,
  )
  assert.match(migration, /create policy service_bookings_member_insert/i)
})

test('loads public booking configuration through the server API', () => {
  assert.match(bookingPage, /fetch\('\/api\/public\/booking-config'/)
  assert.doesNotMatch(bookingPage, /\.from\('tenant_settings'\)/)
  assert.doesNotMatch(bookingPage, /\.from\('staff_hours'\)/)
  assert.doesNotMatch(bookingPage, /\.from\('closures'\)/)
})
