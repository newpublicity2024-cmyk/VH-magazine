/**
 * G41 — /vh-grand-angle-2/, the "Grand Angle" destination in the primary nav.
 *
 * On the live site it is the hub of the grand-angle category (WP id 606, whose
 * articles live at /grand-angle/{slug}/ and /grand-angle/{child}/{slug}/). The
 * rebuild serves that tree's articles at the same URL. The expected set is
 * MEASURED from the database with its own recursive query — never taken from the
 * page code — so the gate fails if the page lists an article from outside the
 * tree, drops one inside it, or ignores the nested child category.
 */
import { withServer, getHtml, stripScripts, pgClient, assert, assertEqual, ok, loadEnv } from './lib/harness.mjs'

const PATH = '/vh-grand-angle-2/'
const ORIGIN = (loadEnv().NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')

const client = await pgClient()
const { rows } = await client.query(`
  with recursive tree as (
    select id, slug, 0 as depth from categories where slug = 'grand-angle'
    union all
    select c.id, c.slug, t.depth + 1 from categories c join tree t on c.parent_id = t.id
  )
  select a.slug, t.depth
    from articles a join tree t on a.category_id = t.id
   where a._status = 'published'`)
await client.end()

const expected = new Set(rows.map((r) => r.slug))
assert(expected.size >= 3, `only ${expected.size} published grand-angle articles seeded — the gate would be vacuous`)
assert(rows.some((r) => r.depth > 0), 'no grand-angle article sits in a child category — nesting would go untested')
assert(expected.size <= 12, `${expected.size} articles exceed one page (12); this gate compares page 1 to the full set`)

const canonicalOf = (html) => /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html)?.[1] ?? null

/**
 * First href inside each data-card element of the listing itself — from [data-category-grid] up to
 * the side panel, whose Les plus lus and Derniers articles are cards too (since 2026-11-25).
 */
const cardHrefs = (page) => {
  const from = page.indexOf('data-category-grid')
  const to = page.indexOf('data-region="sidebar"')
  assert(from > -1 && to > from, `the listing grid (${from}) must precede the side panel (${to})`)
  return cardHrefsIn(page.slice(from, to))
}
const cardHrefsIn = (html) =>
  html
    .split(/<article\b[^>]*\bdata-card\b/)
    .slice(1)
    .map((chunk) => /href="([^"]+)"/.exec(chunk)?.[1])
    .filter(Boolean)

await withServer(async (baseUrl) => {
  const { status, html: raw } = await getHtml(`${baseUrl}${PATH}`)
  assertEqual(status, 200, `${PATH} status`)
  const html = stripScripts(raw)

  assertEqual((html.match(/<h1\b/g) || []).length, 1, 'number of h1 elements')
  assertEqual(canonicalOf(html), `${ORIGIN}${PATH}`, 'canonical')

  const hrefs = cardHrefs(html)
  const outside = hrefs.filter((h) => !h.startsWith('/grand-angle/'))
  assert(outside.length === 0, `cards link outside the grand-angle tree: ${outside.join(', ')}`)
  const listed = new Set(hrefs.map((h) => h.replace(/\/$/, '').split('/').pop()))
  const missing = [...expected].filter((s) => !listed.has(s))
  const extra = [...listed].filter((s) => !expected.has(s))
  assert(missing.length === 0, `published grand-angle articles missing from the page: ${missing.join(', ')}`)
  assert(extra.length === 0, `page lists articles that are not published grand-angle articles: ${extra.join(', ')}`)
  assert(
    hrefs.some((h) => h.split('/').filter(Boolean).length === 3),
    'no 3-segment /grand-angle/{child}/{slug}/ article link on the page',
  )

  assert(html.includes('href="/category/grand-angle/"'), 'no link to the /category/grand-angle/ archive')
  const archive = await getHtml(`${baseUrl}/category/grand-angle/`)
  assertEqual(archive.status, 200, '/category/grand-angle/ status')

  const far = await getHtml(`${baseUrl}${PATH}?page=9999`)
  assertEqual(far.status, 404, `${PATH}?page=9999 must 404, not render an empty page`)

  console.error(`  ${hrefs.length} cards = ${expected.size} published grand-angle articles; canonical ${ORIGIN}${PATH}`)
})

ok('GRANDANGLE_OK')
