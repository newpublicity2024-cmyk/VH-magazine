/**
 * GATES-FINISH F6 — article and issue pages are served from the ISR cache (spec §9), not
 * rendered on every request.
 *
 * Before the fix the build listed no ISR route and Vercel answered every article
 * `cache-control: private, no-cache, no-store` in ~1 s. Measured here on the local build:
 *   1. the prerender manifest lists /[...path] and /sommaire/[slug] as dynamic ISR routes;
 *   2. an article and an issue, each requested twice, are answered the second time from the
 *      cache (x-nextjs-cache: HIT or STALE) with a public s-maxage, never no-store;
 *   3. control: the category route reads ?page= and stays dynamic — its answer is no-store,
 *      so the header test can tell the two apart;
 *   4. an unknown article path still answers 404.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { withServer, ROOT, pgClient, check, checkEqual, fail, ok, GateFailure } from './lib/harness.mjs'

const manifest = JSON.parse(readFileSync(path.join(ROOT, '.next', 'prerender-manifest.json'), 'utf8'))
for (const route of ['/[...path]', '/sommaire/[slug]']) {
  if (!manifest.dynamicRoutes[route]) fail(`the build does not list ${route} as an ISR route`)
}

const db = await pgClient()
const { rows: art } = await db.query(`
  select a.slug, c.slug as cat, pc.slug as parent
    from articles a join categories c on c.id = a.category_id left join categories pc on pc.id = c.parent_id
   where a._status = 'published' order by a.published_at desc limit 1`)
const { rows: iss } = await db.query(`select slug from magazine_issues order by number desc limit 1`)
const { rows: cat } = await db.query(`select slug from categories where parent_id is null order by id limit 1`)
await db.end()
if (!art.length || !iss.length || !cat.length) fail('the database has no article, issue or category to request')
const articlePath = `/${[art[0].parent, art[0].cat, art[0].slug].filter(Boolean).join('/')}/`
const issuePath = `/sommaire/${iss[0].slug}/`
const categoryPath = `/category/${cat[0].slug}/`

try {
  await withServer(async (baseUrl) => {
    const get = async (p) => {
      const r = await fetch(baseUrl + p, { redirect: 'manual' })
      await r.arrayBuffer()
      return { status: r.status, cache: r.headers.get('x-nextjs-cache'), cc: r.headers.get('cache-control') ?? '' }
    }
    for (const p of [articlePath, issuePath]) {
      const first = await get(p)
      checkEqual(first.status, 200, `${p} first request`)
      const second = await get(p)
      checkEqual(second.status, 200, `${p} second request`)
      // HIT or STALE: both are answered from the ISR cache (STALE = a background refresh is due,
      // e.g. after a publish hook purged the layout). A dynamic route sends no x-nextjs-cache.
      check(second.cache === 'HIT' || second.cache === 'STALE', `${p}: second request x-nextjs-cache=${second.cache}, expected HIT or STALE`)
      check(/s-maxage=\d+/.test(second.cc) && !/no-store/.test(second.cc), `${p}: cache-control "${second.cc}"`)
      console.error(`  ${p}: ${first.cache ?? '-'} then ${second.cache}, "${second.cc}"`)
    }
    const c1 = await get(categoryPath)
    const c2 = await get(categoryPath)
    checkEqual(c2.status, 200, `${categoryPath} status`)
    check(/no-store/.test(c2.cc) && c2.cache !== 'HIT', `control: ${categoryPath} should stay dynamic, measured "${c2.cc}" ${c2.cache}`)
    console.error(`  control ${categoryPath}: ${c1.cache ?? '-'} / "${c2.cc}"`)
    const missing = await get(`/actualite/vh-verify-isr-missing-${Date.now()}/`)
    checkEqual(missing.status, 404, 'an unknown article path')
  })
} catch (e) {
  if (e instanceof GateFailure) fail(e.message)
  throw e
}
ok('ISR_OK')
