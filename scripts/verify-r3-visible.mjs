/**
 * R3-G9 — dates, categories and titles are always visible (DESIGN-SPEC-R3 §1.2 rule 1).
 *
 * On home, a category page and an article (its related cards), with the mouse parked
 * away from every card: each [data-card] must render a title and a date that are
 * displayed, not visibility:hidden, fully opaque (own and ancestors' opacity), have a
 * non-zero box and are not clipped to nothing by an overflow ancestor. Card titles that
 * need hover to appear — the "white plate over the image" pattern — fail here.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok } from './lib/harness.mjs'
import { seededArticleHref } from './lib/r3.mjs'

function audit() {
  const shown = (el) => {
    if (!el) return 'missing'
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return `zero box ${r.width}x${r.height}`
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.display === 'none') return 'display:none'
      if (cs.visibility === 'hidden') return 'visibility:hidden'
      if (Number(cs.opacity) < 1) return `opacity ${cs.opacity} on ${n.tagName}`
      if (n !== el && /(hidden|clip)/.test(cs.overflow)) {
        const pr = n.getBoundingClientRect()
        if (r.bottom <= pr.top || r.top >= pr.bottom || r.right <= pr.left || r.left >= pr.right) return `clipped by ${n.tagName}`
      }
    }
    return null
  }
  return [...document.querySelectorAll('[data-card]')].map((card) => ({
    label: (card.querySelector('[data-headline]')?.textContent || '').trim().slice(0, 40),
    title: shown(card.querySelector('[data-headline]')),
    date: shown(card.querySelector('time[data-date]')),
  }))
}

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const probe = await page({ width: 1440, height: 900 })
  const article = await seededArticleHref(probe, baseUrl)
  await probe.context().close()

  const problems = []
  let cards = 0
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const [name, url, min] of [['home', '/', 30], ['category', '/category/actualite-news-express-maroc/', 4], ['article', article, 1]]) {
      const p = await page(vp)
      await p.emulateMedia({ reducedMotion: 'no-preference' })
      await p.goto(`${baseUrl}${url}`, { waitUntil: 'load', timeout: 60_000 })
      await p.mouse.move(1, 1)
      // Let image fade-ins finish so a mid-fade opacity is not mistaken for hidden text.
      await p.waitForTimeout(700)
      const rows = await p.evaluate(audit)
      if (rows.length < min) problems.push(`${name}@${vp.width}: only ${rows.length} cards (expected ≥ ${min})`)
      for (const r of rows) {
        cards += 1
        if (r.title) problems.push(`${name}@${vp.width}: card "${r.label}" title ${r.title}`)
        if (r.date) problems.push(`${name}@${vp.width}: card "${r.label}" date ${r.date}`)
      }
      await p.context().close()
    }
  }
  if (problems.length) fail(`${problems.length} card(s) hide their title or date:\n  ${problems.slice(0, 20).join('\n  ')}`)
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
  console.error(`  ${cards} cards across home, category and article at 1440 and 390: title and date visible without hover`)
})

ok('R3_VISIBLE_OK')
