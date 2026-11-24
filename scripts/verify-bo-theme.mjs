/**
 * BO-G16 — the admin wears the WordPress-style VH theme, accessibly.
 *
 * Measured in Chromium against `next start`:
 *  - WordPress's frame in VH's colours: the left menu and the admin bar computed as the VH night
 *    tone rgb(28, 28, 30); primary buttons (« Écrire un article », « Publier ») and the current
 *    menu item — on its own page AND on a page below it — computed as VH blue rgb(22, 111, 193);
 *  - the light theme pinned (`data-theme="light"`) and VH's own Inter actually loaded;
 *  - no horizontal overflow at 1440 and 390 px on the dashboard, the articles list and the editor;
 *  - axe (WCAG 2.1 A/AA) finds zero serious or critical violations inside the back office's own
 *    components: every dashboard widget (both roles), the « Publier » box, the writer's guide
 *    and the list's status links;
 *  - screenshots for the owner's review are written to test-results/backoffice/.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { withPage } from './lib/browser.mjs'
import { browserLogin, cleanupGate, createUsers, stampFor } from './lib/backoffice.mjs'
import { ROOT, check, checkEqual, fail, ok, withCleanup } from './lib/harness.mjs'

let AxeBuilder
try {
  ;({ default: AxeBuilder } = await import('@axe-core/playwright'))
} catch {
  fail('@axe-core/playwright is not installed. Run `pnpm install`.')
}

const OUT = path.join(ROOT, 'test-results', 'backoffice')
mkdirSync(OUT, { recursive: true })
const NIGHT = 'rgb(28, 28, 30)'
const BLUE = 'rgb(22, 111, 193)'
const BLOCKING = new Set(['serious', 'critical'])

const s = stampFor('g70')
await cleanupGate(s.anyRun)

const bg = (page, sel) => page.$eval(sel, (el) => getComputedStyle(el).backgroundColor)
const overflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

async function axe(page, include, label) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  for (const sel of include) builder = builder.include(sel)
  const res = await builder.analyze()
  const blocking = res.violations.filter((v) => BLOCKING.has(v.impact))
  check(
    !blocking.length,
    `${label}: ${blocking.length} serious/critical axe violations: ${blocking.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`).join('; ')}`,
  )
  check(
    res.passes.length > 0,
    `${label}: axe evaluated nothing — the include selectors matched no element`,
  )
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}

await withCleanup(
  async () => {
    const u = createUsers(s, ['admin', 'journalist'])
    await withPage(
      async ({ page, baseUrl, browser }) => {
        // Login card, logged out.
        await page.goto(`${baseUrl}/admin/login/`, { waitUntil: 'load' })
        await settle(page)
        await page.screenshot({ path: path.join(OUT, '01-login.png') })

        await browserLogin(page, baseUrl, u.admin.email)
        await page.waitForSelector('[data-widget="vh-site"]', { timeout: 30_000 })
        await settle(page)
        checkEqual(await bg(page, '.nav'), NIGHT, 'left menu background')
        checkEqual(await bg(page, '.app-header'), NIGHT, 'admin bar background')
        checkEqual(
          await bg(page, '.vhb-welcome .vhb-btn--primary'),
          BLUE,
          '« Écrire un article » background',
        )
        checkEqual(
          await page.evaluate(() => document.documentElement.dataset.theme),
          'light',
          'admin theme',
        )
        const font = await page.evaluate(() => ({
          loaded: document.fonts.check('16px "VH Inter"'),
          family: getComputedStyle(document.body).fontFamily,
        }))
        check(
          font.loaded && font.family.startsWith('"VH Inter"'),
          `VH Inter not in use: ${JSON.stringify(font)}`,
        )
        await axe(page, ['[data-widget]'], 'admin dashboard widgets')
        await page.screenshot({ path: path.join(OUT, '04-admin-dashboard.png'), fullPage: true })

        await page.goto(`${baseUrl}/admin/collections/articles/`, { waitUntil: 'load' })
        await page.waitForSelector('[data-status-links]')
        await settle(page)
        // Under trailingSlash the list's pathname never equals the nav href exactly, so Payload renders the
        // current item as the anchor holding .nav__link-indicator (a div only on an exact match).
        checkEqual(await bg(page, '.nav #nav-articles'), BLUE, 'current menu item on its own page')
        check(
          (await bg(page, '.nav #nav-media')) !== BLUE,
          'control: a menu item that is not current must not be blue',
        )
        await axe(page, ['[data-status-links]'], 'list status links')
        await page.screenshot({ path: path.join(OUT, '05-admin-list.png') })

        const first = await page.getAttribute('.table tbody tr a', 'href')
        await page.goto(`${baseUrl}${first}`, { waitUntil: 'load' })
        await page
          .locator('[data-lexical-editor="true"]')
          .first()
          .waitFor({ state: 'visible', timeout: 30_000 })
        await settle(page)
        checkEqual(
          await bg(page, '.nav #nav-articles'),
          BLUE,
          'current menu item on an article below it',
        )
        checkEqual(await bg(page, '#action-save'), BLUE, '« Publier » background')
        await axe(page, ['[data-publishbox]'], 'admin « Publier » box')
        await page.screenshot({ path: path.join(OUT, '06-admin-edit.png') })

        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 900 })
          for (const route of ['/admin/', '/admin/collections/articles/', first]) {
            await page.goto(`${baseUrl}${route}`, { waitUntil: 'load' })
            await settle(page)
            const over = await overflow(page)
            check(over <= 1, `admin ${route} overflows horizontally by ${over}px at ${width}`)
          }
          if (width === 390) {
            await page.goto(`${baseUrl}/admin/`, { waitUntil: 'load' })
            await settle(page)
            await page.screenshot({
              path: path.join(OUT, '07-admin-dashboard-390.png'),
              fullPage: true,
            })
          }
        }

        const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
        const j = await ctx.newPage()
        await browserLogin(j, baseUrl, u.journalist.email)
        await j.waitForSelector('[data-widget="vh-guide"]', { timeout: 30_000 })
        await settle(j)
        await axe(j, ['[data-widget]'], 'journalist dashboard widgets')
        await j.screenshot({ path: path.join(OUT, '02-journalist-dashboard.png'), fullPage: true })
        await Promise.all([
          j.waitForURL(/\/admin\/collections\/articles\/\d+\/?$/, { timeout: 60_000 }),
          j.click('.vhb-welcome a[href$="/collections/articles/create"]'),
        ])
        await j
          .locator('[data-lexical-editor="true"]')
          .first()
          .waitFor({ state: 'visible', timeout: 30_000 })
        await settle(j)
        checkEqual(
          await bg(j, '#action-submit-review'),
          BLUE,
          '« Soumettre pour relecture » background',
        )
        await axe(j, ['[data-publishbox]', '[data-writer-guide]'], 'journalist editor components')
        await j.screenshot({ path: path.join(OUT, '03-journalist-edit.png') })
        await j.setViewportSize({ width: 390, height: 900 })
        await j.reload({ waitUntil: 'load' })
        await settle(j)
        const jo = await overflow(j)
        check(jo <= 1, `journalist editor overflows horizontally by ${jo}px at 390`)
        console.error(
          `  night chrome + VH blue measured; light pinned; Inter loaded; no overflow at 1440/390; axe clean on widgets, box, guide, links; 7 screenshots in ${path.relative(ROOT, OUT)}`,
        )
      },
      { viewport: { width: 1600, height: 1000 } },
    )
  },
  async () => {
    const r = await cleanupGate(s.patterns)
    check(
      Object.values(r.left).every((n) => n === 0),
      `cleanup left rows: ${JSON.stringify(r.left)}`,
    )
  },
)
ok('BO_THEME_OK')
