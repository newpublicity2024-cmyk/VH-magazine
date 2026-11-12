/**
 * R3-G17 — the rest of the round-3 inventory is present (DESIGN-SPEC-R3 §3.6, §4.6–4.9, §5).
 *
 * Each item is checked by what a reader gets, not by a class name:
 *   article   reading-progress bar present and its scale grows as the page scrolls;
 *             "N min de lecture" with N ≥ 1; share row has WhatsApp + LinkedIn links and a
 *             copy-link button that writes the URL to the clipboard and shows a
 *             role=status toast;
 *   listing   the category page opens with one `lead` card followed by `horizontal` rows;
 *   VH TV     clicking a video in the list swaps the featured player in place — same URL,
 *             featured title changes;
 *   magazine  covers are grouped under year headings;
 *   footer    at 390 the link columns are collapsed accordions that open on tap;
 *   back-top  not visible at scroll 0, visible after scrolling 900 px;
 *   print     the shipped CSS has an @media print block that hides the site chrome.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok } from './lib/harness.mjs'
import { seededArticleHref } from './lib/r3.mjs'

const problems = []
const check = (cond, msg) => {
  if (!cond) problems.push(msg)
}

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  // ── Article ──────────────────────────────────────────────────────────────
  const a = await page({ width: 1440, height: 900 })
  await a.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseUrl })
  const article = await seededArticleHref(a, baseUrl)
  await a.goto(`${baseUrl}${article}`, { waitUntil: 'load', timeout: 60_000 })
  const progress = async () =>
    a.locator('[data-reading-progress] [data-progress-fill]').evaluate((el) => {
      const t = getComputedStyle(el).transform
      const m = t.match(/matrix\(([^,]+),/)
      const s = getComputedStyle(el).scale
      return s && s !== 'none' ? Number(s.split(' ')[0]) : m ? Number(m[1]) : t === 'none' ? 1 : NaN
    })
  check((await a.locator('[data-reading-progress]').count()) === 1, 'article: no [data-reading-progress] bar')
  if ((await a.locator('[data-reading-progress]').count()) === 1) {
    const p0 = await progress()
    await a.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await a.waitForTimeout(400)
    const p1 = await progress()
    check(p1 > p0 && p1 > 0.9, `article: progress did not advance with scroll (${p0} → ${p1})`)
    await a.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  }
  const rt = await a.locator('[data-reading-time]').first().textContent().catch(() => '')
  check(/^\s*\d+\s*min de lecture\s*$/.test(rt) && Number(rt.match(/\d+/)[0]) >= 1, `article: reading time reads ${JSON.stringify(rt)}`)
  const share = await a.evaluate(() => [...document.querySelectorAll('[data-share] a')].map((x) => x.href))
  check(share.some((h) => h.includes('wa.me') || h.includes('whatsapp')), 'article: share row has no WhatsApp link')
  check(share.some((h) => h.includes('linkedin.com')), 'article: share row has no LinkedIn link')
  const copy = a.locator('[data-copy-link]').first()
  if ((await copy.count()) === 0) problems.push('article: no copy-link button')
  else {
    await copy.click()
    await a.waitForTimeout(300)
    const toast = await a.evaluate(() => {
      const t = document.querySelector('[data-toast]')
      return t ? { role: t.getAttribute('role'), text: t.textContent.trim(), visible: getComputedStyle(t).visibility !== 'hidden' && Number(getComputedStyle(t).opacity) > 0 } : null
    })
    check(toast && toast.role === 'status' && /copi/i.test(toast.text) && toast.visible, `article: copy-link toast missing or wrong: ${JSON.stringify(toast)}`)
    const clip = await a.evaluate(() => navigator.clipboard.readText()).catch(() => '')
    check(clip.endsWith(article), `article: clipboard holds ${JSON.stringify(clip)}, expected the article URL`)
  }
  await a.context().close()

  // ── Category listing ─────────────────────────────────────────────────────
  const c = await page({ width: 1440, height: 900 })
  await c.goto(`${baseUrl}/category/actualite-news-express-maroc/`, { waitUntil: 'load', timeout: 60_000 })
  const variants = await c.evaluate(() => [...document.querySelectorAll('[data-category-grid] [data-card]')].map((x) => x.dataset.variant))
  check(variants[0] === 'lead' && variants.length > 1 && variants.slice(1).every((v) => v === 'horizontal'), `listing: card variants are ${JSON.stringify(variants)}, expected lead then horizontal`)
  await c.context().close()

  // ── VH TV ────────────────────────────────────────────────────────────────
  const t = await page({ width: 1440, height: 900 })
  await t.goto(`${baseUrl}/vh-tv/`, { waitUntil: 'load', timeout: 60_000 })
  const featured = () => t.locator('[data-vhtv-featured] [data-vhtv-title]').first().textContent()
  if ((await t.locator('[data-vhtv-featured]').count()) !== 1) problems.push('vh-tv: no [data-vhtv-featured] player')
  else {
    const before = await featured()
    const url0 = t.url()
    const pick = t.locator('[data-vhtv-pick]').nth(1)
    check((await pick.count()) === 1, 'vh-tv: fewer than two [data-vhtv-pick] controls')
    if (await pick.count()) {
      await pick.click()
      await t.waitForTimeout(400)
      const after = await featured()
      check(after !== before, `vh-tv: featured title did not change (${before})`)
      check(t.url() === url0, `vh-tv: picking a video navigated (${url0} → ${t.url()})`)
    }
  }
  await t.context().close()

  // ── Magazine ─────────────────────────────────────────────────────────────
  const m = await page({ width: 1440, height: 900 })
  await m.goto(`${baseUrl}/magazine-maroc/`, { waitUntil: 'load', timeout: 60_000 })
  const groups = await m.evaluate(() => [...document.querySelectorAll('[data-year-group]')].map((g) => ({ year: g.querySelector('h2')?.textContent.trim(), covers: g.querySelectorAll('[data-card]').length })))
  check(groups.length >= 1 && groups.every((g) => /^\d{4}$/.test(g.year) && g.covers > 0), `magazine: year groups are ${JSON.stringify(groups)}`)
  await m.context().close()

  // ── Footer accordions + back-to-top + print ─────────────────────────────
  const f = await page({ width: 390, height: 844 })
  await f.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  const groupsClosed = await f.evaluate(() => [...document.querySelectorAll('[data-footer-group]')].map((d) => ({ tag: d.tagName, open: d.open, linkVisible: !!d.querySelector('a') && d.querySelector('a').checkVisibility() })))
  check(groupsClosed.length >= 2 && groupsClosed.every((g) => g.tag === 'DETAILS' && !g.open && !g.linkVisible), `footer@390: expected ≥2 closed <details> groups, got ${JSON.stringify(groupsClosed)}`)
  if (groupsClosed.length) {
    await f.locator('[data-footer-group] summary').first().click()
    const opened = await f.evaluate(() => {
      const d = document.querySelector('[data-footer-group]')
      return d.open && d.querySelector('a').checkVisibility()
    })
    check(opened, 'footer@390: tapping a group did not reveal its links')
  }
  const btt = f.locator('[data-back-to-top]')
  check((await btt.count()) === 1, 'no [data-back-to-top] button')
  if (await btt.count()) {
    await f.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await f.waitForTimeout(400)
    check(!(await btt.isVisible()), 'back-to-top is visible at scroll 0')
    await f.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
    await f.waitForTimeout(600)
    check(await btt.isVisible(), 'back-to-top is not visible after 900px of scroll')
  }
  const css = await f.evaluate(async () => {
    let out = ''
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) out += await (await fetch(l.href)).text()
    return out
  })
  const print = css.match(/@media print\s*\{([\s\S]*?\}\s*)\}/)
  check(print && /display:\s*none/.test(print[1]), 'no @media print block hiding the chrome in the shipped CSS')
  await f.context().close()

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

if (problems.length) fail(`${problems.length} inventory item(s) missing:\n  ${problems.join('\n  ')}`)
console.error('  article progress/reading time/share/toast, listing lead+rows, VH TV swap, year groups, footer accordions, back-to-top, print: present')
ok('R3_INVENTORY_OK')
