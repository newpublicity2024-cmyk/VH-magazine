/**
 * GATES-FINISH F1 — a DEPLOYED site serves every route type (no local server, no database).
 *
 *   node scripts/verify-deployed.mjs --base https://vh-magazine-iota.vercel.app \
 *        --canonical https://www.vh.ma [--sample 8] [--media-origin https://old.example]
 *
 * --base       where to send requests (a Vercel alias, a deployment, or https://www.vh.ma)
 * --canonical  the origin canonicals and sitemaps must name (NEXT_PUBLIC_SERVER_URL)
 * --media-origin  when given, a legacy upload the database does not know must 302 there;
 *              when omitted it must 404 (MEDIA_ORIGIN unset, or the post-cutover loop guard)
 * --redirects-db  a local database holding the same data (postgres://localhost/vh_migration):
 *              --redirects-sample of its redirect rows, spread over the table, must 301 to their
 *              target (LAUNCH.md step 4; default sample 400), and a sampled category page that
 *              shows no article must hold none there either
 * A protected deployment needs VERCEL_AUTOMATION_BYPASS_SECRET in the environment
 * (Vercel → Settings → Deployment Protection → Protection Bypass for Automation).
 *
 * The sample comes from the deployment's own sitemap, so the same checks run on the seed
 * today, on the migrated archive at LAUNCH.md step 4, and on www.vh.ma after cutover.
 * Every URL the sitemap names is rewritten from --canonical onto --base before it is fetched.
 */
import { fail, ok } from './lib/harness.mjs'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i > -1 ? argv[i + 1] : fallback
}
const BASE = (arg('base') ?? fail('--base is required')).replace(/\/+$/, '')
const CANON = (arg('canonical') ?? fail('--canonical is required')).replace(/\/+$/, '')
const MEDIA_ORIGIN = arg('media-origin')
const REDIRECTS_DB = arg('redirects-db')
const REDIRECTS_SAMPLE = Number(arg('redirects-sample', '400'))
const SAMPLE = Number(arg('sample', '8'))
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const baseHost = new URL(BASE).hostname
const indexable = baseHost === 'www.vh.ma' || baseHost === 'vh.ma'

const problems = []
const problem = (msg) => problems.push(msg)
const timings = []

async function get(url, { method = 'GET', headers = {}, body, redirect = 'manual' } = {}) {
  const h = { 'user-agent': 'vh-verify-deployed/1', ...headers }
  if (BYPASS) h['x-vercel-protection-bypass'] = BYPASS
  const t0 = performance.now()
  const res = await fetch(url, { method, headers: h, body, redirect, signal: AbortSignal.timeout(30_000) })
  const text = method === 'HEAD' ? '' : await res.text()
  const ms = Math.round(performance.now() - t0)
  return { status: res.status, headers: res.headers, text, ms }
}
const onBase = (u) => (u.startsWith(CANON) ? BASE + u.slice(CANON.length) : u)
const noScripts = (html) => html.replace(/<script\b[\s\S]*?<\/script>/gi, '')
const canonicalOf = (html) => /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]
const h1Count = (html) => (noScripts(html).match(/<h1\b/g) ?? []).length
const cardCount = (html) => (noScripts(html).match(/\bdata-card\b(?!-)/g) ?? []).length
const decode = (s) => s.replace(/&amp;/g, '&')

