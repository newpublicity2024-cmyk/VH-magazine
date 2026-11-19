/**
 * GATES-FINISH F7 — the LAUNCH.md step-3 push (src/migrate/push-archive.ts), rehearsed locally.
 *
 * Targets are scratch copies of vh_magazine — a seeded database shaped like the Neon production
 * branch today — and are always dropped. Nothing leaves this machine.
 *   1. refusals: --confirm naming another host, and a local working database as target;
 *   2. atomicity control: a target holding a view on `articles` makes `--clean` fail midway; the
 *      push must exit non-zero and leave every table of the target exactly as it was;
 *   3. the real rehearsal: every public table's row count equals vh_migration's (counted here,
 *      independently of the push's own check), article slugs and redirects fingerprint equal to
 *      the source's (no seed row survives), the admin from the
 *      --admin-file is the only user, and body search answers on the restored data.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { ROOT, fail, ok } from './lib/harness.mjs'

const stamp = `${process.pid}_${Date.now()}`
const dbs = [`vh_push_ctl_${stamp}`, `vh_push_rehearsal_${stamp}`]
const tmp = mkdtempSync(path.join(os.tmpdir(), 'vh-push-verify-'))
const cleanup = () => {
  for (const d of dbs) spawnSync('dropdb', ['--if-exists', d])
  rmSync(tmp, { recursive: true, force: true })
}
process.on('exit', cleanup)

const counts = async (db) => {
  const c = new pg.Client({ connectionString: `postgres://localhost/${db}` })
  await c.connect()
  const tables = (await c.query(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)).rows.map((r) => r.table_name)
  const out = {}
  for (const t of tables) out[t] = Number((await c.query(`select count(*) from "${t}"`)).rows[0].count)
  await c.end()
  return out
}
const push = (target, confirm, extra = []) =>
  spawnSync('pnpm', ['-s', 'exec', 'tsx', 'src/migrate/push-archive.ts', '--confirm', confirm, ...extra], {
    cwd: ROOT,
    env: { ...process.env, TARGET_DATABASE_URL: `postgres://localhost/${target}`, NODE_OPTIONS: '--no-deprecation' },
    encoding: 'utf8',
  })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 1. refusals
let r = push(dbs[1], 'not-this-host')
if (r.status === 0 || !/refusing: pass --confirm/.test(r.stderr + r.stdout)) fail(`a wrong --confirm was not refused: ${r.stderr}`)
r = push('vh_magazine', 'localhost')
if (r.status === 0 || !/refusing: the target is the local working database/.test(r.stderr + r.stdout)) fail('vh_magazine as target was not refused')

// 2. atomicity control
execFileSync('createdb', ['-T', 'vh_magazine', dbs[0]])
execFileSync('psql', ['-X', '-q', '-d', dbs[0], '-c', 'create view vh_push_blocker as select id from articles'])
const ctlBefore = await counts(dbs[0])
r = push(dbs[0], 'localhost')
if (r.status === 0) fail('control: a restore that cannot drop `articles` still reported success')
const ctlAfter = await counts(dbs[0])
if (!same(ctlBefore, ctlAfter)) fail('control: a failed push changed the target — the restore is not atomic')
console.error(`  control: failed push left the target unchanged (${ctlAfter.articles} seed articles)`)

// 3. rehearsal
execFileSync('createdb', ['-T', 'vh_magazine', dbs[1]])
const adminFile = path.join(tmp, 'admin.txt')
const email = `push-rehearsal-${stamp}@vh.invalid`
writeFileSync(adminFile, `email=${email}\npassword=${randomBytes(18).toString('base64url')}\n`, { mode: 0o600 })
r = push(dbs[1], 'localhost', ['--admin-file', adminFile])
if (r.status !== 0) fail(`push failed: ${(r.stderr || r.stdout).slice(-800)}`)
const source = await counts('vh_migration')
const target = await counts(dbs[1])
const diffs = Object.keys({ ...source, ...target }).filter((k) => k !== 'users' && !k.startsWith('users_') && source[k] !== target[k])
if (diffs.length) fail(`row counts differ from vh_migration: ${diffs.map((k) => `${k} ${source[k]}→${target[k]}`).join(', ')}`)
const c = new pg.Client({ connectionString: `postgres://localhost/${dbs[1]}` })
await c.connect()
const users = (await c.query('select email, role, length(hash) as h from users')).rows
const FP = `select md5(string_agg(slug, ',' order by slug)) as a,
                   (select md5(string_agg("from" || '>' || "to", ',' order by "from")) from redirects) as r from articles`
const fpTarget = (await c.query(FP)).rows[0]
const searchHits = Number((await c.query(`select count(*) from articles where search_vector @@ websearch_to_tsquery('french', vh_immutable_unaccent('Handibasket'))`)).rows[0].count)
await c.end()
const s = new pg.Client({ connectionString: 'postgres://localhost/vh_migration' })
await s.connect()
const fpSource = (await s.query(FP)).rows[0]
await s.end()
if (users.length !== 1 || users[0].email !== email || users[0].role !== 'admin' || !(users[0].h > 100)) fail(`users after push: ${JSON.stringify(users)}`)
if (!same(fpTarget, fpSource)) fail('the restored article slugs or redirects differ from vh_migration — seed rows survived?')
if (searchHits < 1) fail('body search finds nothing on the restored data')
console.error(`  rehearsal: ${Object.keys(target).length} tables equal to vh_migration (${target.articles} articles, ${target.media} media, ${target.magazine_issues} issues, ${target.redirects} redirects); 1 admin; body search answers`)
ok('PUSH_REHEARSAL_OK')
