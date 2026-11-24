/**
 * GATES-ARCHIVE A2 — after LAUNCH.md step 3, the target database holds exactly the archive.
 *
 *   node scripts/verify-archive-pushed.mjs --target-env vercel-production-env.txt \
 *        [--admin-file production-admin.txt]
 *
 * The target URL is DATABASE_URL in --target-env (the file the Vercel production env was set
 * from); it is never printed, only its host. Source: postgres://localhost/vh_migration.
 *
 * push-archive.ts checks row counts; this compares CONTENT, independently of it:
 *   - every public base table exists on both sides and, row by row, hashes the same — each row as
 *     to_jsonb (UTC), minus the two columns that legitimately drift: articles.view_count (any
 *     browser visit to the live alias increments it) and the generated search_vector (recomputed
 *     on restore by the target server's own stemmer);
 *   - the account tables (users, sessions, preferences, document locks) are excluded: the push
 *     re-creates the admin there, and logins write sessions. Instead the target must hold exactly
 *     one user, an admin, with the --admin-file email;
 *   - control: the comparator, run on the source against itself with one field of one article
 *     altered (same row counts), must report that table — so equality below is not blindness.
 * Nothing is written to either database.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { fail, ok } from './lib/harness.mjs'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i > -1 ? argv[i + 1] : fallback
}
const SOURCE = 'postgres://localhost/vh_migration'
const envFile = arg('target-env') ?? fail('--target-env is required')
const adminFile = arg('admin-file', 'production-admin.txt')

const kv = (file) =>
  Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => /^\w+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
  )
const target = kv(envFile).DATABASE_URL ?? fail(`${envFile} has no DATABASE_URL`)
const targetHost = new URL(target).hostname
if (['localhost', '127.0.0.1', '::1'].includes(targetHost)) fail('the target is a local database')
const adminEmail = kv(adminFile).email ?? fail(`${adminFile} has no email=`)

const ACCOUNT_TABLES = new Set([
  'users',
  'users_sessions',
  'payload_preferences',
  'payload_preferences_rels',
  'payload_locked_documents',
  'payload_locked_documents_rels',
])
const DRIFTING = { articles: ['view_count', 'search_vector'] }

async function connect(url) {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  await c.query(`set time zone 'UTC'`)
  return c
}

/** {table: {rows, hash}} for every public base table; `perturb` alters one row of one table. */
async function fingerprint(c, perturb) {
  const tables = (
    await c.query(`select table_name from information_schema.tables
                    where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)
  ).rows.map((r) => r.table_name)
  const out = {}
  for (const t of tables) {
    if (ACCOUNT_TABLES.has(t)) continue
    let row = `to_jsonb(t)${(DRIFTING[t] ?? []).map((col) => ` - '${col}'`).join('')}`
    if (perturb?.table === t) {
      row = `case when t.id = (select min(id) from "${t}") then jsonb_set(${row}, '{${perturb.field}}', '"control"') else ${row} end`
    }
    const r = await c.query(
      `select count(*)::int as rows, coalesce(md5(string_agg(h, '' order by h)), '') as hash
         from (select md5((${row})::text) as h from "${t}" t) x`,
    )
    out[t] = r.rows[0]
  }
  return out
}

const differing = (a, b) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .filter((t) => !a[t] || !b[t] || a[t].rows !== b[t].rows || a[t].hash !== b[t].hash)
    .map((t) => `${t} (${a[t]?.rows ?? 'absent'} rows vs ${b[t]?.rows ?? 'absent'})`)

const src = await connect(SOURCE)
const dst = await connect(target)
try {
  const source = await fingerprint(src)

  // Control: same database, same counts, one title changed — must be reported, and only it.
  const altered = await fingerprint(src, { table: 'articles', field: 'title' })
  const caught = differing(source, altered)
  if (caught.length !== 1 || !caught[0].startsWith('articles ')) {
    fail(`control: one altered article title was reported as [${caught.join(', ')}]`)
  }

  const pushed = await fingerprint(dst)
  const diffs = differing(source, pushed)
  if (diffs.length) fail(`${targetHost}: ${diffs.length} tables differ from vh_migration: ${diffs.join('; ')}`)

  const users = (await dst.query('select email, role from users order by id')).rows
  if (users.length !== 1 || users[0].email !== adminEmail || users[0].role !== 'admin') {
    fail(`${targetHost}: users are [${users.map((u) => `${u.role}`).join(', ')}] — expected exactly the admin from ${adminFile}`)
  }

  const n = Object.keys(source).length
  console.log(
    `${targetHost}: ${n} tables equal to vh_migration row by row ` +
      `(${source.articles.rows} articles, ${source.media.rows} media, ${source.magazine_issues.rows} issues, ` +
      `${source.redirects.rows} redirects; view_count/search_vector and ${ACCOUNT_TABLES.size} account tables excluded); ` +
      `1 user, the admin; control: an altered title was caught`,
  )
} finally {
  await src.end()
  await dst.end()
}
ok('ARCHIVE_PUSHED_OK')
