/**
 * GATES-LAUNCH L5 — image URLs in JSON-LD are the files themselves.
 *
 * `absoluteUrl()` exists for page URLs: it appends the trailing slash `trailingSlash: true`
 * serves. Applied to a file it produced `…/api/media/file/x.jpg/` (the NewsArticle image)
 * and `…/vh-logo.svg/` (the Organization logo), and Next answers both with a 308 that strips
 * the slash — so structured data pointed at redirects. G30 parses and validates the JSON-LD
 * but never requested the URLs inside it; this gate does.
 */
import { check, fail, GateFailure, getHtml, ok, withServer } from './lib/harness.mjs'

function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1])
    return Array.isArray(data) ? data : data['@graph'] ?? [data]
  })
}

const first = (v) => (Array.isArray(v) ? v[0] : v)
const urlOf = (v) => (typeof v === 'string' ? v : v?.url)

/** Request the URL's path on the server under test, without following redirects. */
async function direct(baseUrl, absolute, what) {
  check(/^https?:\/\//.test(absolute ?? ''), `${what}: ${JSON.stringify(absolute)} is not absolute`)
  const u = new URL(absolute)
  check(!u.pathname.endsWith('/'), `${what}: ${absolute} ends with a slash`)
  const res = await fetch(`${baseUrl}${u.pathname}${u.search}`, { redirect: 'manual' })
  check(res.status === 200, `${what}: ${u.pathname} answered ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}`)
  check(/^image\//.test(res.headers.get('content-type') ?? ''), `${what}: ${u.pathname} is ${res.headers.get('content-type')}, not an image`)
  await res.arrayBuffer()
}

try {
  await withServer(async (baseUrl) => {
    const home = await getHtml(`${baseUrl}/`)
    check(home.status === 200, `homepage status ${home.status}`)
    const org = jsonLd(home.html).find((n) => n['@type'] === 'Organization')
    check(org, 'homepage carries no Organization JSON-LD')
    await direct(baseUrl, urlOf(first(org.logo)), 'Organization logo')

    // The first seeded article on the homepage that has a featured image.
    const hrefs = [...new Set([...home.html.matchAll(/href="(\/[^"?#]+\/)"/g)].map((m) => m[1]))].filter(
      (h) => !h.startsWith('/category/') && [2, 3].includes(h.split('/').filter(Boolean).length),
    )
    let checked = 0
    for (const href of hrefs) {
      const page = await getHtml(`${baseUrl}${href}`)
      const article = page.status === 200 && jsonLd(page.html).find((n) => n['@type'] === 'NewsArticle')
      if (!article?.image) continue
      const image = urlOf(first(article.image))
      const og = /<meta property="og:image" content="([^"]+)"/.exec(page.html)?.[1]
      check(image === og?.replace(/&amp;/g, '&'), `${href}: JSON-LD image ${image} differs from og:image ${og}`)
      await direct(baseUrl, image, `${href} NewsArticle image`)
      checked += 1
      if (checked === 3) break
    }
    check(checked === 3, `only ${checked} articles with a JSON-LD image found among ${hrefs.length} homepage links`)
  })
} catch (e) {
  fail(e instanceof GateFailure ? e.message : (e?.stack ?? String(e)))
}

console.error('  Organization logo and 3 articles\' NewsArticle images: absolute, no trailing slash, 200 image directly, = og:image')
ok('JSONLD_IMAGE_OK')
