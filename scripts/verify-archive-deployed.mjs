/**
 * GATES-ARCHIVE A4 — a deployment serves the pushed archive, not the seed demo.
 *
 *   node scripts/verify-archive-deployed.mjs --base https://vh-magazine-iota.vercel.app \
 *        --canonical https://www.vh.ma --new-since 2026-11-23
 *
 * Measured against the deployment, with vh_migration (the archive) and vh_magazine (the seed)
 * read locally for the expectations:
 *   - the sitemap names every published archive article (by slug, its URL's last segment);
 *   - no article that exists only in the seed is named by the sitemap or linked from the home
 *     page — control: that seed-only set is not empty, so the absence is not vacuous;
 *   - the home page — prerendered at BUILD time — links the archive's newest article, so the
 *     build itself read the archive (a deployment built before the push fails here);
 *   - every article imported since --new-since answers 200 at its sitemap URL with its title.
 * A protected deployment needs VERCEL_AUTOMATION_BYPASS_SECRET.
 */
import pg from 'pg'
import { fail, ok } from './lib/harness.mjs'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i > -1 ? argv[i + 1] : fallback
}
const BASE = (arg('base') ?? fail('--base is required')).replace(/\/+$/, '')
const CANON = (arg('canonical') ?? fail('--canonical is required')).replace(/\/+$/, '')
const NEW_SINCE = arg('new-since') ?? fail('--new-since <YYYY-MM-DD> is required')
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

async function get(url) {
  const headers = { 'user-agent': 'vh-verify-archive/1' }
  if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS
  const res = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(60_000) })
  return { status: res.status, text: await res.text() }
}
const noScripts = (html) => html.replace(/<script\b[\s\S]*?<\/script>/gi, '')
const decode = (s) =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
/**
 * The slug of an article URL — 2 or 3 segments outside /category/ and /sommaire/ (static pages
 * are one segment) — else null. Matching every URL's last segment once mistook the archive's
 * category /category/le-luxe/ for the seed article `le-luxe` (2026-11-24).
 */
const articleSlug = (u) => {
  const seg = new URL(u).pathname.split('/').filter(Boolean)
  if (seg.length < 2 || seg.length > 3 || seg[0] === 'category' || seg[0] === 'sommaire') return null
  return seg.at(-1)
}

async function rows(db, sql, params = []) {
  const c = new pg.Client({ connectionString: db })
  await c.connect()
  try {
    return (await c.query(sql, params)).rows
  } finally {
    await c.end()
  }
}

const archive = await rows(
  'postgres://localhost/vh_migration',
  `select slug, title, published_at, created_at from articles where _status = 'published' order by published_at desc, id desc`,
)
const seedSlugs = (await rows('postgres://localhost/vh_magazine', `select slug from articles`)).map((r) => r.slug)
const archiveSlugs = new Set(archive.map((a) => a.slug))
const seedOnly = seedSlugs.filter((s) => !archiveSlugs.has(s))
if (!seedOnly.length) fail('control: no seed-only article — the "seed is gone" checks would be vacuous')
const fresh = archive.filter((a) => a.created_at >= new Date(`${NEW_SINCE}T00:00:00Z`))
if (!fresh.length) fail(`no archive article was imported since ${NEW_SINCE}`)

const problems = []

// Sitemap — one document, every URL (sitemap.xml/route.ts).
const sm = await get(`${BASE}/sitemap.xml`)
if (sm.status !== 200) fail(`/sitemap.xml: status ${sm.status}`)
const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
const articleLocs = locs.filter((u) => articleSlug(u))
const bySlug = new Map(articleLocs.map((u) => [articleSlug(u), u]))
if (articleLocs.length !== archiveSlugs.size) {
  problems.push(`sitemap: ${articleLocs.length} article URLs for ${archiveSlugs.size} published archive articles`)
}
const missing = [...archiveSlugs].filter((s) => !bySlug.has(s))
if (missing.length) problems.push(`sitemap: ${missing.length} of ${archiveSlugs.size} archive articles missing (${missing.slice(0, 3)})`)
const seedInSitemap = seedOnly.filter((s) => bySlug.has(s))
if (seedInSitemap.length) problems.push(`sitemap: ${seedInSitemap.length} seed-only articles still listed (${seedInSitemap.slice(0, 3)})`)

// Home page — prerendered at build time.
const home = await get(`${BASE}/`)
if (home.status !== 200) problems.push(`/: status ${home.status}`)
const hrefs = new Set(
  [...noScripts(home.text).matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1])).filter((h) => h.startsWith('/') || h.startsWith(CANON)),
)
const hrefSlugs = new Set([...hrefs].map((h) => articleSlug(h.startsWith('/') ? `${CANON}${h}` : h)).filter(Boolean))
const newest = archive[0]
if (!hrefSlugs.has(newest.slug)) problems.push(`home: no link to the archive's newest article (${newest.slug}) — built before the push?`)
const seedOnHome = seedOnly.filter((s) => hrefSlugs.has(s))
if (seedOnHome.length) problems.push(`home: links ${seedOnHome.length} seed-only articles (${seedOnHome.slice(0, 3)})`)

// Articles imported by the latest refresh.
for (const a of fresh) {
  const loc = bySlug.get(a.slug)
  if (!loc) continue // already reported as missing from the sitemap
  const url = loc.startsWith(CANON) ? BASE + loc.slice(CANON.length) : loc
  const r = await get(url)
  const title = decode(/<title>([^<]*)<\/title>/.exec(r.text)?.[1] ?? '')
  if (r.status !== 200) problems.push(`${new URL(url).pathname}: status ${r.status}`)
  else if (!title.includes(a.title.trim())) problems.push(`${new URL(url).pathname}: <title> "${title}" lacks "${a.title.trim()}"`)
}

if (problems.length) fail(problems.join('\n'))
console.log(
  `${BASE}: sitemap names all ${archiveSlugs.size} archive articles and none of the ${seedOnly.length} seed-only ones; ` +
    `home (built) links the newest (${newest.slug}) and no seed-only article; ` +
    `${fresh.length} articles imported since ${NEW_SINCE} answer 200 with their titles`,
)
ok('ARCHIVE_DEPLOYED_OK')
