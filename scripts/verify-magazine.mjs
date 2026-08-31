/** G24 — Les Unes archive and a single sommaire page. */
import { withServer, getHtml, stripScripts, assert, assertEqual, ok, pgClient } from './lib/harness.mjs'

const client = await pgClient()
const { rows } = await client.query(
  `select slug, title, number from magazine_issues order by number desc`,
)
await client.end()
assert(rows.length > 0, 'no magazine issues seeded — G24 would pass vacuously')

await withServer(async (baseUrl) => {
  const archive = await getHtml(`${baseUrl}/magazine-maroc/`)
  assertEqual(archive.status, 200, '/magazine-maroc/ status')
  const html = stripScripts(archive.html)

  // Every seeded issue must be linked, not just the first page of them.
  const missing = rows.filter((r) => !html.includes(`href="/sommaire/${r.slug}/"`))
  assertEqual(
    missing.length,
    0,
    `issues absent from the archive: ${JSON.stringify(missing.map((m) => m.slug))}`,
  )

  const cards = ((html.match(/data-issue-grid[\s\S]*/)?.[0] || '').match(/data-card/g) || []).length
  assertEqual(cards, rows.length, 'cover cards on the Les Unes archive')

  const one = rows[0]
  const issue = await getHtml(`${baseUrl}/sommaire/${one.slug}/`)
  assertEqual(issue.status, 200, `/sommaire/${one.slug}/ status`)
  const issueHtml = stripScripts(issue.html)

  const h1 = [...issueHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
  assertEqual(h1.length, 1, 'exactly one <h1> on the sommaire page')
  assert(issueHtml.includes(one.title), 'the sommaire page does not show its issue title')
  assert(/data-issue\b/.test(issueHtml), 'sommaire page has no data-issue container')

  const missingIssue = await getHtml(`${baseUrl}/sommaire/no-such-issue-at-all/`)
  assertEqual(missingIssue.status, 404, 'an unknown issue slug must 404')

  console.error(`  ${rows.length} issues listed; /sommaire/${one.slug}/ renders`)
})

ok('MAGAZINE_OK')
