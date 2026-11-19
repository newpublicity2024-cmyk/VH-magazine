/**
 * R3-G11 — accessibility kept (DESIGN-SPEC-R3 §7, extends G16).
 *
 * axe (WCAG 2.0/2.1 A + AA) on home, article, category, search results and the 404, at
 * 1440 and 390, plus the open drawer (390) and open search panel (1440): zero serious or
 * critical violations. A vacuity guard rejects any scan that evaluated ≤ 20 rules.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok } from './lib/harness.mjs'
import { seededArticleHref } from './lib/r3.mjs'

const { default: AxeBuilder } = await import('@axe-core/playwright')
const BLOCKING = new Set(['serious', 'critical'])

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const probe = await page({ width: 1440, height: 900 })
  const article = await seededArticleHref(probe, baseUrl)
  await probe.context().close()

  const targets = [
    ['home', '/'],
    ['article', article],
    ['category', '/category/actualite-news-express-maroc/'],
    ['search', '/recherche/?q=maroc'],
    ['404', '/cette-page-nexiste-pas/'],
  ]
  const problems = []
  let scans = 0
  const run = async (p, label) => {
    const results = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const checked = results.passes.length + results.violations.length + results.incomplete.length
    assert(checked > 20, `${label}: axe evaluated only ${checked} rules — injection probably failed`)
    for (const v of results.violations.filter((x) => BLOCKING.has(x.impact))) {
      problems.push(`${label}: [${v.impact}] ${v.id} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
    }
    scans += 1
  }

  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const [name, url] of targets) {
      const p = await page(vp)
      await p.goto(`${baseUrl}${url}`, { waitUntil: 'load', timeout: 60_000 })
      await p.waitForTimeout(400)
      await run(p, `${name}@${vp.width}`)
      await p.context().close()
    }
  }

  const m = await page({ width: 390, height: 844 })
  await m.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  await m.locator('[data-drawer-trigger]').first().click()
  await m.waitForTimeout(700)
  await run(m, 'drawer-open@390')
  await m.context().close()

  const d = await page({ width: 1440, height: 900 })
  await d.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  await d.locator('[data-search-trigger]').first().click()
  await d.keyboard.type('maroc', { delay: 30 })
  await d.waitForTimeout(1200)
  await run(d, 'search-open@1440')
  await d.context().close()

  if (problems.length) fail(`${problems.length} serious/critical axe violation(s):\n  ${problems.join('\n  ')}`)
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
  console.error(`  ${scans} axe scans, 0 serious/critical violations`)
})

ok('R3_A11Y_OK')
