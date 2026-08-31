/**
 * Playwright helper for the gates that need a real browser.
 *
 * Four outcomes genuinely cannot be measured from HTML source: horizontal
 * overflow at a viewport (G15), axe violations (G16), sticky-header and drawer
 * behaviour (G18), and a server-action round trip (G13). Everything else stays
 * on plain fetch, which is faster and less brittle.
 */
import { withServer, fail } from './harness.mjs'

let chromium
try {
  ;({ chromium } = await import('@playwright/test'))
} catch {
  fail(
    'Playwright is not installed. Run `pnpm install` then `pnpm exec playwright install chromium`.',
  )
}

/**
 * Boot the app, open a page, run `fn({ page, baseUrl, browser })`, then tear
 * everything down. The browser is closed in a finally so a failing assertion
 * never leaks a chromium process.
 */
export async function withPage(fn, { viewport = { width: 1440, height: 900 } } = {}) {
  return withServer(async (baseUrl) => {
    let browser
    try {
      // `channel: 'chromium'` launches the full browser rather than the separate
      // chrome-headless-shell build. The shell is an extra ~100MB download that
      // failed on this link, and the full browser is the closer analogue of what
      // a reader actually uses — so this is the better target regardless.
      browser = await chromium.launch({ channel: 'chromium' })
    } catch (error) {
      fail(
        `could not launch chromium — run \`pnpm exec playwright install chromium\`. ${error.message}`,
      )
    }
    try {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()

      // Surface page errors: a hydration crash would otherwise show up as a
      // confusing assertion failure three steps later.
      const pageErrors = []
      page.on('pageerror', (e) => pageErrors.push(e.message))

      const result = await fn({ page, baseUrl, browser, pageErrors })
      return result
    } finally {
      await browser.close().catch(() => {})
    }
  })
}

/** Measure whether the document scrolls horizontally at the current viewport. */
export async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth - doc.clientWidth,
      // Name the widest offender so a failure is actionable rather than a number.
      culprit: (() => {
        let worst = null
        let worstRight = doc.clientWidth
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect()
          if (r.right > worstRight + 1) {
            worstRight = r.right
            worst = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').slice(0, 3).join('.') : ''} right=${Math.round(r.right)}`
          }
        }
        return worst
      })(),
    }
  })
}

/**
 * Navigate and wait deterministically.
 *
 * `waitUntil: 'networkidle'` is discouraged by Playwright and times out on this
 * page — lazy images keep the network from going quiet for a full 500ms. Wait
 * for `load`, then for a marker that only exists once the homepage rendered.
 */
export async function gotoHome(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  await page.locator('[data-section="actu"]').first().waitFor({ state: 'attached', timeout: 30_000 })
  return page
}

/**
 * One server, one browser, many viewports.
 *
 * withPage() boots a fresh Next server and a fresh Chromium per call, which is
 * right for an isolated gate but wasteful when a single gate needs three
 * viewports — that was three server boots and three browser launches, enough to
 * blow past the checker's 120s budget while the assertions themselves passed.
 * `fn` receives a `page(viewport)` factory instead.
 */
export async function withBrowser(fn) {
  return withServer(async (baseUrl) => {
    let browser
    try {
      browser = await chromium.launch({ channel: 'chromium' })
    } catch (error) {
      fail(`could not launch chromium — run \`pnpm exec playwright install chromium\`. ${error.message}`)
    }
    try {
      const pageErrors = []
      const page = async (viewport) => {
        const context = await browser.newContext({ viewport })
        const p = await context.newPage()
        p.on('pageerror', (e) => pageErrors.push(e.message))
        return p
      }
      return await fn({ page, baseUrl, pageErrors })
    } finally {
      await browser.close().catch(() => {})
    }
  })
}
