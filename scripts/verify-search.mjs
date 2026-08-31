/**
 * G28 — search (spec §7).
 *
 * Three properties, and the injection probe is not decorative: the query is the
 * one place reader input reaches SQL.
 *   1. an accented French term is found when typed WITHOUT accents
 *   2. a nonsense query returns nothing rather than everything
 *   3. a SQL injection payload neither errors nor destroys data
 */
import { withServer, getHtml, stripScripts, assert, assertEqual, ok, pgClient } from './lib/harness.mjs'

const before = await (async () => {
  const c = await pgClient()
  const { rows } = await c.query('select count(*)::int as n from articles')
  await c.end()
  return rows[0].n
})()
assert(before > 0, 'no articles in the database — G28 would pass vacuously')

await withServer(async (baseUrl) => {
  const search = async (q) => {
    const res = await getHtml(`${baseUrl}/recherche/?q=${encodeURIComponent(q)}`)
    assertEqual(res.status, 200, `search for ${JSON.stringify(q)} status`)
    const html = stripScripts(res.html)
    const summary = /data-search-summary[^>]*>([^<]*)</.exec(html)?.[1]?.trim() ?? ''
    const hits = ((html.match(/data-search-results[\s\S]*/)?.[0] || '').match(/<li\b/g) || []).length
    return { html, summary, hits }
  }

  // 1. Accent-insensitive: the article is "Ferrari électrique", typed here
  //    without the accent, which is how most readers will type it.
  const unaccented = await search('electrique')
  assert(
    unaccented.hits > 0,
    `"electrique" (no accent) found nothing — unaccent is not working. Summary: "${unaccented.summary}"`,
  )
  assert(
    /électrique/i.test(unaccented.html),
    'the accent-insensitive search did not return the accented article',
  )

  // The accented spelling must find it too.
  const accented = await search('électrique')
  assert(accented.hits > 0, '"électrique" (with accent) found nothing')

  // 2. A nonsense term must return nothing, not fall back to everything.
  const nonsense = await search('zzzqqxwv-not-a-word-9182')
  assertEqual(nonsense.hits, 0, 'a nonsense query must return zero results, not a full listing')
  assert(/aucun r[ée]sultat/i.test(nonsense.summary), `expected a no-results message, measured "${nonsense.summary}"`)

  // 3. Injection probe. Must not 500, must not return everything, must not drop the table.
  const evil = await search("'; drop table articles; --")
  assert(evil.hits < before, 'an injection payload returned the whole corpus')

  const empty = await getHtml(`${baseUrl}/recherche/`)
  assertEqual(empty.status, 200, 'the search page with no query must still render')

  console.error(`  unaccented ${unaccented.hits} hit(s), accented ${accented.hits}, nonsense 0, injection survived`)
})

const after = await (async () => {
  const c = await pgClient()
  const { rows } = await c.query('select count(*)::int as n from articles')
  await c.end()
  return rows[0].n
})()
assertEqual(after, before, 'the article table changed during the injection probe — input reached SQL unescaped')

ok('SEARCH_OK')
