/**
 * R3-G2 — contrast holds (DESIGN-SPEC-R3 §3.1, §7).
 *
 * Measures the text a reader relies on — dates, kickers, band labels, nav, buttons,
 * body links, titles and dates on the dark sections, footer links — at 1440 and 390,
 * against the background actually composited behind each element (lib/r3.mjs). axe
 * (R3-G11) also checks contrast, but only for what it can see in its default state;
 * this gate names the roles the spec promises and requires each to be present, so a
 * role that silently disappeared cannot pass by absence.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok } from './lib/harness.mjs'
import { CONTRAST_LIB, seededArticleHref } from './lib/r3.mjs'

/** role → [selector, minimum count on the page where it must appear] */
const ROLES = {
  home: {
    date: ['time[data-date]', 20],
    'band label': ['.vh-band h2, .vh-band a', 3],
    'dark-section title': ['[data-tone="dark"] [data-headline]', 8],
    'dark-section date': ['[data-tone="dark"] time[data-date]', 8],
    button: ['[data-button]', 3],
    'footer link': ['[data-section="footer"] a', 10],
    'widget title': ['[data-widget] h2', 3],
  },
  article: {
    date: ['time[data-date]', 1],
    kicker: ['[data-kicker]', 1],
    breadcrumb: ['[data-breadcrumbs] a, [data-breadcrumbs] [aria-current]', 2],
    'body text': ['[data-article-body] p', 1],
  },
}
const DESKTOP_ONLY = {
  nav: ['[data-nav="primary"] [data-nav-item] > a, [data-nav="primary"] [data-nav-item] > button', 8],
  'top bar link': ['[data-nav="topbar"] a', 6],
}

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const probe = await page({ width: 1440, height: 900 })
  const article = await seededArticleHref(probe, baseUrl)
  await probe.context().close()

  const failures = []
  let measured = 0
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const [pageKey, url] of [['home', '/'], ['article', article]]) {
      const p = await page(vp)
      await p.addInitScript(CONTRAST_LIB)
      await p.goto(`${baseUrl}${url}`, { waitUntil: 'load', timeout: 60_000 })
      const roles = { ...ROLES[pageKey], ...(vp.width >= 1024 && pageKey === 'home' ? DESKTOP_ONLY : {}) }
      for (const [role, [selector, min]] of Object.entries(roles)) {
        const results = await p.evaluate((sel) => {
          return [...document.querySelectorAll(sel)]
            .filter((el) => window.__r3.visible(el) && el.textContent.trim())
            .map((el) => ({ text: el.textContent.trim().slice(0, 40), ...window.__r3.measure(el) }))
        }, selector)
        if (results.length < min) {
          failures.push(`${pageKey}@${vp.width}: role "${role}" — found ${results.length} visible element(s), expected ≥ ${min} (${selector})`)
          continue
        }
        for (const r of results) {
          measured += 1
          if (r.imageBehind) continue
          if (r.ratio < r.need) {
            failures.push(`${pageKey}@${vp.width}: ${role} "${r.text}" ${r.ratio}:1 < ${r.need}:1 (${r.color}, ${r.size}px)`)
          }
        }
      }
      await p.context().close()
    }
  }
  if (failures.length) fail(`${failures.length} contrast failure(s):\n  ${failures.slice(0, 30).join('\n  ')}`)
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
  console.error(`  ${measured} text elements measured, all ≥ their WCAG AA threshold`)
})

ok('R3_CONTRAST_OK')
