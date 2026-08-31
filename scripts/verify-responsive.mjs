/**
 * G15 — no horizontal overflow at 375 / 768 / 1440, and the sidebar renders
 * below the main column at 375 (spec §10).
 *
 * A real browser is required: horizontal overflow is a layout outcome, not
 * something visible in HTML source. Naming the widest offending element makes a
 * failure actionable instead of just a number.
 *
 * All three viewports share one server and one browser — booting three of each
 * took longer than the checker's whole budget, so the gate was being SIGKILLed
 * mid-pass and reported as a failure.
 */
import { withBrowser, horizontalOverflow, gotoHome } from './lib/browser.mjs'
import { assert, ok } from './lib/harness.mjs'

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  for (const vp of VIEWPORTS) {
    const p = await page({ width: vp.width, height: vp.height })
    await gotoHome(p, baseUrl)

    const { scrollWidth, clientWidth, overflow, culprit } = await horizontalOverflow(p)
    // 1px of slack absorbs sub-pixel rounding in the layout engine; anything
    // more is a real overflow a reader would feel as a sideways scroll.
    assert(
      overflow <= 1,
      `horizontal overflow at ${vp.name} (${vp.width}px): scrollWidth ${scrollWidth} vs ` +
        `clientWidth ${clientWidth} (+${overflow}px). Widest element: ${culprit ?? 'unknown'}`,
    )

    // Spec §10: the sidebar drops BELOW the main column on mobile.
    if (vp.name === 'mobile') {
      const geometry = await p.evaluate(() => {
        const main = document.querySelector('[data-region="main-column"]')
        const side = document.querySelector('[data-region="sidebar"]')
        if (!main || !side) return null
        const m = main.getBoundingClientRect()
        const s = side.getBoundingClientRect()
        return { mainTop: m.top, mainBottom: m.bottom, sidebarTop: s.top }
      })
      assert(
        geometry !== null,
        'could not find [data-region="main-column"] and [data-region="sidebar"] to check stacking',
      )
      assert(
        geometry.sidebarTop >= geometry.mainTop,
        `sidebar renders above the main column at 375px (sidebar top ${Math.round(
          geometry.sidebarTop,
        )}, main top ${Math.round(geometry.mainTop)}) — spec §10 wants it below`,
      )
    }

    // At desktop the two must sit side by side, or the 2/3 + 1/3 layout the
    // wireframe specifies has silently collapsed to one column.
    if (vp.name === 'desktop') {
      const sideBySide = await p.evaluate(() => {
        const main = document.querySelector('[data-region="main-column"]')
        const side = document.querySelector('[data-region="sidebar"]')
        if (!main || !side) return null
        const m = main.getBoundingClientRect()
        const s = side.getBoundingClientRect()
        return { overlapsVertically: s.top < m.bottom - 50 }
      })
      assert(sideBySide !== null, 'main column / sidebar regions not found at desktop')
      assert(
        sideBySide.overlapsVertically,
        'sidebar does not sit alongside the main column at 1440px — the 2/3 + 1/3 layout collapsed',
      )
    }

    console.error(`  ${vp.name} (${vp.width}px): overflow ${overflow}px — ok`)
    await p.context().close()
  }

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

ok('RESPONSIVE_OK')
