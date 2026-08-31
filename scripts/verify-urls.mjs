/**
 * G11 — URL scheme conformance (amendment A1).
 *
 * Two halves, and the second is the one that matters:
 *
 *  1. Every article link matches the 2-or-3-segment nested form, and every
 *     category link sits under /category/.
 *  2. At least one article link actually HAS three segments.
 *
 * Without (2) the regex is permissive enough to pass on a site that never nests
 * anything — it would certify the nested-URL requirement while never exercising
 * it. The seed is required to file an article under moteur/vh-moteur precisely
 * so this clause has something to find.
 *
 * Negative control:  node scripts/verify-urls.mjs --self-test
 */
import { homepageHtml, assert, assertEqual, ok, fail, attrValues } from './lib/harness.mjs'

const ARTICLE_RE = /^\/[a-z0-9-]+(\/[a-z0-9-]+)?\/[a-z0-9-]+\/$/
const CATEGORY_RE = /^\/category\/[a-z0-9-]+(\/[a-z0-9-]+)?\/$/

/** Paths that are legitimately not articles or categories. */
const STATIC_PATHS = new Set([
  '/',
  '/magazine-maroc/',
  '/contact/',
  '/rafik-lahlou-team-vh/',
  '/sondage/',
  '/vh-tv/',
  '/vh-grand-angle-2/',
  '/who-s-who-les-interviews-de-vh/',
  '/le-luxe/',
  '/recherche/',
  '/admin',
  '/admin/',
])

function classify(html) {
  const hrefs = attrValues(html, 'href')
  const internal = hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//'))

  const categoryLinks = internal.filter((h) => h.startsWith('/category/'))
  // A path with a file extension is an asset (/vh-logo.svg, /kit-media.pdf),
  // not an article. Article slugs never contain a dot.
  const isAsset = (h) => /\.[a-z0-9]{2,5}(\?|$)/i.test(h)

  const articleLinks = internal.filter(
    (h) =>
      !h.startsWith('/category/') &&
      !STATIC_PATHS.has(h) &&
      !h.startsWith('/sommaire/') &&
      !h.startsWith('/_next/') &&
      !h.startsWith('/api/') &&
      !h.startsWith('/#') &&
      !isAsset(h),
  )
  return { articleLinks, categoryLinks }
}

function check(html, { requireNested = true } = {}) {
  const { articleLinks, categoryLinks } = classify(html)

  assert(articleLinks.length > 0, 'no article links found on the homepage')
  assert(categoryLinks.length > 0, 'no category links found on the homepage')

  const badArticles = [...new Set(articleLinks.filter((h) => !ARTICLE_RE.test(h)))]
  assert(
    badArticles.length === 0,
    `${badArticles.length} article link(s) do not match ${ARTICLE_RE}: ${JSON.stringify(
      badArticles.slice(0, 5),
    )}`,
  )

  const badCategories = [...new Set(categoryLinks.filter((h) => !CATEGORY_RE.test(h)))]
  assert(
    badCategories.length === 0,
    `${badCategories.length} category link(s) do not match ${CATEGORY_RE}: ${JSON.stringify(
      badCategories.slice(0, 5),
    )}`,
  )

  // Vacuity guard: the nested case must be present, not merely permitted.
  if (requireNested) {
    const segmentsOf = (h) => h.split('/').filter(Boolean).length
    const nested = [...new Set(articleLinks.filter((h) => segmentsOf(h) === 3))]
    assert(
      nested.length > 0,
      'no 3-segment article link on the homepage. The regex accepts nested URLs but ' +
        'nothing exercises them — seed an article under a subcategory (moteur/vh-moteur).',
    )
    console.error(`  nested article links found: ${JSON.stringify(nested.slice(0, 3))}`)
  }

  return { articleLinks, categoryLinks }
}

if (process.argv.includes('--self-test')) {
  const valid =
    '<a href="/moteur/vh-moteur/porsche-licone-sous-pression/"></a>' +
    '<a href="/actualite-news-express-maroc/starlink/"></a>' +
    '<a href="/category/moteur/"></a>'

  // Control A: a 4-segment article link must be rejected.
  let rejectedTooDeep = false
  try {
    const { articleLinks } = classify(valid + '<a href="/a/b/c/d/"></a>')
    rejectedTooDeep = articleLinks.some((h) => !ARTICLE_RE.test(h))
  } catch {
    /* ignore */
  }
  if (!rejectedTooDeep) fail('self-test A: a 4-segment article link was ACCEPTED. Oracle is broken.')

  // Control B: an all-flat page must fail the vacuity guard.
  const flatOnly =
    '<a href="/actualite-news-express-maroc/starlink/"></a><a href="/category/moteur/"></a>'
  const { articleLinks } = classify(flatOnly)
  const hasNested = articleLinks.some((h) => h.split('/').filter(Boolean).length === 3)
  if (hasNested) fail('self-test B: flat-only fixture reported a nested link. Oracle is broken.')

  console.log('self-test: both negative controls rejected as expected')
  process.exit(0)
}

const html = await homepageHtml()
const { articleLinks, categoryLinks } = check(html)
console.error(
  `  measured ${articleLinks.length} article links, ${categoryLinks.length} category links`,
)
ok('URLS_OK')
