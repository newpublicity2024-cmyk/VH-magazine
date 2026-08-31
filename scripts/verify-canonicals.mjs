/**
 * G36 — every page type emits exactly one h1 and a self-referencing canonical
 * built on the absolute production origin (amendment B2).
 *
 * B2 is the assertion that matters at cutover: if any canonical were built from
 * the deployment host, the staging domain would advertise itself as the
 * canonical version of the site and the real domain would be treated as the
 * duplicate. Because the origin is pinned to NEXT_PUBLIC_SERVER_URL, nothing in
 * the markup changes at DNS switch — which is exactly what this proves.
 */
import { withServer, getHtml, stripScripts, assert, assertEqual, ok, loadEnv } from './lib/harness.mjs'

const env = loadEnv()
const ORIGIN = (env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')
assert(ORIGIN, 'NEXT_PUBLIC_SERVER_URL is not set in .env')

const PAGES = [
  { path: '/', canonical: '/' },
  { path: '/moteur/vh-moteur/porsche-licone-sous-pression/', canonical: '/moteur/vh-moteur/porsche-licone-sous-pression/' },
  { path: '/category/moteur/', canonical: '/category/moteur/' },
  { path: '/category/moteur/vh-moteur/', canonical: '/category/moteur/vh-moteur/' },
  { path: '/magazine-maroc/', canonical: '/magazine-maroc/' },
  { path: '/sommaire/vh-201/', canonical: '/sommaire/vh-201/' },
  { path: '/vh-tv/', canonical: '/vh-tv/' },
  { path: '/contact/', canonical: '/contact/' },
  { path: '/rafik-lahlou-team-vh/', canonical: '/rafik-lahlou-team-vh/' },
  { path: '/sondage/', canonical: '/sondage/' },
]

await withServer(async (baseUrl) => {
  for (const page of PAGES) {
    const res = await getHtml(`${baseUrl}${page.path}`)
    assertEqual(res.status, 200, `${page.path} status`)

    // Canonical lives in <head>; the DOM copy is what matters, and stripping
    // scripts keeps the RSC payload's duplicate out of the count.
    const html = stripScripts(res.html)

    const h1s = [...html.matchAll(/<h1\b/gi)]
    assertEqual(h1s.length, 1, `${page.path} must have exactly one <h1>, measured ${h1s.length}`)

    const canonicals = [...html.matchAll(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/gi)].map((m) => m[1])
    assertEqual(canonicals.length, 1, `${page.path} must have exactly one canonical link, measured ${canonicals.length}`)

    const expected = `${ORIGIN}${page.canonical}`
    assertEqual(canonicals[0], expected, `${page.path} canonical`)

    // B2: derived from configuration, NOT from the request.
    //
    // Asserted by comparing against the host actually serving this response.
    // withServer binds a random port, so a canonical that matched it would be
    // request-derived — which is precisely the failure that would make a
    // preview deployment declare itself canonical. Checking for the literal
    // string "localhost" would be wrong instead: locally the configured origin
    // IS localhost, and the property under test is provenance, not spelling.
    const servingHost = new URL(baseUrl).host
    assert(
      !canonicals[0].includes(servingHost),
      `${page.path} canonical is built from the serving host ${servingHost} instead of the configured origin: ${canonicals[0]}`,
    )
  }

  // The search page is the one type that must be noindex rather than canonical-indexed.
  const search = await getHtml(`${baseUrl}/recherche/?q=test`)
  const searchHtml = stripScripts(search.html)
  assert(
    /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(searchHtml),
    'the search results page must be noindex — it is thin and infinite in variety',
  )

  console.error(`  ${PAGES.length} page types: one h1 each, canonical absolute on ${ORIGIN}`)
})

ok('CANONICALS_OK')