// ---------------------------------------------------------------- reachability, indexing, headers
const home = await get(`${BASE}/`)
if (home.status === 401 || home.status === 302 || home.status === 403) {
  fail(`${BASE}/ answered ${home.status} — protected; set VERCEL_AUTOMATION_BYPASS_SECRET`)
}
if (home.status !== 200) fail(`home: status ${home.status}`)
timings.push(['home', home.ms])
if (canonicalOf(home.text) !== `${CANON}/`) problem(`home canonical ${canonicalOf(home.text)} ≠ ${CANON}/`)
const homeCards = cardCount(home.text)
if (homeCards < 10) problem(`home shows ${homeCards} cards (expected ≥ 10)`)
const xRobots = home.headers.get('x-robots-tag') ?? ''
if (indexable && /noindex/i.test(xRobots)) problem(`${baseHost} must be indexable but sends x-robots-tag: ${xRobots}`)
if (!indexable && !/noindex/i.test(xRobots)) problem(`${baseHost} is not vh.ma but sends no noindex header`)
for (const [h, re] of [
  ['strict-transport-security', /max-age=\d{7,}/],
  ['x-content-type-options', /^nosniff$/],
  ['x-frame-options', /^SAMEORIGIN$/i],
  ['referrer-policy', /strict-origin-when-cross-origin/],
]) {
  if (!re.test(home.headers.get(h) ?? '')) problem(`home header ${h}: ${home.headers.get(h)}`)
}

// ---------------------------------------------------------------- sitemap → sample
const sm = await get(`${BASE}/sitemap.xml`)
timings.push(['sitemap.xml', sm.ms])
if (sm.status !== 200) fail(`sitemap.xml: status ${sm.status}`)
const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
if (locs.length === 0) fail('sitemap.xml lists no URLs')
const foreign = locs.filter((l) => !l.startsWith(`${CANON}/`))
if (foreign.length) problem(`${foreign.length} sitemap URLs are not on ${CANON}, e.g. ${foreign[0]}`)
const paths = locs.map((l) => new URL(l).pathname)
// Two or three segments, outside the app's own two-segment routes (categories, magazine issues).
const isArticle = (p) => !/^\/(category|sommaire)\//.test(p) && /^\/[^/]+\/[^/]+\/(?:[^/]+\/)?$/.test(p)
const spread = (arr, n) => (arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[Math.floor((i * arr.length) / n)]))
const articles = spread(locs.filter((l) => isArticle(new URL(l).pathname)), SAMPLE)
const categories = spread(locs.filter((l) => new URL(l).pathname.startsWith('/category/')), Math.max(2, SAMPLE / 2))
if (articles.length === 0) fail('sitemap names no article URL')
if (categories.length === 0) fail('sitemap names no category URL')
const deep = paths.filter((p) => isArticle(p) && p.split('/').filter(Boolean).length === 3)

// ---------------------------------------------------------------- articles
let ogChecked = 0
let titleWord = null
for (const loc of articles) {
  const r = await get(onBase(loc))
  timings.push([new URL(loc).pathname, r.ms])
  if (r.status !== 200) { problem(`${loc}: status ${r.status}`); continue }
  if (canonicalOf(r.text) !== loc) problem(`${loc}: canonical ${canonicalOf(r.text)}`)
  if (h1Count(r.text) !== 1) problem(`${loc}: ${h1Count(r.text)} <h1>`)
  const ld = [...r.text.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  let hasArticleLd = false
  for (const raw of ld) {
    try {
      const j = JSON.parse(raw)
      const types = [j, ...(j['@graph'] ?? [])].map((x) => x['@type']).flat()
      if (types.some((t) => /Article/.test(t ?? ''))) hasArticleLd = true
    } catch {
      problem(`${loc}: JSON-LD does not parse`)
    }
  }
  if (!hasArticleLd) problem(`${loc}: no Article JSON-LD`)
  const og = /<meta property="og:image" content="([^"]+)"/.exec(r.text)?.[1]
  if (og && ogChecked < 3) {
    const img = await get(decode(og), { method: 'HEAD', redirect: 'follow' })
    if (img.status !== 200 || !/^image\//.test(img.headers.get('content-type') ?? '')) {
      problem(`${loc}: og:image ${og} → ${img.status} ${img.headers.get('content-type')}`)
    }
    ogChecked++
  }
  if (!titleWord) {
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(noScripts(r.text))?.[1]?.replace(/<[^>]+>/g, '') ?? ''
    titleWord = (h1.match(/\p{L}{6,}/gu) ?? [])[0] ?? null
  }
}

