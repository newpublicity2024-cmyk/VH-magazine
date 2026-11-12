/**
 * R3-G14 — live search (DESIGN-SPEC-R3 §4.4, decision D3).
 *
 * API: GET /api/search?q=
 *   - "electrique" (the seeded "Ferrari électrique", typed without the accent) returns
 *     1–6 hits, each with a title, an article URL of 2–3 segments, and a DD/MM/YYYY date;
 *   - "maroc" (many matches) returns exactly 6 — the cap holds;
 *   - a 1-character query returns no hits and an empty query no hits;
 *   - an injection payload returns 200 with a well-formed body, and the articles table
 *     still has its row count afterwards.
 * Panel: typing "electrique" in the open search panel lists [data-search-hit] links that
 * point at article URLs, and a [data-search-all] link to /recherche/?q=electrique.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, ok, pgClient } from './lib/harness.mjs'

const countArticles = async () => {
  const c = await pgClient()
  try {
    return (await c.query('select count(*)::int as n from articles')).rows[0].n
  } finally {
    await c.end()
  }
}
const before = await countArticles()
assert(before > 0, 'no articles in the database — the search gate would pass vacuously')

// A query the database itself says matches more than 6 published articles, so the cap
// is exercised for real: OR together the most frequent lexemes until the count is ≥ 7.
const capQuery = await (async () => {
  const c = await pgClient()
  try {
    const { rows: words } = await c.query(
      `select word from ts_stat('select search_vector from articles where _status = ''published''')
        where length(word) > 3 and word ~ '^[a-z]+$' order by ndoc desc limit 15`,
    )
    const picked = []
    for (const { word } of words) {
      picked.push(word)
      const q = picked.join(' or ')
      const { rows } = await c.query(
        `select count(*)::int as n from articles
          where _status = 'published' and search_vector @@ websearch_to_tsquery('french', unaccent($1))`,
        [q],
      )
      if (rows[0].n > 6) return { q, n: rows[0].n }
    }
    return null
  } finally {
    await c.end()
  }
})()
assert(capQuery, 'no OR-query over the top lexemes matches more than 6 articles — the cap cannot be tested')

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const api = async (q) => {
    const res = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(q)}`)
    assert(res.status === 200, `/api/search?q=${q} answered ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.hits), `/api/search?q=${q} body has no hits array: ${JSON.stringify(body).slice(0, 200)}`)
    return body
  }

  const one = await api('electrique')
  assert(one.hits.length >= 1 && one.hits.length <= 6, `"electrique" returned ${one.hits.length} hits, expected 1–6`)
  assert(one.hits.some((h) => /électrique/i.test(h.title)), '"electrique" did not find the accented seeded article')
  for (const h of one.hits) {
    const segs = String(h.url).split('/').filter(Boolean)
    assert(h.url.startsWith('/') && h.url.endsWith('/') && segs.length >= 2 && segs.length <= 3, `hit URL ${h.url} is not a 2–3 segment article path`)
    assert(/^\d{2}\/\d{2}\/\d{4}$/.test(h.date), `hit date ${h.date} is not DD/MM/YYYY`)
    assert(typeof h.title === 'string' && h.title.length > 0, 'hit without a title')
  }
  const many = await api(capQuery.q)
  assert(many.hits.length === 6, `"${capQuery.q}" matches ${capQuery.n} articles in the DB but the API returned ${many.hits.length} — the cap of 6 does not hold`)
  assert((await api('m')).hits.length === 0, 'a 1-character query returned hits')
  assert((await api('')).hits.length === 0, 'an empty query returned hits')
  await api("'; drop table articles; --")
  await api('maroc) OR 1=1 --')
  assert((await countArticles()) === before, 'the articles row count changed after the injection payloads')
  console.error(`  api: electrique → ${one.hits.length}; "${capQuery.q}" (${capQuery.n} in DB) → ${many.hits.length} (cap); 1 char → 0; injection harmless`)

  const p = await page({ width: 1440, height: 900 })
  await p.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  await p.locator('[data-search-trigger]').first().click()
  await p.locator('#vh-search-input').fill('electrique')
  await p.locator('[data-search-hit]').first().waitFor({ state: 'visible', timeout: 5000 })
  const panel = await p.evaluate(() => ({
    hits: [...document.querySelectorAll('[data-search-hit]')].map((a) => a.getAttribute('href')),
    all: document.querySelector('[data-search-all]')?.getAttribute('href'),
    text: document.querySelector('[data-search-all]')?.textContent,
  }))
  assert(panel.hits.length >= 1 && panel.hits.length <= 6, `panel lists ${panel.hits.length} hits`)
  assert(panel.hits.every((h) => h && h.split('/').filter(Boolean).length >= 2), `panel hit hrefs are not article URLs: ${panel.hits}`)
  assert(panel.all === '/recherche/?q=electrique', `"voir tous" link is ${panel.all}, expected /recherche/?q=electrique`)
  assert(/Voir tous les résultats/i.test(panel.text || ''), `"voir tous" link text is ${panel.text}`)
  console.error(`  panel: ${panel.hits.length} live hit(s) + ${panel.all}`)
  await p.context().close()

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

ok('R3_LIVESEARCH_OK')
