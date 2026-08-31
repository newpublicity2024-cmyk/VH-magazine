/**
 * G31 — sitemap.xml and news-sitemap.xml.
 *
 * Cross-checked against the database in BOTH directions rather than by creating
 * a draft at gate time. The sitemap is prerendered, so a row created after the
 * build could never have appeared in it — a "create a draft, confirm it is
 * absent" control would have passed no matter how broken the query was. Instead
 * the seed carries a permanent draft, and this asserts:
 *   - every published article IS in the sitemap
 *   - no non-published article is in it (the seeded draft is the live control)
 */
import { withServer, getHtml, assert, assertEqual, ok, pgClient, loadEnv } from './lib/harness.mjs'

const env = loadEnv()
const ORIGIN = (env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')

const client = await pgClient()
const { rows: pub } = await client.query(`select slug from articles where _status = 'published'`)
const { rows: drafts } = await client.query(`select slug from articles where _status <> 'published'`)
await client.end()

assert(pub.length > 0, 'no published articles — G31 would pass vacuously')
assert(
  drafts.length > 0,
  'no unpublished articles exist, so "drafts are excluded" cannot be proven. ' +
    'Run `pnpm seed`, which creates a permanent draft control article.',
)

await withServer(async (baseUrl) => {
  const sm = await getHtml(`${baseUrl}/sitemap.xml`)
  assertEqual(sm.status, 200, 'sitemap.xml status')
  const xml = sm.html

  assert(xml.startsWith('<?xml'), 'sitemap.xml does not begin with an XML declaration')
  assert(
    /<urlset[^>]+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml),
    'sitemap.xml is missing the sitemaps.org namespace',
  )

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  assert(locs.length > 0, 'sitemap.xml contains no <loc> entries')

  // B2: absolute on the production origin, never the deployment host.
  const foreign = locs.filter((l) => !l.startsWith(`${ORIGIN}/`))
  assertEqual(foreign.length, 0, `sitemap URLs not on ${ORIGIN}: ${JSON.stringify(foreign.slice(0, 3))}`)

  // Trailing slash, so the sitemap never advertises a URL that redirects.
  const noSlash = locs.filter((l) => !l.endsWith('/') && !/\.(xml|json|txt)$/.test(l))
  assertEqual(noSlash.length, 0, `sitemap URLs without a trailing slash: ${JSON.stringify(noSlash.slice(0, 3))}`)

  // Every published article present.
  const missing = pub.filter((r) => !locs.some((l) => l.endsWith(`/${r.slug}/`)))
  assertEqual(
    missing.length,
    0,
    `published articles absent from the sitemap: ${JSON.stringify(missing.slice(0, 5).map((m) => m.slug))}`,
  )

  // No draft present — the seeded control makes this a real assertion.
  const leaked = drafts.filter((r) => locs.some((l) => l.endsWith(`/${r.slug}/`)))
  assertEqual(
    leaked.length,
    0,
    `unpublished articles advertised in the sitemap: ${JSON.stringify(leaked.map((m) => m.slug))}`,
  )

  // ── news-sitemap: last 48h only (rider) ──────────────────────────────────
  const news = await getHtml(`${baseUrl}/news-sitemap.xml`)
  assertEqual(news.status, 200, 'news-sitemap.xml status')
  assert(
    /xmlns:news="http:\/\/www\.google\.com\/schemas\/sitemap-news\/0\.9"/.test(news.html),
    'news-sitemap is missing the Google News namespace',
  )

  const dates = [...news.html.matchAll(/<news:publication_date>([^<]+)<\/news:publication_date>/g)].map(
    (m) => new Date(m[1]).getTime(),
  )
  const cutoff = Date.now() - 48 * 60 * 60 * 1000
  const stale = dates.filter((d) => d < cutoff)
  assertEqual(
    stale.length,
    0,
    `news-sitemap contains ${stale.length} article(s) older than 48h — Google discards the entire feed for this`,
  )

  const newsLocs = [...news.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const newsForeign = newsLocs.filter((l) => !l.startsWith(`${ORIGIN}/`))
  assertEqual(newsForeign.length, 0, `news-sitemap URLs not on ${ORIGIN}`)

  console.error(
    `  sitemap ${locs.length} URLs; ${pub.length} published all present; ${drafts.length} draft(s) excluded; news-sitemap ${dates.length} within 48h`,
  )
})

ok('SITEMAP_OK')
