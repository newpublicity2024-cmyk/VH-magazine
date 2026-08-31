/**
 * G18 — the header becomes sticky on scroll (spec §4.2) and the hamburger opens
 * a drawer containing the full primary nav (spec §4.2 mobile).
 *
 * Both are behaviours, not markup, so both need a browser. The sticky check
 * measures the header's viewport position after a real scroll rather than
 * inspecting CSS classes: a class named "sticky" that does not stick would pass
 * a source-level check and fail a reader.
 *
 * Desktop and mobile share one server and one browser — two of each exceeded
 * the checker's budget and got the gate SIGKILLed while it was passing.
 */
import { withBrowser, gotoHome } from './lib/browser.mjs'
import { assert, ok } from './lib/harness.mjs'

const REQUIRED_NAV = ['Actu', 'Lifestyle', 'Culture', 'Grand Angle', 'Moteur', 'Sport', 'Vidéos']

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  // ── Sticky header, desktop ───────────────────────────────────────────────
  const desktop = await page({ width: 1440, height: 900 })
  await gotoHome(desktop, baseUrl)

  const header = desktop.locator('[data-sticky-header]')
  assert((await header.count()) > 0, 'no [data-sticky-header] element found')
  assert((await header.first().boundingBox()) !== null, 'sticky header has no box before scroll')

  await desktop.evaluate(() => window.scrollTo(0, 1200))
  await desktop.waitForTimeout(400)

  const scrolled = await desktop.evaluate(() => window.scrollY)
  assert(scrolled > 500, `page did not scroll (scrollY ${scrolled}) — the sticky check is vacuous`)

  const after = await header.first().boundingBox()
  assert(after !== null, 'sticky header disappeared after scrolling')
  assert(
    after.y <= 8,
    `header is not sticky: after scrolling to ${scrolled}px its top is at y=${Math.round(
      after.y,
    )} (expected it pinned near 0)`,
  )
  console.error(`  sticky: header at y=${Math.round(after.y)} after ${scrolled}px scroll`)
  await desktop.context().close()

  // ── Mobile drawer ────────────────────────────────────────────────────────
  const mobile = await page({ width: 375, height: 812 })
  await gotoHome(mobile, baseUrl)

  const trigger = mobile.locator('[data-drawer-trigger]')
  assert((await trigger.count()) > 0, 'no [data-drawer-trigger] (hamburger) at 375px')
  assert(await trigger.first().isVisible(), 'hamburger is in the DOM but not visible at 375px')

  const drawer = mobile.locator('[data-drawer]')
  // Closed to begin with — a drawer that is always open is not a drawer.
  if ((await drawer.count()) > 0) {
    assert(
      !(await drawer.first().isVisible()),
      'the mobile drawer is already visible before the hamburger is clicked',
    )
  }

  await trigger.first().click()
  await mobile.waitForTimeout(400)

  assert((await drawer.count()) > 0, 'clicking the hamburger did not render [data-drawer]')
  assert(await drawer.first().isVisible(), 'drawer is in the DOM but not visible after clicking')

  const drawerText = (await drawer.first().innerText()).replace(/\s+/g, ' ')
  for (const label of REQUIRED_NAV) {
    assert(
      drawerText.toLowerCase().includes(label.toLowerCase()),
      `mobile drawer is missing nav item "${label}" — measured: ${drawerText.slice(0, 300)}`,
    )
  }

  // And it must close again.
  const closer = mobile.locator('[data-drawer-close]')
  if ((await closer.count()) > 0) {
    await closer.first().click()
  } else {
    await mobile.keyboard.press('Escape')
  }
  await mobile.waitForTimeout(400)
  assert(
    !(await drawer.first().isVisible()),
    'the mobile drawer did not close via its close control or Escape',
  )
  console.error(`  drawer: opened, contained ${REQUIRED_NAV.length} nav items, closed`)
  await mobile.context().close()

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

ok('HEADER_OK')
