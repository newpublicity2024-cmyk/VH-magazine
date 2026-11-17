/**
 * GATES-LAUNCH L7 — every WordPress page answers on purpose (LAUNCH.md step 7).
 *
 * The REST survey recorded the live site's published pages; the decision table
 * (src/migrate/wp-pages.ts) says what the new site does with each. This gate checks the table
 * against the survey and against the pages' own content — only a theme demo or an empty page
 * may be allowed to 404 — and then asks the production build, served against vh_migration,
 * for every one of them. Planted mistakes (a missing decision, real content sent to 404, a
 * wrong redirect target) must each be caught by the same code.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { WP_PAGE_DECISIONS } from '../src/migrate/wp-pages.ts'
import { assert, fail, GateFailure, ok, withServer } from './lib/harness.mjs'

const MIGRATION = process.env.VH_MIGRATION_DIR || '/Users/mc/work/hostinger-ftp/migration'
const pages = readFileSync(path.join(MIGRATION, 'manifests', 'wprest', 'pages.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))
assert(pages.length > 0, 'the REST survey recorded no pages')

const DEMO_TEXT = /Lorem ipsum|Lommodo ligula|wonderful serenity|natoque penatibus/i
const DEMO_LAYOUT = /^(Portfolio|Grid|Masonry)\b/
const contentOf = (p) => String(p.content?.rendered ?? p.content ?? '')
const titleOf = (p) => String(p.title?.rendered ?? p.title ?? '')
const words = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/&[#\w]+;/g, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length

/** Problems with the table itself, read against the survey. */
function auditTable(decisions) {
  const problems = []
  const byId = new Map()
  for (const d of decisions) {
    if (byId.has(d.id)) problems.push(`page ${d.id} decided twice`)
    byId.set(d.id, d)
  }
  const surveyed = new Set(pages.map((p) => p.id))
  for (const d of decisions) if (!surveyed.has(d.id)) problems.push(`decision for page ${d.id}, which the survey does not list`)
  for (const p of pages) {
    const d = byId.get(p.id)
    const wpPath = new URL(p.link).pathname
    if (!d) {
      problems.push(`page ${p.id} ${wpPath} has no decision`)
      continue
    }
    if (d.path !== wpPath) problems.push(`page ${p.id}: decision path ${d.path}, WordPress path ${wpPath}`)
    const text = contentOf(p)
    if (d.action === 'gone' && d.kind === 'empty' && words(text) !== 0) {
      problems.push(`page ${p.id} ${wpPath} marked empty but holds ${words(text)} words`)
    }
    if (d.action === 'gone' && d.kind === 'theme-demo' && !DEMO_TEXT.test(text) && !(words(text) === 0 && DEMO_LAYOUT.test(titleOf(p)))) {
      problems.push(`page ${p.id} ${wpPath} marked theme-demo but its content is not the theme's demo`)
    }
    if (d.action === 'gone' && !['empty', 'theme-demo'].includes(d.kind)) problems.push(`page ${p.id}: gone without a kind`)
    if (d.action === 'redirect' && (!/^\/(.+\/)?$/.test(d.to) || d.to === d.path)) problems.push(`page ${p.id}: bad redirect target ${d.to}`)
  }
  return problems
}

/** Problems with what the server answers. */
async function auditServer(baseUrl, decisions) {
  const problems = []
  const get = (p) => fetch(`${baseUrl}${p}`, { redirect: 'manual' })
  for (const d of decisions) {
    const res = await get(d.path)
    if (d.action === 'serve' && res.status !== 200) problems.push(`${d.path}: ${res.status}, expected 200`)
    if (d.action === 'gone' && res.status !== 404) problems.push(`${d.path}: ${res.status}, expected 404`)
    if (d.action === 'redirect') {
      const location = res.headers.get('location')
      const target = location ? new URL(location, baseUrl).pathname : null
      if (res.status !== 301 || target !== d.to) {
        problems.push(`${d.path}: ${res.status} → ${location ?? 'nowhere'}, expected 301 → ${d.to}`)
      } else {
        const end = await get(d.to)
        if (end.status !== 200) problems.push(`${d.path} → ${d.to}: target answered ${end.status}`)
      }
    }
    await res.arrayBuffer().catch(() => {})
  }
  return problems
}

// Controls: the same code must catch planted mistakes.
const real = WP_PAGE_DECISIONS.find((d) => d.path === '/who-s-who-les-interviews-de-vh/')
assert(real, 'control fixture missing from the table')
assert(auditTable(WP_PAGE_DECISIONS.slice(1)).length > 0, 'control: a missing decision was not caught')
assert(
  auditTable(WP_PAGE_DECISIONS.map((d) => (d === real ? { id: d.id, path: d.path, action: 'gone', kind: 'theme-demo', why: 'x' } : d))).length > 0,
  'control: real content sent to 404 was not caught',
)

const tableProblems = auditTable(WP_PAGE_DECISIONS)
if (tableProblems.length) fail(`${tableProblems.length} table problem(s): ${tableProblems.join('; ')}`)

// The redirects are data: exactly one permanent migration row per redirected page.
const redirected = WP_PAGE_DECISIONS.filter((d) => d.action === 'redirect')
const rows = execFileSync(
  'psql',
  ['-d', 'vh_migration', '-At', '-F', '\t', '-c', `select "from", "to", permanent, source from redirects where "from" in (${redirected.map((d) => `'${d.path}'`).join(',')})`],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'))
for (const d of redirected) {
  const mine = rows.filter((r) => r[0] === d.path)
  if (mine.length !== 1 || mine[0][1] !== d.to || mine[0][2] !== 't' || mine[0][3] !== 'migration') {
    fail(`vh_migration redirect rows for ${d.path}: ${JSON.stringify(mine)}, expected one permanent migration row to ${d.to}`)
  }
}

process.env.DATABASE_URL = 'postgres://localhost/vh_migration'
let served
try {
  served = await withServer(async (baseUrl) => {
    const wrong = await auditServer(baseUrl, [{ ...redirected[0], to: '/category/no-such-9182/' }])
    if (!wrong.length) throw new GateFailure('control: a wrong redirect target was not caught')
    return auditServer(baseUrl, WP_PAGE_DECISIONS)
  })
} catch (e) {
  fail(e instanceof GateFailure ? e.message : (e?.stack ?? String(e)))
}
if (served.length) fail(`${served.length} page(s) answered wrongly: ${served.join('; ')}`)

const count = (a) => WP_PAGE_DECISIONS.filter((d) => d.action === a).length
console.error(
  `  ${pages.length} surveyed pages, ${WP_PAGE_DECISIONS.length} decisions: ${count('serve')} served, ${count('redirect')} redirected (one 301 each, target 200), ${count('gone')} gone (404)`,
)
ok('WP_PAGES_OK')
