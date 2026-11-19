/**
 * R3-G7 — reduced motion is honoured site-wide (DESIGN-SPEC-R3 §3.6).
 *
 * With prefers-reduced-motion: reduce emulated, on the home page, an article, and the
 * open mobile drawer: no element (or ::before/::after) may transition a transform-like
 * or layout property with a non-zero duration, no element may run an animation except
 * the reading-progress bar (it is information, not decoration), opacity transitions are
 * capped at 150 ms, and the root must not scroll smoothly.
 *
 * Positive control: the same scan under no-preference must find transform transitions
 * (the card zoom at least) — otherwise the scan is blind and its silence means nothing.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok } from './lib/harness.mjs'
import { seededArticleHref } from './lib/r3.mjs'

const MOVING = new Set(['transform', 'translate', 'scale', 'rotate', 'all', 'top', 'left', 'right', 'bottom', 'width', 'height', 'margin', 'padding', 'inset'])

function scan() {
  const ms = (t) => (t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000)
  const out = { moving: [], animated: [], slowFades: [], smooth: getComputedStyle(document.documentElement).scrollBehavior }
  for (const el of document.querySelectorAll('*')) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo)
      if (pseudo && cs.content === 'none') continue
      const props = cs.transitionProperty.split(',').map((s) => s.trim())
      const durs = cs.transitionDuration.split(',').map((s) => ms(s.trim()))
      props.forEach((prop, i) => {
        const d = durs[i % durs.length]
        if (d <= 0) return
        const label = `${el.tagName.toLowerCase()}${pseudo || ''}.${String(el.className).slice(0, 50)} ${prop} ${d}ms`
        if (window.__MOVING.includes(prop)) out.moving.push(label)
        if (prop === 'opacity' && d > 150) out.slowFades.push(label)
      })
      if (cs.animationName !== 'none' && !el.closest('[data-reading-progress]')) {
        const d = cs.animationDuration.split(',').map((s) => ms(s.trim()))
        if (d.some((x) => x > 0)) out.animated.push(`${el.tagName.toLowerCase()}${pseudo || ''}.${String(el.className).slice(0, 50)} ${cs.animationName}`)
      }
    }
  }
  return out
}

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const probe = await page({ width: 1440, height: 900 })
  const article = await seededArticleHref(probe, baseUrl)
  await probe.context().close()

  const targets = [
    { name: 'home@1440', url: '/', vp: { width: 1440, height: 900 } },
    { name: 'article@1440', url: article, vp: { width: 1440, height: 900 } },
    { name: 'home+drawer@390', url: '/', vp: { width: 390, height: 844 }, drawer: true },
  ]

  // Positive control first.
  const c = await page({ width: 1440, height: 900 })
  await c.emulateMedia({ reducedMotion: 'no-preference' })
  await c.addInitScript((m) => (window.__MOVING = m), [...MOVING])
  await c.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  const control = await c.evaluate(scan)
  assert(control.moving.length > 0, 'control: under no-preference the scan found no transform transitions — the scan is blind')
  await c.context().close()

  const problems = []
  for (const t of targets) {
    const p = await page(t.vp)
    await p.emulateMedia({ reducedMotion: 'reduce' })
    await p.addInitScript((m) => (window.__MOVING = m), [...MOVING])
    await p.goto(`${baseUrl}${t.url}`, { waitUntil: 'load', timeout: 60_000 })
    if (t.drawer) {
      await p.locator('[data-drawer-trigger]').first().click()
      await p.waitForTimeout(400)
    }
    const r = await p.evaluate(scan)
    for (const x of r.moving.slice(0, 8)) problems.push(`${t.name}: moving transition ${x}`)
    for (const x of r.animated.slice(0, 8)) problems.push(`${t.name}: animation ${x}`)
    for (const x of r.slowFades.slice(0, 8)) problems.push(`${t.name}: opacity fade over 150ms ${x}`)
    if (r.smooth === 'smooth') problems.push(`${t.name}: html scroll-behavior is smooth under reduce`)
    await p.context().close()
  }
  if (problems.length) fail(`${problems.length} reduced-motion violation(s):\n  ${problems.join('\n  ')}`)
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
  console.error(`  control saw ${control.moving.length} moving transitions under no-preference; reduce: none on ${targets.length} targets`)
})

ok('R3_REDUCED_OK')
