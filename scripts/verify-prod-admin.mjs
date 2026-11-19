/**
 * GATES-FINISH F3 — the production admin credential was rotated (2026-11-19).
 *
 * The seed's default password (admin@vh.ma / vhmagazine) is written in CLAUDE.md, in a public
 * GitHub repository, and worked on the public production alias. Measured against --base:
 *   - the rotated credential, read from production-admin.txt (gitignored, mode 600), logs in
 *     (200) — the control that shows the login endpoint itself works;
 *   - the default password is refused (401), and the rotated one logs in again afterwards, which
 *     resets Payload's failed-login count (5 failures lock the account for 10 minutes);
 *   - production-admin.txt is ignored by git and readable by its owner only.
 * Neither password nor token is printed.
 */
import { readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { ROOT, fail, ok } from './lib/harness.mjs'

const i = process.argv.indexOf('--base')
const BASE = (i > -1 ? process.argv[i + 1] : fail('--base is required')).replace(/\/+$/, '')
const file = path.join(ROOT, 'production-admin.txt')
const kv = Object.fromEntries(
  readFileSync(file, 'utf8').split('\n').filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
if ((statSync(file).mode & 0o077) !== 0) fail('production-admin.txt is readable by others than its owner')
try {
  execFileSync('git', ['check-ignore', '-q', 'production-admin.txt'], { cwd: ROOT })
} catch {
  fail('production-admin.txt is not ignored by git')
}
const login = async (email, password) => {
  const r = await fetch(`${BASE}/api/users/login/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, locked: /verrouill|locked/i.test(JSON.stringify(j.errors ?? '')) }
}
// Order matters: Payload locks an account for 10 minutes after 5 failed logins, and a success
// resets the count. So: rotated (proves the account works, resets), the one deliberate failure,
// rotated again (resets) — the check leaves no failed attempt behind.
const before = await login(kv.email, kv.password)
if (before.locked) fail('the admin account is locked (too many failed logins) — retry after 10 minutes')
if (before.status !== 200) fail(`the rotated credential answered ${before.status}`)
const dflt = await login('admin@vh.ma', 'vhmagazine')
const after = await login(kv.email, kv.password)
if (dflt.status !== 401) fail(`the public default password answered ${dflt.status}`)
if (after.status !== 200) fail(`the rotated credential answered ${after.status} after the default-password attempt`)
console.error(`  ${BASE}: rotated credential 200, default password 401, rotated again 200 (failed-login count reset)`)
ok('PROD_ADMIN_OK')
