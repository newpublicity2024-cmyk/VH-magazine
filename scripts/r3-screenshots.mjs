/**
 * Screenshot set for the round-3 owner review (R3-G12, DESIGN-SPEC-R3 §10).
 *
 *   node scripts/r3-screenshots.mjs <prefix>
 *
 * Writes .playwright-mcp/<prefix>-<page>-<width>.jpeg (gitignored) for home, article,
 * category, VH TV, the search panel open, the drawer open (390 only) and the 404, at
 * 1440 and 390. Not a gate: it produces the evidence a person reviews.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { withBrowser } from './lib/browser.mjs'
import { assert, ok, ROOT } from './lib/harness.mjs'

const prefix = process.argv[2]
assert(prefix && /^[\w-]+$/.test(prefix), 'usage: node scripts/r3-screenshots.mjs <prefix>')
const OUT = path.join(ROOT, '.playwright-mcp')
mkdirSync(OUT, { recursive: true })

const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]

await withBrowser(async ({ page, baseUrl }) => {
  const probe = await page({ width: 1440, height: 900 })
  await probe.goto(`${baseUrl}/`, { waitUntil: 'load' })
  const article = await probe.locator('[data-section="actu"] [data-card] a[href]').first().getAttribute('href')
  await probe.context().close()

  const shots = [
    { name: 'home', url: '/' },
    { name: 'article', url: article },
    { name: 'category', url: '/category/actualite-news-express-maroc/' },
    { name: 'vhtv', url: '/vh-tv/' },
    { name: 'search', url: '/', action: async (p) => {
      await p.locator('[data-search-trigger]').first().click()
      await p.keyboard.type('maroc', { delay: 40 })
      await p.waitForTimeout(1200)
    }, viewportOnly: true },
    { name: 'drawer', url: '/', only: 390, action: async (p) => {
      await p.locator('[data-drawer-trigger]').first().click()
      await p.waitForTimeout(700)
    }, viewportOnly: true },
    { name: '404', url: '/cette-page-nexiste-pas/' },
  ]

  for (const vp of WIDTHS) {
    for (const s of shots) {
      if (s.only && s.only !== vp.width) continue
      const p = await page(vp)
      await p.goto(`${baseUrl}${s.url}`, { waitUntil: 'load', timeout: 60_000 })
      // Let lazy images below the fold load before a full-page capture.
      if (!s.viewportOnly) {
        await p.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y)
            await new Promise((r) => setTimeout(r, 60))
          }
          window.scrollTo(0, 0)
        })
        await p.waitForTimeout(800)
      }
      if (s.action) await s.action(p)
      const file = path.join(OUT, `${prefix}-${s.name}-${vp.width}.jpeg`)
      await p.screenshot({ path: file, fullPage: !s.viewportOnly, type: 'jpeg', quality: 70 })
      console.error(`  ${path.relative(ROOT, file)}`)
      await p.context().close()
    }
  }
})

ok('SCREENSHOTS_OK')
