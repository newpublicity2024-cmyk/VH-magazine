// PAYLOAD_SECRET for step 5 (Payload refuses to start without one; password hashes do not use it).
import 'dotenv/config'
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import pg from 'pg'

/**
 * LAUNCH.md step 3 — replace a target database with the migrated archive (local vh_migration).
 *
 *   TARGET_DATABASE_URL=<postgres url> \
 *     pnpm tsx src/migrate/push-archive.ts --confirm <target host> [--admin-file production-admin.txt]
 *
 * Needs the user's go-ahead for the real target (Neon branch `production`): it replaces EVERY
 * table there. Rehearsed against a local copy by scripts/verify-push-archive.mjs.
 *
 *   1. Refuses: a target that is one of the two local working databases, a --confirm that is not
 *      the target's host name, a source whose applied migrations differ from this repo's.
 *   2. pg_dump of vh_migration (custom format, no owners or grants) into a temporary folder.
 *   3. pg_restore --clean --if-exists --single-transaction: the target is either fully replaced
 *      or, on any error, left exactly as it was.
 *   4. Verifies every public table's row count and the applied migrations against the source.
 *   5. With --admin-file (lines `email=` and `password=`, as production-admin.txt), creates that
 *      account as an admin through Payload, so the site keeps a working login — vh_migration has
 *      no users. Other accounts: create-accounts.ts, once the owner names them.
 * The target URL and any password are never printed.
 */

const SOURCE = 'postgres://localhost/vh_migration'
const LOCAL_WORKING = new Set(['vh_migration', 'vh_magazine'])

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

/** Applied migration names, in order, and the row count of every public base table. */
async function snapshot(url: string) {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try {
    const migrations = (await c.query('select name from payload_migrations order by id')).rows.map((r) => r.name as string)
    const tables = (
      await c.query(`select table_name from information_schema.tables
                      where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)
    ).rows.map((r) => r.table_name as string)
    const counts: Record<string, number> = {}
    for (const t of tables) counts[t] = Number((await c.query(`select count(*) from "${t}"`)).rows[0].count)
    return { migrations, counts }
  } finally {
    await c.end()
  }
}

function repoMigrations(): string[] {
  const index = readFileSync(path.resolve(import.meta.dirname, '..', 'migrations', 'index.ts'), 'utf8')
  return [...index.matchAll(/name: '([^']+)'/g)].map((m) => m[1])
}

async function main() {
  const target = process.env.TARGET_DATABASE_URL
  if (!target) throw new Error('TARGET_DATABASE_URL is not set')
  const t = new URL(target)
  const targetDb = t.pathname.slice(1)
  if (['localhost', '127.0.0.1', '::1'].includes(t.hostname) && LOCAL_WORKING.has(targetDb)) {
    throw new Error(`refusing: the target is the local working database "${targetDb}"`)
  }
  if (arg('confirm') !== t.hostname) {
    throw new Error(`refusing: pass --confirm <the target's host name> (got ${JSON.stringify(arg('confirm') ?? null)})`)
  }

  const source = await snapshot(SOURCE)
  const repo = repoMigrations()
  if (source.migrations.join() !== repo.join()) {
    throw new Error(`refusing: vh_migration has migrations [${source.migrations}] but the repo has [${repo}] — run pnpm migrate on it first`)
  }
  let adminEmail: string | undefined
  let adminPassword: string | undefined
  const adminFile = arg('admin-file')
  if (adminFile) {
    const kv = Object.fromEntries(
      readFileSync(adminFile, 'utf8')
        .split('\n')
        .filter((l) => /^\w+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
    )
    adminEmail = kv.email
    adminPassword = kv.password
    if (!adminEmail || !adminPassword || adminPassword.length < 16) throw new Error(`${adminFile} needs email= and a password= of 16+ characters`)
  }

  const before = await snapshot(target).catch(() => null)
  console.log(
    `target ${t.hostname}/${targetDb}: ${before ? `${before.counts.articles ?? 0} articles, ${before.counts.users ?? 0} users` : 'empty or unreadable'}` +
      ` → ${source.counts.articles} articles, ${source.counts.media} media, ${source.counts.magazine_issues} issues, ${source.counts.redirects} redirects`,
  )

  const dir = mkdtempSync(path.join(os.tmpdir(), 'vh-push-'))
  const dump = path.join(dir, 'vh_migration.dump')
  try {
    execFileSync('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${dump}`, SOURCE], { stdio: 'inherit' })
    console.log(`dumped vh_migration (${(readFileSync(dump).length / 1e6).toFixed(1)} MB); restoring in one transaction…`)
    execFileSync(
      'pg_restore',
      ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--single-transaction', '--exit-on-error', `--dbname=${target}`, dump],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  const after = await snapshot(target)
  const diffs = Object.keys({ ...source.counts, ...after.counts }).filter((k) => source.counts[k] !== after.counts[k])
  if (after.migrations.join() !== source.migrations.join()) throw new Error(`migrations differ after restore: [${after.migrations}]`)
  if (diffs.length) throw new Error(`row counts differ after restore: ${diffs.map((k) => `${k} ${source.counts[k]}→${after.counts[k]}`).join(', ')}`)
  console.log(`restored: ${Object.keys(after.counts).length} tables, every row count equal to vh_migration; migrations equal`)

  if (adminEmail && adminPassword) {
    // Payload reads DATABASE_URL when its config module loads, so set it before the import.
    process.env.DATABASE_URL = target
    const { getPayload } = await import('payload')
    const { default: config } = await import('../payload.config')
    const payload = await getPayload({ config })
    const existing = await payload.find({ collection: 'users', where: { email: { equals: adminEmail } }, limit: 1, overrideAccess: true })
    if (existing.docs.length) {
      await payload.update({ collection: 'users', id: existing.docs[0].id, data: { password: adminPassword, role: 'admin' }, overrideAccess: true })
    } else {
      await payload.create({ collection: 'users', data: { email: adminEmail, password: adminPassword, name: 'Administrateur', role: 'admin' }, overrideAccess: true })
    }
    await payload.login({ collection: 'users', data: { email: adminEmail, password: adminPassword } })
    console.log(`admin ${adminEmail} present and able to log in`)
  }
  console.log('push finished')
  process.exit(0)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
