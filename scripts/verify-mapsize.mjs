/**
 * G38 — the redirects map stays small (amendment B5).
 *
 * A tripwire, not a correctness check. Middleware fetches this map on every
 * cold start; round 2b adds ~28.6k tag redirects and ~27.8k upload paths, and
 * inlining either would push it into the megabytes. B5 routes both through a
 * lookup instead, so this asserts the map has stayed out of that business.
 */
import { withServer, getHtml, assert, assertEqual, ok } from './lib/harness.mjs'

// 256KB. Comfortably above any plausible set of one-off editorial redirects,
// and far below what even 1% of the tag archives would occupy.
const BUDGET_BYTES = 256 * 1024

await withServer(async (baseUrl) => {
  const res = await getHtml(`${baseUrl}/redirects-map.json`)
  assertEqual(res.status, 200, '/redirects-map.json status')

  const bytes = Buffer.byteLength(res.html, 'utf8')
  assert(
    bytes <= BUDGET_BYTES,
    `the redirects map is ${bytes} bytes, over the ${BUDGET_BYTES} budget. ` +
      'Amendment B5 keeps high-cardinality legacy shapes out of the map — check whether ' +
      'tag or upload redirects have leaked into it.',
  )

  let map
  try {
    map = JSON.parse(res.html)
  } catch (error) {
    throw new Error(`the redirects map is not valid JSON: ${error.message}`)
  }

  // B5: tag redirects must never be inlined; they are served by lookup.
  const tagKeys = Object.keys(map).filter((k) => k.startsWith('/tag/'))
  assertEqual(
    tagKeys.length,
    0,
    `${tagKeys.length} tag redirect(s) inlined in the map — B5 requires these be served by lookup: ${JSON.stringify(tagKeys.slice(0, 3))}`,
  )

  const uploadKeys = Object.keys(map).filter((k) => k.startsWith('/wp-content/uploads/'))
  assertEqual(uploadKeys.length, 0, `${uploadKeys.length} upload path(s) inlined in the map — these are handled by pattern`)

  // Every entry must be usable: a relative target and a permanence flag.
  for (const [from, entry] of Object.entries(map)) {
    assert(from.startsWith('/'), `redirect key ${JSON.stringify(from)} is not a rooted path`)
    assert(entry && typeof entry.to === 'string' && entry.to.startsWith('/'),
      `redirect ${from} has an unusable target ${JSON.stringify(entry?.to)}`)
    assert(from !== entry.to, `redirect ${from} points at itself — infinite bounce`)
  }

  console.error(`  ${bytes} bytes / ${BUDGET_BYTES} budget, ${Object.keys(map).length} entries, no tag or upload keys`)
})

ok('MAPSIZE_OK')
