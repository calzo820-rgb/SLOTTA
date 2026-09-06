import assert from 'node:assert/strict'
import test from 'node:test'
import { safeExportFilenamePart, TENANT_EXPORT_TABLES } from '../src/lib/dataExport.ts'

test('builds safe and readable export filename parts', () => {
  assert.equal(safeExportFilenamePart('Salone Èlite Milano'), 'salone-elite-milano')
  assert.equal(safeExportFilenamePart('../../segreto'), 'segreto')
  assert.equal(safeExportFilenamePart('!!!'), 'attivita')
})

test('exports durable tenant data but excludes temporary and secret-bearing tables', () => {
  assert.ok(TENANT_EXPORT_TABLES.includes('service_bookings'))
  assert.ok(TENANT_EXPORT_TABLES.includes('tenant_users'))
  assert.equal(TENANT_EXPORT_TABLES.some(table => table === 'service_booking_holds'), false)
  assert.equal(TENANT_EXPORT_TABLES.some(table => table === 'push_subscriptions'), false)
  assert.equal(TENANT_EXPORT_TABLES.some(table => table === 'tester_leads'), false)
})