// ---------------------------------------------------------------- categories
const EMPTY_CATEGORY = 'Aucun article dans cette catégorie' // category/[...path]/page.tsx
let listedCategories = 0
const emptyCategories = []
for (const loc of categories) {
  const r = await get(onBase(loc))
  timings.push([new URL(loc).pathname, r.ms])
  if (r.status !== 200) { problem(`${loc}: status ${r.status}`); continue }
  if (canonicalOf(r.text) !== loc) problem(`${loc}: canonical ${canonicalOf(r.text)}`)
  // The archive has categories without articles (32 of 130 on 2026-11-24: 20 empty on vh.ma too,
  // e.g. fashion/beauty; 12 whose posts all carry another category in their URL — an article has
  // one category here). Those must show the page's designed empty state and, with a local copy of
  // the data (--redirects-db), really be empty there. At least one category must list articles
  // (below), so the listing itself is always exercised.
  if (cardCount(r.text) >= 1) listedCategories++
  else if (!noScripts(r.text).includes(EMPTY_CATEGORY)) problem(`${loc}: no article card and no empty-state text`)
  else emptyCategories.push(loc)
}
if (!listedCategories) {
  // Every sampled category was empty: walk the rest of the sitemap's categories for one that lists.
  for (const loc of locs.filter((l) => new URL(l).pathname.startsWith('/category/') && !categories.includes(l))) {
    const r = await get(onBase(loc))
    if (r.status === 200 && cardCount(r.text) >= 1) { listedCategories++; break }
  }
  if (!listedCategories) problem('no category page lists an article')
}
if (emptyCategories.length && REDIRECTS_DB) {
  const { default: pg } = await import('pg')
  const c = new pg.Client({ connectionString: REDIRECTS_DB })
  await c.connect()
  for (const loc of emptyCategories) {
    const slug = new URL(loc).pathname.split('/').filter(Boolean).at(-1)
    const n = Number((await c.query(
      `select count(*) from articles a join categories k on k.id = a.category_id where k.slug = $1 and a._status = 'published'`, [slug],
    )).rows[0].count)
    if (n) problem(`${loc}: shows no article, but the database holds ${n} published in it`)
  }
  await c.end()
}

// ---------------------------------------------------------------- search
if (titleWord) {
  const s = await get(`${BASE}/recherche/?q=${encodeURIComponent(titleWord)}`)
  timings.push(['recherche', s.ms])
  const hits = ((noScripts(s.text).match(/data-search-results[\s\S]*/)?.[0] ?? '').match(/<li\b/g) ?? []).length
  if (s.status !== 200 || hits === 0) problem(`/recherche/?q=${titleWord}: status ${s.status}, ${hits} results`)
  const api = await get(`${BASE}/api/search/?q=${encodeURIComponent(titleWord)}`, { redirect: 'follow' })
  let apiHits = -1
  try { apiHits = JSON.parse(api.text).hits.length } catch { /* reported below */ }
  if (api.status !== 200 || apiHits < 1) problem(`/api/search/?q=${titleWord}: status ${api.status}, ${apiHits} hits`)
} else {
  problem('no title word found to search for')
}

// ---------------------------------------------------------------- feeds and machine files
const rss = await get(`${BASE}/rss.xml`)
if (rss.status !== 200 || !/<rss\b/.test(rss.text) || !/<item>/.test(rss.text)) problem(`rss.xml: status ${rss.status}`)
const news = await get(`${BASE}/news-sitemap.xml`)
if (news.status !== 200 || !/<urlset\b/.test(news.text)) problem(`news-sitemap.xml: status ${news.status}`)
const robots = await get(`${BASE}/robots.txt`)
if (robots.status !== 200 || !robots.text.includes(`Sitemap: ${CANON}/sitemap.xml`)) problem(`robots.txt does not name ${CANON}/sitemap.xml`)
const rmap = await get(`${BASE}/redirects-map.json`)
try { JSON.parse(rmap.text) } catch { problem(`redirects-map.json: status ${rmap.status}, not JSON`) }

