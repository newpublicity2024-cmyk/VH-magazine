/**
 * R3-G3 — the real VH logo ships unclipped (DESIGN-SPEC-R3 §2 defect 1, §12, amendment C3).
 *
 * 1. No SVG in public/ still declares itself a placeholder.
 * 2. Every logo the site references renders inside its own viewBox: the drawn bounding
 *    box (getBBox of the root's content, measured by the browser's own layout of the
 *    SVG, text included) must not cross the viewBox edge. This is the defect the
 *    placeholder had — "MAGAZINE" ran past x=200, so the header read "VH | MAGAZI".
 * 3. The masthead, compact bar and footer each show a logo image that actually loaded.
 *
 * Until VH supplies its SVGs this gate fails on (1) by design: it is the visible handoff.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok, ROOT } from './lib/harness.mjs'

const pub = path.join(ROOT, 'public')
const svgs = readdirSync(pub).filter((f) => f.endsWith('.svg'))
assert(svgs.length > 0, 'no SVG in public/')
const placeholders = svgs.filter((f) => /placeholder/i.test(readFileSync(path.join(pub, f), 'utf8')))

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const p = await page({ width: 1440, height: 900 })
  await p.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60_000 })
  const used = await p.evaluate(() =>
    [...document.querySelectorAll('[data-logo]')].map((img) => ({
      where: img.getAttribute('data-logo'),
      src: new URL(img.getAttribute('src'), location.href).pathname,
      loaded: img.complete && img.naturalWidth > 0,
    })),
  )
  for (const where of ['masthead', 'compact', 'footer']) {
    const hit = used.find((u) => u.where === where)
    assert(hit, `no [data-logo="${where}"] image on the homepage`)
    assert(hit.loaded, `the ${where} logo (${hit.src}) did not load`)
  }

  const clipped = []
  for (const src of [...new Set(used.map((u) => u.src))]) {
    await p.goto(`${baseUrl}${src}`, { waitUntil: 'load' })
    const box = await p.evaluate(() => {
      const svg = document.documentElement
      const vb = svg.viewBox.baseVal
      const b = svg.getBBox()
      return { vb: { x: vb.x, y: vb.y, w: vb.width, h: vb.height }, b: { x: b.x, y: b.y, w: b.width, h: b.height } }
    })
    const e = 0.5
    if (
      box.b.x < box.vb.x - e ||
      box.b.y < box.vb.y - e ||
      box.b.x + box.b.w > box.vb.x + box.vb.w + e ||
      box.b.y + box.b.h > box.vb.y + box.vb.h + e
    ) {
      clipped.push(`${src}: drawn ${JSON.stringify(box.b)} exceeds viewBox ${JSON.stringify(box.vb)}`)
    }
  }
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)

  const problems = [
    ...placeholders.map((f) => `public/${f} is still a placeholder — VH's official SVG has not been supplied (spec §12)`),
    ...clipped,
  ]
  if (problems.length) fail(problems.join('\n  '))
  console.error(`  ${used.length} logo uses, ${new Set(used.map((u) => u.src)).size} files, all inside their viewBox`)
})

ok('R3_LOGO_OK')
