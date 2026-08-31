/**
 * G7 — the homepage returns 200 with lang="fr", exactly one h1, and a
 * self-referencing canonical in the exact trailing-slash form (amendment A4).
 *
 * The canonical is compared against NEXT_PUBLIC_SERVER_URL, not against the
 * request host: the point of A4 is that the canonical is stable and absolute
 * regardless of which port or hostname served the response. That is also why
 * this passes while the test server runs on 3111.
 */
import { homepageHtml, assert, assertEqual, ok, loadEnv } from './lib/harness.mjs'

const env = loadEnv()
const siteUrl = (env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')
assert(siteUrl.length > 0, 'NEXT_PUBLIC_SERVER_URL is not set in .env')

const html = await homepageHtml()

// lang="fr" — spec §1 requires it on <html>.
const langMatch = /<html[^>]*\slang="([^"]*)"/i.exec(html)
assert(langMatch !== null, 'no lang attribute on <html>')
assertEqual(langMatch[1], 'fr', 'html lang attribute')

// Exactly one h1 — spec §9 "one <h1> per page".
const h1Count = (html.match(/<h1[\s>]/gi) || []).length
assertEqual(h1Count, 1, 'number of <h1> elements on the homepage')

// Self-referencing canonical, exact trailing-slash form.
const canonicalMatch = /<link[^>]+rel="canonical"[^>]*>/i.exec(html)
assert(canonicalMatch !== null, 'no <link rel="canonical"> on the homepage')
const hrefMatch = /href="([^"]*)"/i.exec(canonicalMatch[0])
assert(hrefMatch !== null, `canonical link has no href: ${canonicalMatch[0]}`)
assertEqual(hrefMatch[1], `${siteUrl}/`, 'homepage canonical href')

// A canonical that is right but accompanied by a noindex would still be broken.
const robotsMatch = /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i.exec(html)
if (robotsMatch) {
  assert(
    !/noindex/i.test(robotsMatch[1]),
    `homepage carries a noindex robots meta: "${robotsMatch[1]}"`,
  )
}

// The title pattern from spec §9.
assert(/<title>[^<]*VH Magazine[^<]*<\/title>/i.test(html), 'page title does not mention VH Magazine')

ok('HOME_OK')