// ---------------------------------------------------------------- 404, legacy uploads, images
const missing = await get(`${BASE}/vh-verify-deployed-missing-${Date.now()}/nothing-here/`)
if (missing.status !== 404) problem(`unknown path: status ${missing.status}, expected 404`)
const legacy = await get(`${BASE}/wp-content/uploads/2001/01/vh-verify-deployed-missing.jpg`)
if (MEDIA_ORIGIN) {
  const want = `${MEDIA_ORIGIN.replace(/\/+$/, '')}/wp-content/uploads/2001/01/vh-verify-deployed-missing.jpg`
  if (legacy.status !== 302 || legacy.headers.get('location') !== want) {
    problem(`unknown legacy upload: ${legacy.status} → ${legacy.headers.get('location')}, expected 302 → ${want}`)
  }
} else if (legacy.status !== 404) {
  problem(`unknown legacy upload: ${legacy.status} → ${legacy.headers.get('location')}, expected 404 (no --media-origin)`)
}
const optimized = decode(/(?:src|srcSet|srcset)="(\/_next\/image\/?\?url=[^" ]+)/.exec(noScripts(home.text))?.[1] ?? '')
if (!optimized) {
  problem('home has no optimized image')
} else {
  const img = await get(`${BASE}${optimized}`, { headers: { accept: 'image/avif,image/webp,*/*' } })
  if (img.status !== 200 || !/^image\/(avif|webp)/.test(img.headers.get('content-type') ?? '')) {
    problem(`optimizer ${optimized}: ${img.status} ${img.headers.get('content-type')}`)
  }
}

// ---------------------------------------------------------------- admin
const login = await get(`${BASE}/admin/login/`, { redirect: 'follow' })
if (login.status !== 200) problem(`/admin/login/: status ${login.status}`)
// No login attempt here, not even a wrong one: Payload locks an account for 10 minutes after
// 5 failed logins, and repeated deployed checks locked production's admin on 2026-11-19. The
// default-password check lives in verify-prod-admin.mjs, which resets the counter after it.

// ---------------------------------------------------------------- redirects (step 4)
let redirectsChecked = 0
if (REDIRECTS_DB) {
  const { default: pg } = await import('pg')
  const c = new pg.Client({ connectionString: REDIRECTS_DB })
  await c.connect()
  const rows = (await c.query('select "from", "to", permanent from redirects order by id')).rows
  await c.end()
  for (const r of spread(rows, REDIRECTS_SAMPLE)) {
    const res = await get(`${BASE}${r.from}`)
    const loc = res.headers.get('location')
    const to = loc ? new URL(loc, BASE) : null
    const want = new URL(r.to, BASE)
    if (res.status !== (r.permanent ? 301 : 302) || !to || to.pathname + to.search !== want.pathname + want.search) {
      problem(`redirect ${r.from}: ${res.status} → ${loc}, expected ${r.permanent ? 301 : 302} → ${r.to}`)
    }
    redirectsChecked++
  }
}

// ---------------------------------------------------------------- report
const slow = timings.filter(([, ms]) => ms > 3000)
console.error(
  `  ${BASE}: ${locs.length} sitemap URLs (${deep.length} three-segment articles); checked ` +
    `${articles.length} articles, ${categories.length} categories (${emptyCategories.length} empty, shown as such), search, feeds, 404, legacy upload, optimizer, admin` +
    (REDIRECTS_DB ? `, ${redirectsChecked} redirects` : ''),
)
console.error(`  response times (ms): ${timings.map(([p, ms]) => `${p.length > 40 ? '…' + p.slice(-38) : p} ${ms}`).join(' · ')}`)
if (slow.length) console.error(`  slower than 3 s: ${slow.map(([p, ms]) => `${p} ${ms}`).join(', ')}`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  fail(`${problems.length} problem(s) on ${BASE}`)
}
ok('DEPLOYED_OK')
