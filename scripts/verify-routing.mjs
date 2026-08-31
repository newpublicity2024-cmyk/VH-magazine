/**
 * G21 — article routing and amendment B4.
 *
 * Four behaviours, and the negative controls are the point:
 *   1. a canonical 3-segment URL renders 200
 *   2. a canonical 2-segment URL renders 200
 *   3. a WRONG category path permanently redirects to the canonical URL
 *   4. an unknown slug still 404s — proving (3) is not a blanket redirect
 * Plus: the redirect target itself returns 200, so B4 cannot loop.
 */
import { withServer, getHtml, assert, assertEqual, ok } from './lib/harness.mjs'

const CANONICAL_3 = '/moteur/vh-moteur/porsche-licone-sous-pression/'
const CANONICAL_2 = '/actualite-news-express-maroc/starlink-pret-a-embarquer-avec-royal-air-maroc/'
const WRONG_PATH = '/sport/porsche-licone-sous-pression/'
const UNKNOWN = '/moteur/vh-moteur/definitely-not-a-real-article-slug/'

await withServer(async (baseUrl) => {
  const raw = async (path) => {
    const res = await fetch(`${baseUrl}${path}`, { redirect: 'manual' })
    return { status: res.status, location: res.headers.get('location') }
  }

  const c3 = await raw(CANONICAL_3)
  assertEqual(c3.status, 200, `canonical 3-segment URL ${CANONICAL_3}`)

  const c2 = await raw(CANONICAL_2)
  assertEqual(c2.status, 200, `canonical 2-segment URL ${CANONICAL_2}`)

  // B4: permanent redirect. Next's permanentRedirect emits 308; 301 is accepted
  // too since the amendment names it and both are permanent for canonicalisation.
  const wrong = await raw(WRONG_PATH)
  assert(
    wrong.status === 301 || wrong.status === 308,
    `wrong-category path ${WRONG_PATH} must permanently redirect (301/308) — measured ${wrong.status}`,
  )
  const target = new URL(wrong.location, baseUrl).pathname
  assertEqual(target, CANONICAL_3, `redirect target for ${WRONG_PATH}`)

  // No loop: the target must itself be terminal.
  const followed = await raw(target)
  assertEqual(followed.status, 200, `redirect target ${target} must be terminal, not another redirect`)

  // Negative control: the 301 branch must not swallow genuinely missing articles.
  const missing = await raw(UNKNOWN)
  assertEqual(missing.status, 404, `unknown slug ${UNKNOWN} (proves B4 is not a blanket redirect)`)

  // The rendered article must actually be the right one.
  const { html } = await getHtml(`${baseUrl}${CANONICAL_3}`)
  assert(
    /Porsche/i.test(html),
    'the canonical 3-segment URL did not render the expected article title',
  )

  console.error(`  ${WRONG_PATH} -> ${wrong.status} -> ${target}`)
  console.error(`  ${UNKNOWN} -> 404`)
})

ok('ROUTING_OK')
