/**
 * R3-G5 — overlays animate both ways and stay accessible (DESIGN-SPEC-R3 §3.6, §4.3–4.4, §7).
 *
 * For the mobile drawer (390) and the search panel (1440):
 *   - present in the DOM while closed, with `inert` and data-state="closed", not visible;
 *   - opening sets data-state="open", drops inert, and the moving surface transitions
 *     its transform with the spec token (drawer 450 ms ease-out-soft in; search 320 ms
 *     ease-out-soft) — read while the transition runs;
 *   - focus moves inside; 25 Tab presses never leave the surface (trap);
 *   - Escape closes, the closing transition uses its token (drawer 320 ms), the surface
 *     ends not visible and inert, and focus returns to the trigger.
 * The search panel must also open from the "/" shortcut.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, ok } from './lib/harness.mjs'

const transitionFor = (el, prop) => {
  const cs = getComputedStyle(el)
  const props = cs.transitionProperty.split(',').map((s) => s.trim())
  const durs = cs.transitionDuration.split(',').map((s) => s.trim())
  const eases = cs.transitionTimingFunction.split(/,(?![^(]*\))/).map((s) => s.trim())
  const i = props.findIndex((x) => x === prop || x === 'all')
  return i < 0 ? null : { dur: durs[i % durs.length], ease: eases[i % eases.length].replace(/\s/g, '') }
}

async function checkOverlay(p, { name, root, surface, trigger, openDur, closeDur, focusSel }) {
  const r = p.locator(root)
  assert((await r.count()) === 1, `${name}: expected one ${root} in the DOM while closed, found ${await r.count()}`)
  const closed = await r.evaluate((el) => ({ inert: el.inert, state: el.dataset.state }))
  assert(closed.inert && closed.state === 'closed', `${name}: closed root should be inert with data-state=closed, got ${JSON.stringify(closed)}`)
  assert(!(await p.locator(surface).isVisible()), `${name}: surface is visible while closed`)

  await p.locator(trigger).first().click()
  await p.waitForTimeout(30)
  const opening = await p.locator(surface).evaluate(
    (el, fn) => new Function('el', 'prop', `return (${fn})(el, prop)`)(el, 'transform'),
    transitionFor.toString(),
  )
  const opened = await r.evaluate((el) => ({ inert: el.inert, state: el.dataset.state }))
  assert(!opened.inert && opened.state === 'open', `${name}: after opening, expected data-state=open and not inert, got ${JSON.stringify(opened)}`)
  assert(opening && opening.dur === openDur && opening.ease === 'cubic-bezier(0.32,0.72,0,1)', `${name}: opening transform transition is ${JSON.stringify(opening)}, expected ${openDur} ease-out-soft`)
  await p.waitForTimeout(600)
  assert(await p.locator(surface).isVisible(), `${name}: surface not visible after opening`)
  const focusInside = await p.locator(surface).evaluate((el) => el.contains(document.activeElement))
  assert(focusInside, `${name}: focus did not move into the surface on open`)
  if (focusSel) {
    const id = await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)
    assert(await p.locator(focusSel).evaluate((el) => el === document.activeElement), `${name}: expected focus on ${focusSel}, got ${id}`)
  }

  for (let i = 0; i < 25; i += 1) {
    await p.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab')
    const inside = await p.locator(surface).evaluate((el) => el.contains(document.activeElement))
    assert(inside, `${name}: Tab press ${i + 1} moved focus outside the surface (trap broken)`)
  }

  await p.keyboard.press('Escape')
  await p.waitForTimeout(30)
  const closing = await p.locator(surface).evaluate(
    (el, fn) => new Function('el', 'prop', `return (${fn})(el, prop)`)(el, 'transform'),
    transitionFor.toString(),
  )
  assert(closing && closing.dur === closeDur, `${name}: closing transform transition is ${JSON.stringify(closing)}, expected ${closeDur}`)
  await p.waitForTimeout(600)
  const after = await r.evaluate((el) => ({ inert: el.inert, state: el.dataset.state }))
  assert(after.inert && after.state === 'closed', `${name}: after Escape, expected inert + closed, got ${JSON.stringify(after)}`)
  assert(!(await p.locator(surface).isVisible()), `${name}: surface still visible after Escape`)
  const back = await p.locator(trigger).first().evaluate((el) => el === document.activeElement)
  assert(back, `${name}: focus did not return to the trigger after closing`)
  console.error(`  ${name}: inert while closed, opens ${opening.dur}, closes ${closing.dur}, traps Tab, Escape returns focus`)
}

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const m = await page({ width: 390, height: 844 })
  await m.emulateMedia({ reducedMotion: 'no-preference' })
  await m.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  await checkOverlay(m, {
    name: 'drawer',
    root: '[data-drawer-root]',
    surface: '[data-drawer]',
    trigger: '[data-drawer-trigger]',
    openDur: '0.45s',
    closeDur: '0.32s',
  })
  await m.context().close()

  const d = await page({ width: 1440, height: 900 })
  await d.emulateMedia({ reducedMotion: 'no-preference' })
  await d.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  await checkOverlay(d, {
    name: 'search',
    root: '[data-search-root]',
    surface: '[data-search-panel]',
    trigger: '[data-search-trigger]',
    openDur: '0.32s',
    closeDur: '0.32s',
    focusSel: '#vh-search-input',
  })
  // The "/" shortcut opens it too.
  await d.locator('body').click({ position: { x: 5, y: 600 } })
  await d.keyboard.press('/')
  await d.waitForTimeout(500)
  assert(await d.locator('[data-search-panel]').isVisible(), 'search: the "/" shortcut did not open the panel')
  await d.keyboard.press('Escape')
  await d.context().close()

  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

ok('R3_OVERLAYS_OK')
