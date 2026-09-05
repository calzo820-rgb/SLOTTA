import assert from 'node:assert/strict'
import test from 'node:test'
import { safeInternalPath } from '../src/lib/navigation.ts'

test('keeps valid internal login redirects', () => {
  assert.equal(safeInternalPath('/admin/services?tab=active', '/admin'), '/admin/services?tab=active')
})

test('rejects absolute and protocol-relative login redirects', () => {
  assert.equal(safeInternalPath('https://example.com', '/admin'), '/admin')
  assert.equal(safeInternalPath('//example.com/path', '/admin'), '/admin')
  assert.equal(safeInternalPath(null, '/admin'), '/admin')
})
