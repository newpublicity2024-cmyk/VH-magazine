/**
 * G22 — category pagination (spec §7) and the self-canonical rider.
 *
 * The canonical assertion is the one that matters: a paginated page that
 * canonicalises to page 1 tells Google the deeper pages are duplicates, and the
 * articles that only appear on them fall out of the index.
 */
import { withServer, getHtml, stripScripts, assert, assertEqual, ok, loadEnv } from './lib/harness.mjs'

const CAT = '/category/moteur/'
const env = loadEnv()
const ORIGIN = (env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')

const canonicalOf = (html) =>
  /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html)?.[1] ?? null

await withServer(async (baseUrl) => {
  const { status, html: raw } = await getHtml(`${baseUrl}${CAT}`)
  assertEqual(status, 200, `category ${CAT} status`)
  const html = stripScripts(raw)

  const cards = (html.match(/data-card/g) || []).length
  assert(cards > 0, 'category page rendered no article cards')

  assertEqual(canonicalOf(html), `${ORIGIN}${CAT}`, 'page 1 canonical')

  // Page 2 must canonicalise to ITSELF, not to page 1.
  const p2 = await getHtml(`${baseUrl}${CAT}?page=2`)
  if (p2.status === 200) {
    const h2 = stripScripts(p2.html)
    const c2 = canonicalOf(h2)
    assertEqual(c2, `${ORIGIN}${CAT}?page=2`, 'page 2 canonical must be self-referencing, not page 1')
    assert(/rel="prev"/.test(h2), 'page 2 has no rel="prev" link')
    console.error('  page 2 present, self-canonical, rel=prev ok')
  } else {
    // Only 33 seeded articles, so page 2 may not exist. Assert the 404 is
    // deliberate rather than silently skipping the check.
    assertEqual(p2.status, 404, 'a beyond-the-end page must 404, never render empty')
    console.error('  page 2 absent at seed scale and correctly 404s')
  }

  // Beyond the end must always 404, never render an empty indexable page.
  const far = await getHtml(`${baseUrl}${CAT}?page=9999`)
  assertEqual(far.status, 404, '?page=9999 must 404, not render an empty page')

  console.error(`  ${cards} cards on page 1, canonical ${ORIGIN}${CAT}`)
})

ok('CATEGORY_OK')
