/**
 * GATES-SIDEBAR SB8 — the archive (vh_migration) carries vh.ma's Le Club VH widget as the active
 * `whos-who` banner, equal to what vh.ma's home page shows now, and re-running the homepage
 * import changes nothing.
 *
 *   node scripts/verify-leclub-archive.mjs [--migration /Users/mc/work/hostinger-ftp/migration]
 *
 * vh.ma's side: a fresh GET of https://www.vh.ma/, read by the migration's own extractor
 * (tools/vh-page-extract.mjs — the code the survey uses). Ours: the banners row and its Media's
 * legacy path. Idempotence: a fingerprint of every table the import writes, before and after a
 * second run (control: the fingerprint notices a one-field change).
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

import { assert, fail, ok, ROOT } from './lib/harness.mjs'

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const MIGRATION = argOf('migration') || '/Users/mc/work/hostinger-ftp/migration'
const DB = 'postgres://localhost/vh_migration'
const { extractHomepage } = await import(pathToFileURL(path.join(MIGRATION, 'tools', 'vh-page-extract.mjs')).href)

// vh.ma now.
const t0 = Date.now()
const res = await fetch('https://www.vh.ma/', { headers: { 'user-agent': 'vh-migration-survey/1.0' }, signal: AbortSignal.timeout(60_000) })
const html = await res.text()
appendFileSync(path.join(MIGRATION, 'logs', 'wprest-requests.log'), `${new Date().toISOString()}\tsidebar-sb8\tGET\thttps://www.vh.ma/\t${res.status}\t${Date.now() - t0}ms\n`)
assert(res.status === 200, `vh.ma / answered ${res.status}`)
const live = extractHomepage(html).leClub
assert(live?.image && live?.href, 'vh.ma shows no Le Club VH image')

const TABLES = ['banners', 'homepage', 'homepage_dossiers', 'homepage_rels', 'site_settings', 'grand_angle', 'grand_angle_rels']
async function fingerprint(c, perturb = false) {
  const out = {}
  for (const t of TABLES) {
    let row = 'to_jsonb(t)'
    if (perturb && t === 'banners') row = `case when t.id = (select min(id) from banners) then jsonb_set(${row}, '{title}', '"control"') else ${row} end`
    const r = await c.query(`select count(*)::int n, coalesce(md5(string_agg(h, '' order by h)), '') hash from (select md5((${row})::text) h from "${t}" t) x`)
    out[t] = `${r.rows[0].n}:${r.rows[0].hash}`
  }
  return out
}

const c = new pg.Client({ connectionString: DB })
await c.connect()
try {
  const row = (
    await c.query(`select b.title, b.link_url, b.active, m.legacy_path, m.filename from banners b join media m on m.id = b.image_id where b.key = 'whos-who'`)
  ).rows[0]
  assert(row, 'vh_migration has no whos-who banner')
  assert(row.active, 'the whos-who banner is inactive')
  assert(row.legacy_path === live.image, `the banner's image is ${row.legacy_path}; vh.ma shows ${live.image}`)
  assert(row.link_url === live.href, `the banner links to ${row.link_url}; vh.ma's links to ${live.href}`)
  console.log(`  vh.ma: ${live.image} → ${live.href}`)
  console.log(`  vh_migration: whos-who "${row.title}", ${row.filename} → ${row.link_url}, active`)

  const before = await fingerprint(c)
  const control = await fingerprint(c, true)
  if (control.banners === before.banners) fail('control: the fingerprint does not notice a changed banner')

  const run = spawnSync('pnpm', ['-s', 'tsx', 'src/migrate/import-homepage.ts', '--dir', MIGRATION], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: DB },
    encoding: 'utf8',
    timeout: 600_000,
  })
  const out = `${run.stdout}${run.stderr}`
  if (run.status !== 0) fail(`import-homepage failed (exit ${run.status}):\n${out.slice(-2000)}`)
  if (!/banner whos-who: unchanged/.test(out)) fail(`the re-run did not report whos-who unchanged:\n${out.slice(-1500)}`)
  const after = await fingerprint(c)
  const changed = TABLES.filter((t) => before[t] !== after[t])
  assert(changed.length === 0, `re-running the import changed: ${changed.join(', ')}`)
  console.log(`  re-run: ${TABLES.length} tables unchanged (control caught a one-field change)`)
} finally {
  await c.end()
}
ok('LECLUB_ARCHIVE_OK')
