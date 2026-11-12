/**
 * R3-G6 — header compact mode causes no shift (DESIGN-SPEC-R3 §4.2, §8).
 *
 * At 1440 the black masthead scrolls away and the sticky bar stays. The bar's height
 * must be identical at scroll 0 and 800, the compact mark must be invisible at the top
 * (opacity 0) and fully shown after scrolling (opacity 1), and a layout-shift observer
 * installed before first paint must total ≤ 0.02 over a scripted scroll down and back.
 * At 390 the bar height must also hold.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, ok } from './lib/harness.mjs'

const CLS_OBSERVER = `
window.__cls = 0; window.__shifts = [];
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    if (e.hadRecentInput) continue
    window.__cls += e.value
    window.__shifts.push({ v: e.value, src: (e.sources || []).map((s) => s.node && s.node.nodeName + '.' + String(s.node.className || '').slice(0, 40)) })
  }
}).observe({ type: 'layout-shift', buffered: true })
`

const barHeight = (p) => p.locator('[data-sticky-header]').evaluate((el) => el.getBoundingClientRect().height)
const markOpacity = (p) => p.locator('[data-compact-mark]').evaluate((el) => Number(getComputedStyle(el).opacity))

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const d = await page({ width: 1440, height: 900 })
  await d.emulateMedia({ reducedMotion: 'no-preference' })
  await d.addInitScript(CLS_OBSERVER)
  await d.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  await d.waitForTimeout(500)

  const h0 = await barHeight(d)
  const o0 = await markOpacity(d)
  assert(o0 === 0, `compact mark is visible at the top of the page (opacity ${o0})`)

  for (let y = 0; y <= 3000; y += 150) {
    await d.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y)
    await d.waitForTimeout(40)
  }
  await d.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }))
  await d.waitForTimeout(600)
  const h800 = await barHeight(d)
  const o800 = await markOpacity(d)
  const top = await d.locator('[data-sticky-header]').evaluate((el) => el.getBoundingClientRect().top)
  assert(Math.abs(top) <= 1, `sticky bar is not pinned at 800px (top ${top})`)
  assert(h0 === h800, `sticky bar height changes on scroll: ${h0}px at 0, ${h800}px at 800`)
  assert(o800 === 1, `compact mark not shown after the masthead scrolled away (opacity ${o800})`)

  for (let y = 800; y >= 0; y -= 150) {
    await d.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y)
    await d.waitForTimeout(40)
  }
  await d.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await d.waitForTimeout(600)
  const cls = await d.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts.slice(0, 5) }))
  assert(cls.cls <= 0.02, `CLS over the scripted scroll is ${cls.cls.toFixed(4)} (> 0.02): ${JSON.stringify(cls.shifts)}`)
  console.error(`  1440: bar ${h0}px at 0 and 800; mark opacity ${o0} → ${o800}; CLS ${cls.cls.toFixed(4)}`)
  await d.context().close()

  const m = await page({ width: 390, height: 844 })
  await m.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  const m0 = await barHeight(m)
  await m.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }))
  await m.waitForTimeout(500)
  const m800 = await barHeight(m)
  assert(m0 === m800, `390: sticky bar height changes on scroll: ${m0}px → ${m800}px`)
  console.error(`  390: bar ${m0}px at 0 and 800`)
  await m.context().close()

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

ok('R3_COMPACT_OK')
