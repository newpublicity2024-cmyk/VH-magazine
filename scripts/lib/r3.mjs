/**
 * Shared helpers for the round-3 gates (DESIGN-SPEC-R3 §10).
 */
import { assert } from './harness.mjs'

/** The href of the first Actu card on the homepage — a seeded article that always exists. */
export async function seededArticleHref(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  const href = await page.locator('[data-section="actu"] [data-card] a[href]').first().getAttribute('href')
  assert(href && href.split('/').filter(Boolean).length >= 2, `no seeded article href on the homepage (got ${href})`)
  return href
}

/** Navigate and wait for `load` plus a selector that proves the page rendered. */
export async function open(page, url, marker = 'main') {
  const res = await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
  await page.locator(marker).first().waitFor({ state: 'attached', timeout: 30_000 })
  return res
}

/**
 * Installed into the page (page.addInitScript or evaluate) — WCAG contrast of an element's
 * text against the background actually painted behind it.
 *
 * The background is composited bottom-up: every ancestor's background-color (and a
 * ::before layer that paints a material, the pattern the sticky bar uses) is blended
 * over what lies beneath, ending on the page canvas. Text colour alpha is blended over
 * that result. An ancestor with a background image is reported as `imageBehind` so the
 * caller can decide rather than silently measuring against the wrong colour.
 */
export const CONTRAST_LIB = `
window.__r3 = (() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  })
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const layers = (el) => {
    const out = []
    let imageBehind = false
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('linear-gradient')) imageBehind = true
      const bg = parse(cs.backgroundColor)
      if (bg && bg.a > 0) out.push(bg)
      const before = getComputedStyle(n, '::before')
      if (before.content !== 'none' && before.position === 'absolute') {
        const b = parse(before.backgroundColor)
        if (b && b.a > 0) out.push(b)
      }
      if (bg && bg.a >= 1) break
    }
    return { out, imageBehind }
  }
  const background = (el) => {
    const { out, imageBehind } = layers(el)
    let acc = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = out.length - 1; i >= 0; i -= 1) acc = over(out[i], acc)
    return { bg: acc, imageBehind }
  }
  const measure = (el) => {
    const cs = getComputedStyle(el)
    const { bg, imageBehind } = background(el)
    const fg = over(parse(cs.color), bg)
    const size = parseFloat(cs.fontSize)
    const bold = Number(cs.fontWeight) >= 700
    const large = size >= 24 || (bold && size >= 18.66)
    const r = ratio(fg, bg)
    return { ratio: Math.round(r * 100) / 100, need: large ? 3 : 4.5, imageBehind, size, color: cs.color }
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0
  }
  return { measure, visible, ratio, parse }
})()
`
