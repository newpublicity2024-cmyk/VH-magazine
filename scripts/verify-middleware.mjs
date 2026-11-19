/**
 * G34 — redirect middleware.
 *
 * Creates a real redirect row, confirms the middleware serves it, and — the
 * control — confirms a LIVE url is left alone. A middleware that redirected
 * everything would satisfy the first assertion on its own.
 *
 * The row must not outlive the run on any path (G43 proves the failure path): checks
 * throw rather than exit, withCleanup always deletes it, and each run first sweeps rows
 * an interrupted earlier run left.
 */
import {
  withServer,
  withCleanup,
  getHtml,
  check,
  checkEqual,
  assert,
  injectedFailure,
  ok,
  pgClient,
} from './lib/harness.mjs'

const stamp = Date.now()
const FROM = `/g34-old-path-${stamp}/`
const TO = '/moteur/vh-moteur/porsche-licone-sous-pression/'

const sweep = async (pattern) => {
  const c = await pgClient()
  try {
    const deleted = (await c.query('delete from redirects where "from" ~ $1', [pattern])).rowCount
    const { rows } = await c.query('select count(*)::int as n from redirects where "from" ~ $1', [
      pattern,
    ])
    return { deleted, left: rows[0].n }
  } finally {
    await c.end()
  }
}

const stale = await sweep('^/g34-old-path-[0-9]+/$')
if (stale.deleted) console.error(`  removed ${stale.deleted} redirect(s) left by an earlier run`)

const client = await pgClient()
await client.query(
  `insert into redirects ("from", "to", permanent, source, updated_at, created_at)
   values ($1, $2, true, 'manual', now(), now())`,
  [FROM, TO],
)
await client.end()

let cleaned
await withCleanup(
  async () => {
    await withServer(async (baseUrl) => {
      const raw = async (path) => {
        const res = await fetch(`${baseUrl}${path}`, { redirect: 'manual' })
        return { status: res.status, location: res.headers.get('location') }
      }

      const hit = await raw(FROM)
      check(
        hit.status === 301 || hit.status === 308,
        `a stored redirect must return 301/308 — measured ${hit.status} for ${FROM}`,
      )
      checkEqual(new URL(hit.location, baseUrl).pathname, TO, `redirect target for ${FROM}`)

      // The target must be terminal, or readers bounce.
      const target = await raw(TO)
      checkEqual(target.status, 200, 'the redirect target must resolve, not redirect again')

      // Control: a live URL must NOT be redirected.
      for (const live of ['/', '/category/moteur/', '/vh-tv/', TO]) {
        const res = await raw(live)
        checkEqual(
          res.status,
          200,
          `${live} is live and must not be redirected (measured ${res.status})`,
        )
      }

      // An unknown path still 404s rather than redirecting somewhere arbitrary.
      const unknown = await getHtml(`${baseUrl}/g34-not-in-the-map-${stamp}/`)
      checkEqual(unknown.status, 404, 'a path with no redirect must 404, not redirect')

      console.error(`  ${FROM} -> ${hit.status} -> ${TO}; live URLs untouched`)
    })
    injectedFailure('assert')
  },
  async () => {
    cleaned = await sweep(`^/g34-old-path-${stamp}/$`)
    console.error(`  cleanup: deleted ${cleaned.deleted} redirect(s), left ${cleaned.left}`)
  },
)

// The deletion doubles as a control: a pattern that no longer matched would find nothing.
assert(
  cleaned.deleted === 1 && cleaned.left === 0,
  `cleanup deleted ${cleaned.deleted}, left ${cleaned.left}`,
)
ok('MIDDLEWARE_OK')
