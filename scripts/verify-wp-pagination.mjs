/**
 * GATES-FINISH F11 — WordPress's paginated archive URLs keep answering (src/proxy.ts).
 *
 *   DATABASE_URL=postgres://localhost/vh_migration node scripts/verify-wp-pagination.mjs
 *
 * The live site answers /page/N/, /category/{path}/page/N/ and /tag/{slug}/page/N/ with 200;
 * this site paginates listings with ?page=N. Measured against a server on the build:
 *   - /page/2/ → 301 /
 *   - /category/{top}/page/2/ → 301 /category/{top}/?page=2, which answers 200;
 *     /category/{top}/{child}/page/1/ → 301 /category/{top}/{child}/ (page 1 is the bare URL)
 *   - /tag/{slug}/page/3/ → 301 straight to that tag's redirect target (a category)
 *   - controls, untouched by the rule: a three-segment path ending in page/N that is not an
 *     archive (/{category}/page/2/) and an author archive are not redirected to a listing.
 * Run against vh_migration (it holds the tag redirects); every page judged is request-time.
 */
import pg from 'pg'
import { withServer, loadEnv, check, checkEqual, fail, ok, GateFailure } from './lib/harness.mjs'

const url = process.env.DATABASE_URL || loadEnv().DATABASE_URL
const db = new pg.Client({ connectionString: url })
await db.connect()
const top = (await db.query(`
  select c.slug from categories c
   where c.parent_id is null
     and (select count(*) from articles a join categories x on x.id = a.category_id
           where a._status = 'published' and (x.id = c.id or x.parent_id = c.id)) > 12
   order by c.id limit 1`)).rows[0]?.slug
const child = (await db.query(`select c.slug, p.slug as parent from categories c join categories p on p.id = c.parent_id order by c.id limit 1`)).rows[0]
const tag = (await db.query(`select "from", "to" from redirects where "from" ~ '^/tag/[a-z0-9-]+/$' order by id limit 1`)).rows[0]
await db.end()
if (!top || !child || !tag) fail(`the database needs a category with 2+ pages, a subcategory and a tag redirect (got ${!!top}, ${!!child}, ${!!tag})`)

try {
  await withServer(async (baseUrl) => {
    const get = async (p) => {
      const r = await fetch(baseUrl + p, { redirect: 'manual' })
      await r.arrayBuffer()
      const loc = r.headers.get('location')
      return { status: r.status, to: loc ? new URL(loc, baseUrl).pathname + new URL(loc, baseUrl).search : null }
    }
    const expect301 = async (from, to) => {
      const r = await get(from)
      check(r.status === 301 && r.to === to, `${from}: ${r.status} → ${r.to}, expected 301 → ${to}`)
    }
    await expect301('/page/2/', '/')
    await expect301(`/category/${top}/page/2/`, `/category/${top}/?page=2`)
    checkEqual((await get(`/category/${top}/?page=2`)).status, 200, `/category/${top}/?page=2`)
    await expect301(`/category/${child.parent}/${child.slug}/page/1/`, `/category/${child.parent}/${child.slug}/`)
    await expect301(`${tag.from}page/3/`, tag.to)
    for (const p of [`/${top}/page/2/`, '/author/redaction/page/2/']) {
      const r = await get(p)
      check(!(r.status === 301 && /^\/(category\/|\?|$)/.test(r.to ?? '')), `control ${p} was redirected to a listing: ${r.status} → ${r.to}`)
    }
    console.error(`  /page/2/, /category/${top}/page/2/, …/${child.slug}/page/1/, ${tag.from}page/3/ → 301 to their listings; controls untouched`)
  })
} catch (e) {
  if (e instanceof GateFailure) fail(e.message)
  throw e
}
ok('WP_PAGINATION_OK')
