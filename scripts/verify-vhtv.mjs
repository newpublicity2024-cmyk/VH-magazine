/** G25 — VH TV lists the video articles with play affordances. */
import { withServer, getHtml, stripScripts, assert, assertEqual, ok, pgClient } from './lib/harness.mjs'

const client = await pgClient()
const { rows } = await client.query(`
  select a.slug from articles a
    join categories c on c.id = a.category_id
    left join categories p on p.id = c.parent_id
   where a._status = 'published' and (c.slug = 'video' or p.slug = 'video')`)
await client.end()
assert(rows.length > 0, 'no video articles seeded — G25 would pass vacuously')

await withServer(async (baseUrl) => {
  const res = await getHtml(`${baseUrl}/vh-tv/`)
  assertEqual(res.status, 200, '/vh-tv/ status')
  const html = stripScripts(res.html)

  const cards = ((html.match(/data-video-grid[\s\S]*/)?.[0] || '').match(/data-card/g) || []).length
  assertEqual(cards, rows.length, 'video cards on /vh-tv/ (must match the seeded video articles)')

  // The play affordance is what distinguishes the video variant from a plain card.
  const plays = (html.match(/<path d="M8 5v14l11-7z"/g) || []).length
  assert(plays >= rows.length, `only ${plays} play icons for ${rows.length} video cards`)

  const h1 = [...html.matchAll(/<h1\b/gi)]
  assertEqual(h1.length, 1, 'exactly one <h1> on /vh-tv/')

  console.error(`  ${cards} video cards, ${plays} play affordances`)
})

ok('VHTV_OK')
