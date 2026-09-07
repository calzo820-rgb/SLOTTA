import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const nodeArgs = [
  '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
  '--experimental-strip-types',
  '--input-type=module',
]

test('imports the admin client module without credentials', () => {
  const result = spawnSync(
    process.execPath,
    [
      ...nodeArgs,
      '--eval',
      `delete process.env.NEXT_PUBLIC_SUPABASE_URL;
       delete process.env.SUPABASE_SERVICE_ROLE_KEY;
       await import('./src/lib/supabaseAdmin.ts');`,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )

  assert.equal(result.status, 0, result.stderr)
})

test('imports the browser client module without credentials', () => {
  const result = spawnSync(
    process.execPath,
    [
      ...nodeArgs,
      '--eval',
      `delete process.env.NEXT_PUBLIC_SUPABASE_URL;
       delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
       await import('./src/lib/supabaseClient.ts');`,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )

  assert.equal(result.status, 0, result.stderr)
})

test('reports the missing credential only when the admin client is requested', () => {
  const result = spawnSync(
    process.execPath,
    [
      ...nodeArgs,
      '--eval',
      `delete process.env.NEXT_PUBLIC_SUPABASE_URL;
       delete process.env.SUPABASE_SERVICE_ROLE_KEY;
       const { getSupabaseAdmin } = await import('./src/lib/supabaseAdmin.ts');
       try {
         getSupabaseAdmin();
         process.exit(2);
       } catch (error) {
         if (!(error instanceof Error) || !error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
           throw error;
         }
       }`,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )

  assert.equal(result.status, 0, result.stderr)
})

test('imports the email client module without credentials', () => {
  const result = spawnSync(
    process.execPath,
    [
      ...nodeArgs,
      '--eval',
      `delete process.env.RESEND_API_KEY;
       const { getResend } = await import('./src/lib/resendClient.ts');
       try {
         getResend();
         process.exit(2);
       } catch (error) {
         if (!(error instanceof Error) || !error.message.includes('RESEND_API_KEY')) {
           throw error;
         }
       }`,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )

  assert.equal(result.status, 0, result.stderr)
})
