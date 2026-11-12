/**
 * R3-G16 — a designed 404 (DESIGN-SPEC-R3 §5.7).
 *
 * An unknown single-segment path and an unknown article-shaped path both answer HTTP 404,
 * and the page a reader gets shows the designed 404: exactly one h1 reading
 * "Page introuvable", a search form submitting to /recherche/, and the 6 latest articles
 * as cards linking to article URLs.
 *
 * Measured in the browser, not in the server HTML: on this app a notFound() response
 * carries no server-rendered body at all — layout included — and React renders it from
 * the flight payload (found 2026-11-12; the pre-round-3 404 behaved the same, see the
 * r3-before-404 screenshot). That is recorded as a separate finding, not hidden here.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, ok } from './lib/harness.mjs'

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  for (const pathname of ['/cette-page-nexiste-pas/', '/actualite-news-express-maroc/article-qui-nexiste-pas-du-tout/']) {
    const p = await page({ width: 1440, height: 900 })
    const res = await p.goto(`${baseUrl}${pathname}`, { waitUntil: 'load', timeout: 60_000 })
    assert(res.status() === 404, `${pathname} answered ${res.status()}, expected 404`)
    await p.locator('[data-not-found]').waitFor({ state: 'visible', timeout: 15_000 })
    const m = await p.evaluate(() => ({
      h1s: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      form: !!document.querySelector('[data-not-found] form[role="search"][action="/recherche/"] input[name="q"]'),
      cards: [...document.querySelectorAll('[data-not-found-latest] [data-card]')].map(
        (c) => c.querySelector('a[href]')?.getAttribute('href') || '',
      ),
    }))
    assert(m.h1s.length === 1 && m.h1s[0] === 'Page introuvable', `${pathname}: h1s are ${JSON.stringify(m.h1s)}`)
    assert(m.form, `${pathname}: no search form to /recherche/ with a q field`)
    assert(m.cards.length === 6, `${pathname}: ${m.cards.length} latest-article cards, expected 6`)
    assert(
      m.cards.every((h) => h.startsWith('/') && h.split('/').filter(Boolean).length >= 2),
      `${pathname}: latest cards do not all link to article URLs: ${m.cards.join(', ')}`,
    )
    await p.context().close()
  }
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
  console.error('  HTTP 404, one "Page introuvable" h1, a search form and 6 latest cards — on both path shapes')
})

ok('R3_NOTFOUND_OK')
