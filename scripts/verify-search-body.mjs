/**
 * GATES-FINISH F4/F5 — search reads article bodies (migration 20261119_120000_search_body).
 *
 *   node scripts/verify-search-body.mjs                       against .env's DATABASE_URL
 *   DATABASE_URL=postgres://localhost/vh_migration node scripts/verify-search-body.mjs
 *   node scripts/verify-search-body.mjs --coverage-only       checks 1–3 only (the dev seed)
 *
 * 1. The migration is recorded and the generated column's expression reads the body.
 * 2. Coverage, over EVERY article whose body has text: each lexeme of the body — recomputed
 *    here with this script's own extraction, not the migration's function — is in the
 *    article's search_vector.
 * 3. Control: the same containment test run against a title + excerpt vector (the old column)
 *    fails for most of those articles, so check 2 can tell the two indexes apart.
 * 4. End to end: for up to five published articles, a word that occurs in exactly that
 *    article's body and not in its title or excerpt is searched on /recherche/ (a request-time
 *    page, so a vh_migration server is judged fairly on a vh_magazine build); the article is a
 *    result, and its result shows a passage containing the word.
 */
import pg from 'pg'
import { withServer, getHtml, stripScripts, loadEnv, check, checkEqual, fail, ok, GateFailure } from './lib/harness.mjs'

const url = process.env.DATABASE_URL || loadEnv().DATABASE_URL
if (!url) fail('no DATABASE_URL')
const db = new pg.Client({ connectionString: url })
await db.connect()
const dbName = (await db.query('select current_database() as d')).rows[0].d

// Independent extraction: every string "text" member anywhere in the Lexical tree.
const BODY_TEXT = `(select coalesce(string_agg(v #>> '{}', ' '), '')
                     from jsonb_path_query(a.body, 'strict $.**.text') v
                    where jsonb_typeof(v) = 'string')`
const BODY_VEC = `to_tsvector('french', vh_immutable_unaccent(${BODY_TEXT}))`
const OLD_VEC = `(setweight(to_tsvector('french', vh_immutable_unaccent(coalesce(a.title, ''))), 'A') ||
                  setweight(to_tsvector('french', vh_immutable_unaccent(coalesce(a.excerpt, ''))), 'B'))`

let e2e = []
let cov
const COVERAGE_ONLY = process.argv.includes('--coverage-only')
class SkipE2E extends Error {}
try {
  // 1. schema
  const mig = await db.query(`select 1 from payload_migrations where name = '20261119_120000_search_body'`)
  checkEqual(mig.rowCount, 1, `${dbName}: migration 20261119_120000_search_body recorded`)
  const expr = (
    await db.query(
      `select generation_expression from information_schema.columns
        where table_name = 'articles' and column_name = 'search_vector'`,
    )
  ).rows[0]?.generation_expression
  check(expr && /vh_lexical_text\(body\)/.test(expr), `${dbName}: search_vector does not read the body: ${expr}`)

  // 2 + 3. coverage and its control, over every article with body text
  cov = (
    await db.query(`
      with b as (
        select a.id, ${BODY_VEC} as body_vec, ${OLD_VEC} as old_vec, a.search_vector
          from articles a
         where a.body is not null
      )
      select count(*) filter (where body_vec <> ''::tsvector)::int as with_text,
             count(*) filter (where body_vec <> ''::tsvector
                                and not (tsvector_to_array(body_vec) <@ tsvector_to_array(search_vector)))::int as missing,
             count(*) filter (where body_vec <> ''::tsvector
                                and not (tsvector_to_array(body_vec) <@ tsvector_to_array(old_vec)))::int as old_would_miss
        from b`)
  ).rows[0]
  check(cov.with_text > 0, `${dbName}: no article body has text — the coverage check would pass vacuously`)
  checkEqual(cov.missing, 0, `${dbName}: articles whose body words are not all in search_vector`)
  check(
    cov.old_would_miss >= Math.ceil(cov.with_text * 0.9),
    `${dbName}: control — a title+excerpt index should miss body words for most articles; ` +
      `it misses them for ${cov.old_would_miss} of ${cov.with_text}`,
  )

  // 4. pick the end-to-end cases: published articles spread over the id range, each with a
  //    word unique to its body. --coverage-only skips this: the dev seed's bodies are one
  //    opening sentence (= the excerpt) plus shared demo boilerplate, so no word is unique.
  if (COVERAGE_ONLY) throw new SkipE2E()
  const candidates = (
    await db.query(`
      select a.id, a.slug, ${BODY_TEXT} as body_text, ${OLD_VEC} as old_vec
        from articles a
       where a._status = 'published' and a.body is not null
       order by a.id`)
  ).rows.filter((r) => r.body_text.length > 60)
  check(candidates.length > 0, `${dbName}: no published article with a body to search for`)
  const step = Math.max(1, Math.floor(candidates.length / 12))
  for (let i = 0; i < candidates.length && e2e.length < 5; i += step) {
    const art = candidates[i]
    const words = [...new Set(art.body_text.match(/\p{L}{8,}/gu) ?? [])].slice(0, 60)
    for (const word of words) {
      const r = await db.query(
        `select count(*)::int as n,
                bool_or(a.id = $2) as includes_it,
                bool_or(a.id = $2 and ${OLD_VEC} @@ websearch_to_tsquery('french', vh_immutable_unaccent($1))) as in_title
           from articles a
          where a._status = 'published'
            and a.search_vector @@ websearch_to_tsquery('french', vh_immutable_unaccent($1))`,
        [word, art.id],
      )
      const { n, includes_it, in_title } = r.rows[0]
      if (n === 1 && includes_it && !in_title) {
        e2e.push({ id: art.id, slug: art.slug, word })
        break
      }
    }
  }
  check(e2e.length >= Math.min(3, candidates.length), `${dbName}: found only ${e2e.length} body-only words to search for`)
} catch (err) {
  if (!(err instanceof SkipE2E)) {
    await db.end()
    if (err instanceof GateFailure) fail(err.message)
    throw err
  }
}
await db.end()

if (!COVERAGE_ONLY) await withServer(async (baseUrl) => {
  for (const { slug, word } of e2e) {
    const res = await getHtml(`${baseUrl}/recherche/?q=${encodeURIComponent(word)}`)
    checkEqual(res.status, 200, `/recherche/?q=${word} status`)
    const html = stripScripts(res.html)
    const results = html.match(/data-search-results[\s\S]*/)?.[0] ?? ''
    const item = (results.match(/<li\b[\s\S]*?<\/li>/g) ?? []).find((li) => li.includes(`/${slug}/"`))
    check(item, `searching the body-only word "${word}" did not return the article ${slug}`)
    const text = item.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&')
    check(
      text.toLocaleLowerCase('fr').includes(word.toLocaleLowerCase('fr')),
      `the result for ${slug} shows no passage containing "${word}"`,
    )
    console.error(`  "${word}" → ${slug} (snippet shows it)`)
  }
})

console.error(
  `  ${dbName}: body words of all ${cov.with_text} articles with text are indexed; ` +
    `a title+excerpt index would miss them for ${cov.old_would_miss}`,
)
ok(COVERAGE_ONLY ? 'SEARCH_BODY_COVERAGE_OK' : 'SEARCH_BODY_OK')
