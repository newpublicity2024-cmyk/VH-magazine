/**
 * G17 — the Payload admin is reachable and the seeded admin user authenticates.
 *
 * This exists because of `trailingSlash: true`. That setting is required for SEO
 * continuity with the WordPress URLs, and it is exactly the kind of global
 * rewrite that can quietly break the admin's own routing and API — a failure
 * that would otherwise only surface the first time an editor tried to log in.
 *
 * Authentication is checked through the REST API rather than by driving the
 * login form: the form is Payload's, not ours, and a 200 on /admin alone would
 * pass even if every API route under the same trailing-slash rule was broken.
 */
import { withServer, getHtml, assert, assertEqual, ok, loadEnv } from './lib/harness.mjs'

const env = loadEnv()
const email = env.SEED_ADMIN_EMAIL || 'admin@vh.ma'
const password = env.SEED_ADMIN_PASSWORD || 'vhmagazine'

await withServer(async (baseUrl) => {
  // 1. The admin shell renders.
  const { status, html } = await getHtml(`${baseUrl}/admin`)
  assertEqual(status, 200, 'GET /admin status')
  assert(
    /payload/i.test(html),
    'GET /admin returned 200 but the body does not look like the Payload admin',
  )

  // 2. The REST API answers under the trailing-slash rule.
  const meRes = await fetch(`${baseUrl}/api/users/me`)
  assert(
    meRes.status === 200,
    `GET /api/users/me returned ${meRes.status} — the Payload API is broken under trailingSlash`,
  )

  // 3. The seeded admin can actually authenticate.
  const loginRes = await fetch(`${baseUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const loginBody = await loginRes.json().catch(() => ({}))

  assert(
    loginRes.status === 200,
    `login as ${email} returned ${loginRes.status}: ${JSON.stringify(loginBody).slice(0, 300)}`,
  )
  assert(
    typeof loginBody.token === 'string' && loginBody.token.length > 0,
    'login succeeded but returned no token',
  )
  assertEqual(loginBody.user?.email, email, 'authenticated user email')
  assertEqual(loginBody.user?.role, 'admin', 'authenticated user role')

  // 4. An authenticated read reaches a collection — proves the session works,
  //    not just that a token was minted.
  const authed = await fetch(`${baseUrl}/api/articles?limit=1`, {
    headers: { Authorization: `JWT ${loginBody.token}` },
  })
  assertEqual(authed.status, 200, 'authenticated GET /api/articles status')
  const list = await authed.json()
  assert(
    Array.isArray(list.docs),
    `authenticated article list has no docs array: ${JSON.stringify(list).slice(0, 200)}`,
  )

  console.error(`  admin ok: ${email} authenticated, ${list.totalDocs} articles visible`)
})

ok('ADMIN_OK')
