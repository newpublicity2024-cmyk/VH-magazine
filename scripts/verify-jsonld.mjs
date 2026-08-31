/** G30 — JSON-LD is present, parses, and carries the required fields. */
import { withServer, getHtml, assert, assertEqual, ok, loadEnv } from './lib/harness.mjs'

const env = loadEnv()
const ORIGIN = (env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')

/** Parse every ld+json block. Deliberately reads the RAW html — these live in
 *  <script>, which the DOM harness strips. */
function blocks(html) {
  const out = []
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      out.push(JSON.parse(m[1].replace(/\\u003c/g, '<')))
    } catch (error) {
      throw new Error(`a JSON-LD block did not parse: ${error.message}`)
    }
  }
  return out
}

await withServer(async (baseUrl) => {
  const home = await getHtml(`${baseUrl}/`)
  const homeLd = blocks(home.html)
  const types = homeLd.map((b) => b['@type'])
  assert(types.includes('WebSite'), `homepage is missing WebSite JSON-LD — found ${JSON.stringify(types)}`)
  assert(types.includes('Organization'), `homepage is missing Organization JSON-LD — found ${JSON.stringify(types)}`)

  const site = homeLd.find((b) => b['@type'] === 'WebSite')
  assertEqual(site.url, `${ORIGIN}/`, 'WebSite url must be the absolute production origin (B2)')

  const org = homeLd.find((b) => b['@type'] === 'Organization')
  assert(org.name, 'Organization has no name')
  assert(String(org.logo).startsWith(ORIGIN), `Organization logo must be absolute on ${ORIGIN}`)

  const art = await getHtml(`${baseUrl}/moteur/vh-moteur/porsche-licone-sous-pression/`)
  const artLd = blocks(art.html)
  const artTypes = artLd.map((b) => b['@type'])
  assert(artTypes.includes('NewsArticle'), `article is missing NewsArticle JSON-LD — found ${JSON.stringify(artTypes)}`)
  assert(artTypes.includes('BreadcrumbList'), `article is missing BreadcrumbList — found ${JSON.stringify(artTypes)}`)

  const news = artLd.find((b) => b['@type'] === 'NewsArticle')
  for (const field of ['headline', 'datePublished', 'url', 'publisher']) {
    assert(news[field], `NewsArticle is missing required field "${field}"`)
  }
  assert(String(news.url).startsWith(ORIGIN), `NewsArticle url must be absolute on ${ORIGIN} (B2), measured ${news.url}`)
  assertEqual(news.inLanguage, 'fr', 'NewsArticle inLanguage')

  const crumbs = artLd.find((b) => b['@type'] === 'BreadcrumbList')
  assert(Array.isArray(crumbs.itemListElement) && crumbs.itemListElement.length >= 3,
    `BreadcrumbList needs at least Home > Category > Article, measured ${crumbs.itemListElement?.length}`)
  const positions = crumbs.itemListElement.map((i) => i.position)
  assertEqual(JSON.stringify(positions), JSON.stringify(positions.slice().sort((a, b) => a - b)),
    'BreadcrumbList positions must ascend')

  console.error(`  home: ${types.join(', ')} | article: ${artTypes.join(', ')}`)
})

ok('JSONLD_OK')
