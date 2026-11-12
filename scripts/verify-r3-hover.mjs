/**
 * R3-G4 — card hover is the tokenised motion (DESIGN-SPEC-R3 §3.6).
 *
 * Under prefers-reduced-motion: no-preference, hovering a grid card must:
 *   - scale its image to 1.03 through a transform transition of 600 ms on ease-standard;
 *   - give the title link an accent underline while the title text stays ink.
 * Under reduce, the hovered image must compute no transform at all.
 * Computed styles are read after the transition has had time to finish.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, ok } from './lib/harness.mjs'

const CARD = '[data-section="actu"] [data-card][data-variant="default"], [data-section="actu"] [data-card][data-variant="lead"]'

async function hoverState(p) {
  const card = p.locator(CARD).first()
  await card.scrollIntoViewIfNeeded()
  // The title link is stretched over the whole card, so hover the card itself.
  await card.hover()
  await p.waitForTimeout(800)
  return card.evaluate((el) => {
    const img = el.querySelector('[data-card-media] img')
    const link = el.querySelector('[data-card-title] a')
    const title = el.querySelector('[data-card-title]')
    const ics = getComputedStyle(img)
    const props = ics.transitionProperty.split(',').map((s) => s.trim())
    const durs = ics.transitionDuration.split(',').map((s) => s.trim())
    const eases = ics.transitionTimingFunction.split(/,(?![^(]*\))/).map((s) => s.trim())
    const i = props.findIndex((x) => x === 'transform' || x === 'scale' || x === 'all')
    const lcs = getComputedStyle(link)
    return {
      transform: ics.transform,
      scale: ics.scale,
      dur: i >= 0 ? durs[i % durs.length] : null,
      ease: i >= 0 ? eases[i % eases.length] : null,
      underline: lcs.textDecorationLine,
      underlineColor: lcs.textDecorationColor,
      titleColor: getComputedStyle(title).color,
      linkColor: lcs.color,
    }
  })
}

const scaleOf = (s) => {
  if (s.scale && s.scale !== 'none') return Number(s.scale.split(' ')[0])
  const m = s.transform.match(/matrix\(([^,]+),/)
  return m ? Number(m[1]) : 1
}

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const p = await page({ width: 1440, height: 900 })
  await p.emulateMedia({ reducedMotion: 'no-preference' })
  await p.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  const s = await hoverState(p)
  assert(Math.abs(scaleOf(s) - 1.03) < 0.001, `hovered card image scale is ${scaleOf(s)} (${s.transform}), expected 1.03`)
  assert(s.dur === '0.6s', `card image transform transition is ${s.dur}, expected 0.6s (--duration-zoom)`)
  assert(
    s.ease && s.ease.replace(/\s/g, '') === 'cubic-bezier(0.25,0.1,0.25,1)',
    `card image easing is ${s.ease}, expected ease-standard cubic-bezier(.25,.1,.25,1)`,
  )
  assert(s.underline.includes('underline'), `hovered title link has no underline (${s.underline})`)
  assert(s.underlineColor === 'rgb(22, 111, 193)', `title underline colour is ${s.underlineColor}, expected accent rgb(22, 111, 193)`)
  assert(s.linkColor === 'rgb(17, 17, 17)', `hovered title text is ${s.linkColor}, expected ink rgb(17, 17, 17)`)
  console.error(`  no-preference: scale ${scaleOf(s)} over ${s.dur} ${s.ease}; underline ${s.underlineColor}`)
  await p.context().close()

  const r = await page({ width: 1440, height: 900 })
  await r.emulateMedia({ reducedMotion: 'reduce' })
  await r.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  const rs = await hoverState(r)
  assert(scaleOf(rs) === 1 && (rs.transform === 'none' || rs.transform === 'matrix(1, 0, 0, 1, 0, 0)'), `under reduced motion the hovered image still transforms: ${rs.transform} / scale ${rs.scale}`)
  console.error('  reduce: hovered image does not transform')
  await r.context().close()

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

ok('R3_HOVER_OK')
