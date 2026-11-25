/**
 * R3-G13 — the owner's decisions render as decided (DESIGN-SPEC-R3 amendment C1, §11).
 *
 *   C1  the accent computes #166fc1 (rgb 22,111,193) on the article kicker and the
 *       active-nav marker, and no red token ships (R3-G1 also checks source);
 *   D1  the masthead is black;
 *   D2  card image wrappers have square corners; the search panel's radius is 12 px;
 *   D4  no View Transitions: no @view-transition / view-transition-name in shipped CSS
 *       and no viewTransition flag in next.config;
 *   D5  the Vidéos and People sections paint a black background;
 *   D6  every homepage grid card's title box starts below its image box;
 *   D7  the masthead logo is horizontally centred (±2 px) at 1440, and the compact mark
 *       sits at the left of the sticky bar;
 *   D8  "Les plus lus" shows rank numerals 1–5 in order — on an article page: since 2026-11-25 the
 *       homepage leaves it out, as vh.ma's does (GATES-SIDEBAR), and the homepage must show none.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok, ROOT } from './lib/harness.mjs'
import { seededArticleHref } from './lib/r3.mjs'

const ACCENT = 'rgb(22, 111, 193)'
const BLACK = 'rgb(0, 0, 0)'
const problems = []
const check = (cond, msg) => {
  if (!cond) problems.push(msg)
}

const nextConfig = readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8')
check(!/viewTransition/.test(nextConfig), 'D4: next.config enables viewTransition')

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const d = await page({ width: 1440, height: 900 })
  await d.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })

  const css = await d.evaluate(async () => {
    let out = ''
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) out += await (await fetch(l.href)).text()
    return out
  })
  check(!/@view-transition|view-transition-name/.test(css), 'D4: shipped CSS declares View Transitions')
  check(!/vh-red|#e31e24/i.test(css), 'C1: a red token ships in the CSS')

  const home = await d.evaluate(() => {
    const bg = (sel) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el).backgroundColor : null
    }
    const cards = [...document.querySelectorAll('[data-section] [data-card]:not([data-variant="horizontal"]):not([data-variant="rank"])')]
    const below = cards.map((c) => {
      const media = c.querySelector('[data-media]')
      const title = c.querySelector('[data-headline]')
      if (!media || !title) return { ok: false, why: 'missing media or title', t: c.textContent.trim().slice(0, 30) }
      return { ok: title.getBoundingClientRect().top >= media.getBoundingClientRect().bottom - 0.5, t: title.textContent.trim().slice(0, 30) }
    })
    const radii = [...document.querySelectorAll('[data-media]')].map((m) => getComputedStyle(m).borderTopLeftRadius)
    const logo = document.querySelector('[data-logo="masthead"]')
    const lr = logo?.getBoundingClientRect()
    const mark = document.querySelector('[data-compact-mark]')
    const bar = document.querySelector('[data-sticky-header]')
    const ranks = [...document.querySelectorAll('[data-widget="most-read"] [data-rank]')].map((r) => r.textContent.trim())
    return {
      masthead: bg('[data-masthead]'),
      videos: bg('[data-section="videos"]'),
      people: bg('[data-section="people"]'),
      below,
      radii,
      logoCentre: lr ? lr.left + lr.width / 2 : null,
      viewport: document.documentElement.clientWidth,
      markLeft: (() => {
        if (!mark || !bar) return null
        const c = bar.querySelector('.vh-container')
        return mark.getBoundingClientRect().left - (c.getBoundingClientRect().left + parseFloat(getComputedStyle(c).paddingLeft))
      })(),
      markInBarLeftHalf: mark && bar ? mark.getBoundingClientRect().right < bar.getBoundingClientRect().width / 2 : false,
      ranks,
    }
  })
  check(home.masthead === BLACK, `D1: masthead background is ${home.masthead}, expected black`)
  check(home.videos === BLACK, `D5: Vidéos section background is ${home.videos}, expected black`)
  check(home.people === BLACK, `D5: People section background is ${home.people}, expected black`)
  check(home.below.length >= 20, `D6: only ${home.below.length} image cards measured on the homepage`)
  for (const b of home.below.filter((x) => !x.ok)) problems.push(`D6: card "${b.t}" title is not below its image${b.why ? ` (${b.why})` : ''}`)
  check(home.radii.length > 0 && home.radii.every((r) => r === '0px'), `D2: card image corners are not square: ${[...new Set(home.radii)].join(', ')}`)
  check(home.logoCentre !== null && Math.abs(home.logoCentre - home.viewport / 2) <= 2, `D7: masthead logo centre ${home.logoCentre} vs viewport centre ${home.viewport / 2}`)
  check(home.markInBarLeftHalf && home.markLeft !== null && Math.abs(home.markLeft) <= 2, `D7: compact mark is not at the left of the bar (offset ${home.markLeft})`)
  check(home.ranks.length === 0, `D8: the homepage shows Les plus lus (${JSON.stringify(home.ranks)}); vh.ma's leaves it out`)

  // Active nav marker on a section page, and the search panel radius.
  await d.goto(`${baseUrl}/category/moteur/`, { waitUntil: 'load', timeout: 60_000 })
  const active = await d.evaluate(() => {
    const a = document.querySelector('[data-nav="primary"] [aria-current="page"]')
    return a ? getComputedStyle(a, '::after').backgroundColor : null
  })
  check(active === ACCENT, `C1: active nav marker is ${active}, expected the accent ${ACCENT}`)
  await d.locator('[data-search-trigger]').first().click()
  await d.waitForTimeout(500)
  const panelRadius = await d.locator('[data-search-panel]').evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
  check(panelRadius === '12px', `D2: search panel radius is ${panelRadius}, expected 12px`)
  await d.context().close()

  const a = await page({ width: 1440, height: 900 })
  const article = await seededArticleHref(a, baseUrl)
  await a.goto(`${baseUrl}${article}`, { waitUntil: 'load', timeout: 60_000 })
  const kicker = await a.locator('[data-kicker]').first().evaluate((el) => getComputedStyle(el).backgroundColor)
  check(kicker === ACCENT, `C1: article category pill is ${kicker}, expected the accent ${ACCENT}`)
  const kickerRadius = await a.locator('[data-kicker]').first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
  check(kickerRadius === '0px', `D2: category pill radius is ${kickerRadius}, expected 0 (crisp)`)
  const ranks = await a.evaluate(() => [...document.querySelectorAll('[data-widget="most-read"] [data-rank]')].map((r) => r.textContent.trim()))
  check(JSON.stringify(ranks) === JSON.stringify(['1', '2', '3', '4', '5']), `D8: Les plus lus ranks on an article are ${JSON.stringify(ranks)}, expected 1–5`)
  await a.context().close()

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

if (problems.length) fail(`${problems.length} decision(s) not rendered as decided:\n  ${problems.join('\n  ')}`)
console.error('  C1, D1, D2, D4, D5, D6, D7, D8 all render as decided')
ok('R3_DECISIONS_OK')
