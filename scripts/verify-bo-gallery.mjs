/**
 * BO-G23 — each of the six gallery layouts renders as designed on the public page.
 *
 * Fixture (slug g82-…): one published article holding six galleries built from photos of three
 * shapes (16:9 articles, 3:4 covers, 16:5 banners), so "keeps its proportions" and "one height
 * per row" can actually fail:
 *   grid 6 photos, 4 columns · mosaic 5 · masonry 6, 3 columns · row 7, 3 per row ·
 *   stack 3 with the lightbox off · carousel 4, captioned.
 * Measured in Chromium against `next start`:
 *  - grid: 4 tracks at 1280 px, 2 at 390, every tile cropped to 4:3; mosaic: lead photo spans
 *    the row, 3 tracks under it; masonry: 3 CSS columns at 1280, 2 at 390, photos uncropped;
 *  - row: rows of 3 + 2 + 2 (balanced), each row one height (±1.5 px) filling the gallery width
 *    (±2 px), photos uncropped; stack: each photo the gallery's full width, uncropped, and no
 *    zoom button (lightbox off — its positive control is the grid's buttons);
 *  - carousel: one slide per track width, counter 1 / 4, previous disabled; « suivante » → 2 / 4
 *    and the track scrolled one width; → on the focused track → 3 / 4; a synthesized touch swipe
 *    on a 390 px touch page → 2 / 4;
 *  - lightbox: no dialog before a click; clicking the grid's 3rd photo opens a modal dialog on
 *    that photo (same file), → shows the 4th, ← the 3rd, Escape closes it, unlocks the page and
 *    gives focus back to the 3rd photo's button;
 *  - the gallery caption under its gallery; no horizontal overflow at 390 px; zero serious or
 *    critical axe violations in the galleries and in the open lightbox.
 * Also the pure rules (lib/gallery): balanced rows and the automatic column count.
 * Screenshots: test-results/backoffice/galleries/.
 */
import { mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { tsImport } from 'tsx/esm/api'

import { horizontalOverflow, withBrowser } from './lib/browser.mjs'
import { cleanupGate, runDriver, stampFor } from './lib/backoffice.mjs'
import { ROOT, check, checkEqual, fail, ok, pgClient, withCleanup } from './lib/harness.mjs'

let AxeBuilder
try {
  ;({ default: AxeBuilder } = await import('@axe-core/playwright'))
} catch {
  fail('@axe-core/playwright is not installed. Run `pnpm install`.')
}
const { balancedRows, galleryColumns } = await tsImport(path.join(ROOT, 'src/lib/gallery.ts'), import.meta.url)

// ── pure rules ────────────────────────────────────────────────────────────────
const sizes = (n, per) => balancedRows(Array.from({ length: n }, (_, i) => i), per).map((r) => r.length).join('+')
checkEqual(sizes(7, 3), '3+2+2', 'rows of 7 photos by 3')
checkEqual(sizes(4, 3), '2+2', 'rows of 4 photos by 3')
checkEqual(sizes(6, 3), '3+3', 'rows of 6 photos by 3')
checkEqual(sizes(5, 4), '3+2', 'rows of 5 photos by 4')
checkEqual(galleryColumns('grid', 'auto', 4), 2, 'automatic columns for 4 photos')
checkEqual(galleryColumns('grid', 'auto', 6), 3, 'automatic columns for 6 photos')
checkEqual(galleryColumns('grid', '4', 3), 3, '4 columns asked for 3 photos')
checkEqual(galleryColumns('mosaic', '4', 5), 3, 'mosaic columns for 5 photos')

const OUT = path.join(ROOT, 'test-results', 'backoffice', 'galleries')
mkdirSync(OUT, { recursive: true })
const s = stampFor('g82')
await cleanupGate(s.anyRun)
const slug = s.slug('galeries')
const oid = () => randomBytes(12).toString('hex')

const c = await pgClient()
let L, P, B, categoryId
try {
  const ids = async (w, h, n) =>
    (await c.query('select id, filename from media where width = $1 and height = $2 order by id limit $3', [w, h, n])).rows
  L = await ids(1280, 720, 6)
  P = await ids(720, 960, 3)
  B = await ids(1600, 500, 3)
  categoryId = (await c.query(`select id from categories where slug = 'vh-moteur'`)).rows[0]?.id
} finally {
  await c.end()
}
if (L.length < 6 || P.length < 3 || B.length < 3 || !categoryId) fail('fixture media of three shapes or the vh-moteur rubric are missing')

const RATIO = new Map([...L.map((m) => [m.id, 1280 / 720]), ...P.map((m) => [m.id, 720 / 960]), ...B.map((m) => [m.id, 1600 / 500])])
const FILE = new Map([...L, ...P, ...B].map((m) => [m.id, m.filename]))
const G = {
  grid: { photos: [L[0], P[0], B[0], L[1], P[1], L[2]], columns: '4', lightbox: true },
  mosaic: { photos: [L[3], L[4], P[2], B[1], L[5]], lightbox: true },
  masonry: { photos: [P[0], L[0], B[0], P[1], L[1], B[1]], columns: '3', lightbox: true },
  row: { photos: [L[0], P[0], B[0], P[1], L[1], B[1], P[2]], columns: '3', lightbox: true },
  stack: { photos: [L[2], P[2], B[2]], lightbox: false },
  carousel: { photos: [L[3], P[0], B[2], L[4]], lightbox: true, captions: true },
}
const para = (text) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  textFormat: 0,
  children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
})
const body = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      para('zzopening Six galeries suivent.'),
      ...Object.entries(G).flatMap(([layout, g]) => [
        para(`Galerie ${layout}.`),
        {
          type: 'block',
          format: '',
          version: 2,
          fields: {
            id: oid(),
            blockName: '',
            blockType: 'gallery',
            layout,
            ...(g.columns ? { columns: g.columns } : {}),
            lightbox: g.lightbox,
            caption: `zzgal-${layout}`,
            images: g.photos.map((m, i) => ({
              id: oid(),
              image: m.id,
              ...(g.captions ? { caption: `zzslide-${i + 1}` } : {}),
            })),
          },
        },
      ]),
      para('zzclosing'),
    ],
  },
}

