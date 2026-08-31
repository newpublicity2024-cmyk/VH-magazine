/**
 * G34 — redirect middleware.
 *
 * Creates a real redirect row, confirms the middleware serves it, and — the
 * control — confirms a LIVE url is left alone. A middleware that redirected
 * everything would satisfy the first assertion on its own.
 */
import { withServer, getHtml, assert, assertEqual, ok, pgClient } from './lib/harness.mjs'

const stamp = Date.now()
const FROM = `/g34-old-path-${stamp}/`
const TO = '/moteur/vh-moteur/porsche-licone-sous-pression/'

const client = await pgClient()
await client.query(`delete from redirects where "from" like '/g34-%'`)
await client.query(
  `insert into redirects ("from", "to", permanent, source, updated_at, created_at)
   values ($1, $2, true, 'manual', now(), now())`,
  [FROM, TO],
)
await client.end()

try {
  await withServer(async (baseUrl) => {
    const raw = async (path) => {
      const res = await fetch(`${baseUrl}${path}`, { redirect: 'manual' })
      return { status: res.status, location: res.headers.get('location') }
    }

    const hit = await raw(FROM)
    assert(
      hit.status === 301 || hit.status === 308,
      `a stored redirect must return 301/308 — measured ${hit.status} for ${FROM}`,
    )
    assertEqual(new URL(hit.location, baseUrl).pathname, TO, `redirect target for ${FROM}`)

    // The target must be terminal, or readers bounce.
    const target = await raw(TO)
    assertEqual(target.status, 200, 'the redirect target must resolve, not redirect again')

    // Control: a live URL must NOT be redirected.
    for (const live of ['/', '/category/moteur/', '/vh-tv/', TO]) {
      const res = await raw(live)
      assertEqual(res.status, 200, `${live} is live and must not be redirected (measured ${res.status})`)
    }

    // An unknown path still 404s rather than redirecting somewhere arbitrary.
    const unknown = await getHtml(`${baseUrl}/g34-not-in-the-map-${stamp}/`)
    assertEqual(unknown.status, 404, 'a path with no redirect must 404, not redirect')

    console.error(`  ${FROM} -> ${hit.status} -> ${TO}; live URLs untouched`)
  })
} finally {
  const c = await pgClient()
  await c.query(`delete from redirects where "from" like '/g34-%'`)
  await c.end()
}

ok('MIDDLEWARE_OK')
