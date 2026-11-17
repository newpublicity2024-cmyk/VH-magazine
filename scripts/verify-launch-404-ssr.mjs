/**
 * GATES-LAUNCH L4 — a 404 is server-rendered.
 *
 * Until this fix every notFound() answered Next's error shell: `<html id="__next_error__">`
 * with an empty `<body>`, and React drew the designed 404 from the flight payload once the
 * scripts ran. The app has two root layouts ((frontend) and Payload's admin), so Next had no
 * root layout to render its not-found fallback into (app-render's createNotFoundLoaderTree
 * takes only the top-level not-found / global-not-found). A reader without JavaScript — or a
 * slow phone before hydration — saw a blank page.
 *
 * Measured two ways: in the raw HTML with every <script> and <template> stripped (what exists
 * before any script runs), and in Chromium with JavaScript disabled (what a reader sees).
 * R3-G16 and R3-G11 keep measuring the hydrated page.
 */
import { withPage } from './lib/browser.mjs'
import { attrValues, check, countMarkers, elementHtml, fail, GateFailure, ok, stripScripts } from './lib/harness.mjs'

const UNKNOWN = [
  '/this-path-does-not-exist-at-all/', //                 1 segment (catch-all)
  '/moteur/no-such-article-9182/', //                      2 segments
  '/moteur/vh-moteur/no-such-article-9182/', //            3 segments
  '/a/b/c/d/', //                                          4 segments (outside the article shapes)
  '/category/no-such-category-9182/',
  '/sommaire/no-such-issue-9182/',
]
const CONTROL = '/category/moteur/'

const h1s = (dom) => [...dom.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim())

function checkServerHtml(pathname, status, headers, html) {
  check(status === 404, `${pathname}: status ${status}, expected 404`)
  const dom = stripScripts(html)
  check(!dom.includes('id="__next_error__"'), `${pathname}: answered Next's error shell (__next_error__)`)
  check(/<html\b[^>]*\blang="fr"/.test(dom), `${pathname}: no <html lang="fr">`)
  const robots = `${headers.get('x-robots-tag') ?? ''} ${/<meta name="robots" content="([^"]*)"/.exec(dom)?.[1] ?? ''}`
  check(/noindex/.test(robots), `${pathname}: not marked noindex (${robots.trim() || 'nothing'})`)
  check(/<title>[^<]*Page introuvable[^<]*<\/title>/.test(dom), `${pathname}: <title> does not say "Page introuvable"`)
  check(/<link\b[^>]*rel="stylesheet"/.test(dom), `${pathname}: no stylesheet link — the page would render unstyled`)
  check(dom.includes('data-masthead'), `${pathname}: no masthead`)
  check(dom.includes('data-nav="primary"'), `${pathname}: no primary nav`)
  check(dom.includes('data-section="footer"'), `${pathname}: no footer`)
  const titles = h1s(dom)
  check(titles.length === 1 && titles[0] === 'Page introuvable', `${pathname}: h1s ${JSON.stringify(titles)}`)
  check(
    /<form\b[^>]*role="search"[^>]*action="\/recherche\/"[\s\S]*?name="q"/.test(elementHtml(dom, 'data-not-found', 'true') ?? ''),
    `${pathname}: no search form to /recherche/ with a q field inside the 404 body`,
  )
  const latest = elementHtml(dom, 'data-not-found-latest', 'true') ?? ''
  const cards = countMarkers(latest, ' data-card="true"')
  check(cards === 6, `${pathname}: ${cards} latest-article cards in the server HTML, expected 6`)
  const hrefs = attrValues(latest, 'href').filter((h) => h.startsWith('/'))
  check(hrefs.some((h) => h.split('/').filter(Boolean).length >= 2), `${pathname}: latest cards link to no article URL`)
}

try {
  await withPage(async ({ baseUrl, browser }) => {
    for (const pathname of UNKNOWN) {
      const res = await fetch(`${baseUrl}${pathname}`)
      checkServerHtml(pathname, res.status, res.headers, await res.text())
    }

    const control = await fetch(`${baseUrl}${CONTROL}`)
    const controlDom = stripScripts(await control.text())
    check(control.status === 200, `control ${CONTROL}: status ${control.status}`)
    const controlH1 = h1s(controlDom)
    check(controlH1.length === 1 && controlH1[0] !== 'Page introuvable', `control ${CONTROL}: h1s ${JSON.stringify(controlH1)}`)

    // A reader without JavaScript.
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } })
    try {
      for (const pathname of [UNKNOWN[0], UNKNOWN[2]]) {
        const page = await context.newPage()
        const res = await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'load', timeout: 60_000 })
        check(res.status() === 404, `no-JS ${pathname}: status ${res.status()}`)
        const seen = await page.evaluate(() => ({
          h1: [...document.querySelectorAll('h1')].filter((h) => h.checkVisibility()).map((h) => h.textContent.trim()),
          headlines: [...document.querySelectorAll('[data-not-found-latest] [data-card] [data-headline]')].filter((h) =>
            h.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
          ).length,
          nav: !!document.querySelector('[data-section="footer"]')?.checkVisibility(),
        }))
        check(seen.h1.length === 1 && seen.h1[0] === 'Page introuvable', `no-JS ${pathname}: visible h1s ${JSON.stringify(seen.h1)}`)
        check(seen.headlines === 6, `no-JS ${pathname}: ${seen.headlines} visible latest-article headlines, expected 6`)
        check(seen.nav, `no-JS ${pathname}: the footer is not visible`)
        await page.close()
      }
    } finally {
      await context.close()
    }
  })
} catch (e) {
  fail(e instanceof GateFailure ? e.message : (e?.stack ?? String(e)))
}

console.error(`  ${UNKNOWN.length} unknown paths: 404, noindex, chrome + h1 + search + 6 cards in the server HTML; visible without JavaScript; ${CONTROL} 200`)
ok('NOTFOUND_SSR_OK')