const near = (a, b, tol) => Math.abs(a - b) <= tol
const BLOCKING = new Set(['serious', 'critical'])
async function axeCheck(page, include, label) {
  let b = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  for (const sel of include) b = b.include(sel)
  const res = await b.analyze()
  check(res.passes.length + res.violations.length > 0, `${label}: axe evaluated nothing (control)`)
  const blocking = res.violations.filter((v) => BLOCKING.has(v.impact))
  check(
    !blocking.length,
    `${label}: ${blocking.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target} ${JSON.stringify(v.nodes[0]?.any?.[0]?.data ?? '')}`).join('; ')}`,
  )
}

await withCleanup(
  async () => {
    runDriver(`
await p.create({ collection: 'articles', overrideAccess: true, context: { skipRedirects: true }, data: {
  title: ${JSON.stringify(s.title('Six galeries'))},
  slug: ${JSON.stringify(slug)},
  category: ${categoryId},
  featuredImage: ${L[0].id},
  body: ${JSON.stringify(body)},
  _status: 'published',
} })
print({ ok: true })
`)
    await withBrowser(async ({ page: open, baseUrl, pageErrors }) => {
      const url = `${baseUrl}/moteur/vh-moteur/${slug}/`
      const page = await open({ width: 1280, height: 900 })
      const res = await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
      checkEqual(res?.status(), 200, 'fixture article status')
      const block = (layout) => page.locator(`[data-gallery-block="${layout}"]`)
      checkEqual(await page.locator('[data-gallery-block]').count(), 6, 'gallery blocks')
      checkEqual(await page.locator('dialog').count(), 0, 'dialogs before any click')

      const geom = (layout) =>
        block(layout).evaluate((fig) => {
          const g = fig.querySelector('[data-gallery]')
          const cs = getComputedStyle(g)
          return {
            width: g.getBoundingClientRect().width,
            tracks: cs.gridTemplateColumns === 'none' ? 0 : cs.gridTemplateColumns.split(' ').length,
            columns: cs.columnCount,
            caption: fig.querySelector(':scope > figcaption')?.textContent ?? null,
            zooms: g.querySelectorAll('[data-zoom]').length,
            items: [...g.querySelectorAll('[data-gallery-item]')].map((it) => {
              const img = it.querySelector('img')
              const r = img.getBoundingClientRect()
              return { w: r.width, h: r.height, top: r.top, row: it.closest('[data-gallery-row]')?.getAttribute('data-gallery-row') ?? null }
            }),
          }
        })
      const ratioOk = (layout, items) =>
        items.forEach((it, i) =>
          check(
            near(it.w / it.h, RATIO.get(G[layout].photos[i].id), RATIO.get(G[layout].photos[i].id) * 0.02),
            `${layout} photo ${i + 1} cropped: ${(it.w / it.h).toFixed(3)} vs ${RATIO.get(G[layout].photos[i].id).toFixed(3)}`,
          ),
        )

      for (const layout of Object.keys(G)) {
        const g = await geom(layout)
        checkEqual(g.items.length, G[layout].photos.length, `${layout}: photos`)
        checkEqual(g.caption, `zzgal-${layout}`, `${layout}: gallery caption`)
        checkEqual(g.zooms, G[layout].lightbox ? G[layout].photos.length : 0, `${layout}: zoom buttons`)
      }
      const grid = await geom('grid')
      checkEqual(grid.tracks, 4, 'grid tracks at 1280')
      grid.items.forEach((it, i) => check(near(it.w / it.h, 4 / 3, 0.02), `grid tile ${i + 1} not 4:3: ${(it.w / it.h).toFixed(3)}`))
      const mosaic = await geom('mosaic')
      checkEqual(mosaic.tracks, 3, 'mosaic tracks at 1280')
      check(near(mosaic.items[0].w, mosaic.width, 1), `mosaic lead ${mosaic.items[0].w}px, gallery ${mosaic.width}px`)
      const masonry = await geom('masonry')
      checkEqual(masonry.columns, '3', 'masonry columns at 1280')
      ratioOk('masonry', masonry.items)
      const row = await geom('row')
      const rows = new Map()
      row.items.forEach((it, i) => rows.set(it.row, [...(rows.get(it.row) ?? []), { ...it, i }]))
      checkEqual([...rows.values()].map((r) => r.length).join('+'), '3+2+2', 'side-by-side rows')
      for (const [r, items] of rows) {
        const hs = items.map((it) => it.h)
        check(Math.max(...hs) - Math.min(...hs) <= 1.5, `row ${r}: heights ${hs.map((h) => h.toFixed(1)).join(', ')}`)
        const used = items.reduce((sum, it) => sum + it.w, 0) + 8 * (items.length - 1)
        check(near(used, row.width, 2), `row ${r}: photos + gaps ${used.toFixed(1)}px, gallery ${row.width}px`)
      }
      ratioOk('row', row.items)
      const stack = await geom('stack')
      stack.items.forEach((it, i) => check(near(it.w, stack.width, 1), `stack photo ${i + 1}: ${it.w}px of ${stack.width}px`))
      ratioOk('stack', stack.items)

      // ── carousel ─────────────────────────────────────────────────────────────
      const car = block('carousel')
      const track = car.locator('[data-carousel-track]')
      const count = car.locator('[data-carousel-count]')
      await track.scrollIntoViewIfNeeded()
      const slides = await track.evaluate((t) => ({
        width: t.clientWidth,
        scroll: t.scrollWidth,
        slides: [...t.children].map((c) => c.getBoundingClientRect().width),
      }))
      slides.slides.forEach((w, i) => check(near(w, slides.width, 1), `slide ${i + 1}: ${w}px, track ${slides.width}px`))
      check(near(slides.scroll, slides.width * 4, 4), `track scroll width ${slides.scroll} for 4 slides of ${slides.width}`)
      checkEqual((await count.textContent())?.trim(), '1 / 4', 'carousel counter at start')
      check(await car.locator('[data-carousel-prev]').isDisabled(), 'previous enabled on the first slide')
      const waitCount = async (want, what) => {
        for (let t = 0; t < 30; t += 1) {
          if ((await count.textContent())?.trim() === want) return
          await page.waitForTimeout(100)
        }
        checkEqual((await count.textContent())?.trim(), want, what)
      }
      await car.locator('[data-carousel-next]').click()
      await waitCount('2 / 4', 'counter after « Photo suivante »')
      await page.waitForTimeout(800)
      const left = await track.evaluate((t) => t.scrollLeft)
      check(near(left, slides.width, 3), `track at ${left}px after « suivante », expected ${slides.width}`)
      await track.focus()
      await page.keyboard.press('ArrowRight')
      await waitCount('3 / 4', 'counter after → on the track')
      checkEqual(await car.locator('figcaption').nth(2).textContent(), 'zzslide-3', 'third slide caption')
      // Shot here: a later screenshot of a block taller than the window makes Chromium resize its
      // viewport for the capture, which knocks this scroller off its snap point (measured — no
      // reader action does that; tab, buttons, keys and swipe all land on a slide).
      await page.waitForTimeout(800)
      checkEqual(await track.evaluate((t) => t.scrollLeft), slides.width * 2, 'track on slide 3 before its screenshot')
      await car.screenshot({ path: path.join(OUT, '06-carousel.png') })

      // ── lightbox ─────────────────────────────────────────────────────────────
      const zoom3 = block('grid').locator('[data-zoom="2"]')
      await zoom3.scrollIntoViewIfNeeded()
      await zoom3.click()
      const dialog = page.locator('dialog[data-lightbox]')
      await dialog.waitFor({ state: 'visible', timeout: 15_000 })
      check(await dialog.evaluate((d) => d.open && d.matches(':modal')), 'lightbox is not a modal dialog')
      const shown = async () => {
        const src = await dialog.locator('[data-lightbox-img]').getAttribute('src')
        return decodeURIComponent(src ?? '')
      }
      checkEqual(await dialog.getAttribute('data-index'), '2', 'lightbox index after clicking photo 3')
      check((await shown()).includes(FILE.get(G.grid.photos[2].id)), `lightbox shows ${await shown()}, expected ${FILE.get(G.grid.photos[2].id)}`)
      checkEqual(await page.evaluate(() => document.documentElement.dataset.lightbox ?? null), 'open', 'page scroll lock')
      await page.screenshot({ path: path.join(OUT, '07-lightbox.png') })
      await axeCheck(page, ['dialog[data-lightbox]'], 'open lightbox')
      await page.keyboard.press('ArrowRight')
      checkEqual(await dialog.getAttribute('data-index'), '3', 'lightbox index after →')
      check((await shown()).includes(FILE.get(G.grid.photos[3].id)), `after → the lightbox shows ${await shown()}`)
      await page.keyboard.press('ArrowLeft')
      checkEqual(await dialog.getAttribute('data-index'), '2', 'lightbox index after ←')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      checkEqual(await page.locator('dialog[open]').count(), 0, 'open dialogs after Escape')
      checkEqual(await page.evaluate(() => document.documentElement.dataset.lightbox ?? null), null, 'page scroll lock after Escape')
      check(
        await zoom3.evaluate((b) => document.activeElement === b),
        `focus after Escape is on ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80))}`,
      )

      await page.mouse.move(0, 0)
      for (const [i, layout] of Object.keys(G).entries()) {
        if (layout === 'carousel') continue
        const b = block(layout)
        await b.scrollIntoViewIfNeeded()
        await b.evaluate((el) => Promise.all([...el.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r })))))
        await b.screenshot({ path: path.join(OUT, `${String(i + 1).padStart(2, '0')}-${layout}.png`) })
      }
      await axeCheck(page, ['[data-gallery-block]'], 'galleries at 1280')

      // ── 390 px, touch ────────────────────────────────────────────────────────
      const phone = await open({ width: 390, height: 844 })
      await phone.goto(url, { waitUntil: 'load', timeout: 60_000 })
      const pblock = (layout) => phone.locator(`[data-gallery-block="${layout}"]`)
      const ov = await horizontalOverflow(phone)
      checkEqual(ov.overflow, 0, `horizontal overflow at 390 (${ov.culprit})`)
      checkEqual(
        await pblock('grid').evaluate((f) => getComputedStyle(f.querySelector('[data-gallery]')).gridTemplateColumns.split(' ').length),
        2,
        'grid tracks at 390',
      )
      checkEqual(
        await pblock('masonry').evaluate((f) => getComputedStyle(f.querySelector('[data-gallery]')).columnCount),
        '2',
        'masonry columns at 390',
      )
      const ptrack = pblock('carousel').locator('[data-carousel-track]')
      await ptrack.scrollIntoViewIfNeeded()
      const box = await ptrack.boundingBox()
      const cdp = await phone.context().newCDPSession(phone)
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
      await cdp.send('Input.synthesizeScrollGesture', {
        x: Math.round(box.x + box.width * 0.7),
        y: Math.round(box.y + box.height / 2),
        xDistance: -Math.round(box.width * 0.6),
        yDistance: 0,
        gestureSourceType: 'touch',
        speed: 1200,
      })
      const pcount = pblock('carousel').locator('[data-carousel-count]')
      let after = ''
      for (let t = 0; t < 30 && after !== '2 / 4'; t += 1) {
        await phone.waitForTimeout(100)
        after = (await pcount.textContent())?.trim()
      }
      checkEqual(after, '2 / 4', 'counter after a touch swipe at 390')
      await pblock('carousel').screenshot({ path: path.join(OUT, '08-carousel-390.png') })
      await pblock('row').screenshot({ path: path.join(OUT, '09-row-390.png') })

      check(!pageErrors.length, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
      console.error(
        `  6 layouts: grid 4→2 tracks, mosaic lead + 3, masonry 3→2 columns uncropped, rows 3+2+2 at one height, stack full width; slideshow by button/key/swipe; lightbox open/step/Escape/focus`,
      )
    })
  },
  async () => {
    const r = await cleanupGate(s.patterns)
    check(
      Object.values(r.left).every((n) => n === 0),
      `cleanup left rows: ${JSON.stringify(r.left)}`,
    )
  },
)
ok('BO_GALLERY_OK')
