/**
 * GATES-HEADINGS — the section headings as vh.ma draws them (2026-11-25).
 *
 *   node scripts/verify-headings.mjs <mode> [--base <url> --db <postgres url>]
 *
 *   home    HD2 — the home page's six headings: VH EXPRESS, VH LIFESTYLE, VH MOTEUR, then VH TV
 *           and VH PEOPLE on black, VH GRAND ANGLE over the dossiers; vh.ma's words, strip colours
 *           (none on black), no background, no "Voir tout", each linking where its block's "Voir
 *           plus" goes (Grand Angle: nowhere, as on vh.ma); vh.ma's proportions at
 *           our 44 px heading height, at 1440 and 390 (control: a perturbed heading is caught).
 *   pages   HD3 — the top-level categories vh.ma heads with a VH banner, and Grand Angle, carry it
 *           as their single h1 (page 2 too); a sub-category and Vidéo keep a plain h1.
 *   names   HD4 — the related block is "Vous aimerez aussi"; the panel's titles are vh.ma's and its
 *           Instagram widget has none.
 *   vhma    HD1 — this file's table of vh.ma (words, strip colours, which pages carry which banner,
 *           the proportions) still matches live vh.ma: its pages' banner files, measured from the
 *           images themselves. Network only, no server.
 *
 * Without --base the page modes start `next start` on the current build (.env's database,
 * vh_magazine); pages are picked from the database (--db, else .env's DATABASE_URL).
 */
import pg from 'pg'
import sharp from 'sharp'
import { chromium } from '@playwright/test'

import { assert, fail, getHtml, loadEnv, ok, stripScripts, withServer } from './lib/harness.mjs'

const mode = process.argv[2]
const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const BASE = argOf('base')?.replace(/\/$/, '')
const DB = argOf('db') || loadEnv().DATABASE_URL

// ── vh.ma, measured 2026-11-25 (and re-measured live by `vhma`) ──────────────────────────────
const VHMA_ORIGIN = 'https://www.vh.ma'
/** Top-level categories whose page opens with a VH banner: the banner's word and strip colour. */
const CATEGORIES = {
  'actualite-news-express-maroc': { word: 'Express', rgb: [239, 201, 38], file: 'vh-express-categorie-banniere-min.jpg' },
  'lifestyle-homme-maroc': { word: 'Lifestyle', rgb: [242, 118, 32], file: 'vh-lifestyle-categorie-banniere-min.jpg' },
  moteur: { word: 'Moteur', rgb: [233, 36, 45], file: 'vh-moteur-categorie-banniere-min.jpg' },
  culture: { word: 'Culture', rgb: [86, 41, 18], file: 'vh-culture-categorie-banniere-min.jpg' },
  sport: { word: 'Sport', rgb: [58, 165, 61], file: 'vh-sport-categorie-banniere-min.jpg' },
  'people-celebrites': { word: 'People', rgb: [60, 60, 60], file: 'VH-people-vh-magazine-maroc-web.png' },
}
const GRAND_ANGLE = { path: '/vh-grand-angle-2/', word: 'Grand Angle', rgb: [35, 31, 32], file: 'grand-angle-grand-min.jpg' }
/** The home page's headings in order: our block, vh.ma's word, strip colour (null: on black, none). */
const HOME = [
  { section: 'actu', word: 'Express', rgb: CATEGORIES['actualite-news-express-maroc'].rgb, file: 'vh-express-categorie-banniere-min.jpg' },
  { section: 'lifestyle', word: 'Lifestyle', rgb: CATEGORIES['lifestyle-homme-maroc'].rgb, file: 'vh-lifestyle-categorie-banniere-min.jpg' },
  { section: 'moteur', word: 'Moteur', rgb: CATEGORIES.moteur.rgb, file: 'vh-moteur-categorie-banniere-min.jpg' },
  { section: 'videos', word: 'TV', rgb: null, file: 'VH-tv-web.png' },
  { section: 'people', word: 'People', rgb: null, file: 'VH-poeple-web.png' },
  { section: 'dossiers', word: 'Grand Angle', rgb: [35, 31, 32], file: 'grand-angle-grand-min.jpg', unlinked: true },
]
/** vh.ma's proportions, from vh-express-categorie-banniere-min.jpg (mark 55 px tall there): the
 *  word's capitals 20, the strip 24 tall and 25 after the word. `vhma` re-measures them. */
const RATIO = { cap: 20 / 55, strip: 24 / 55, gap: 25 / 55 }
const MARK_ASPECT = 1628 / 1104 // the traced mark (VH-TV.png's VH)
const MARK_PX = 40 // our size: with the word's descent, the 44 px of the band it replaces
/** The panel's titles on vh.ma (article page), by our widget key; null = vh.ma shows none. */
const PANEL_TITLES = {
  'collector-promo': 'En kiosque',
  podcast: 'The Shift Podcast',
  newsletter: 'VH Newsletter',
  instagram: null,
  'most-read': 'Les plus lus',
  'latest-articles': 'Derniers articles',
  'whos-who': null,
  'chroniques-cigare': 'Chroniques cigare',
}

const rgbText = (rgb) => `rgb(${rgb.join(', ')})`
const INK = 'rgb(17, 17, 17)'
const WHITE = 'rgb(255, 255, 255)'
const CLEAR = 'rgba(0, 0, 0, 0)'

// ── in the browser ───────────────────────────────────────────────────────────────────────────
/** Every `.vh-band` on the page, measured. Runs in the page. */
function measureBands() {
  return [...document.querySelectorAll('.vh-band')].map((band) => {
    const h = band.querySelector('h1, h2')
    const mark = band.querySelector('.vh-band__mark')
    const word = band.querySelector('.vh-band__word')
    const strip = band.querySelector('.vh-band__strip')
    const link = band.querySelector('a')
    const box = (e) => (e ? JSON.parse(JSON.stringify(e.getBoundingClientRect())) : null)
    let baseline = null
    let cap = null
    let style = null
    if (word) {
      const probe = document.createElement('span')
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
      word.appendChild(probe)
      baseline = probe.getBoundingClientRect().bottom
      probe.remove()
      const cs = getComputedStyle(word)
      const ctx = document.createElement('canvas').getContext('2d')
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      cap = ctx.measureText(word.textContent.toUpperCase()).actualBoundingBoxAscent
      const family = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim()
      const faces = [...document.fonts].filter((f) => f.family.replace(/['"]/g, '') === family && f.status === 'loaded').map((f) => f.weight)
      style = { transform: cs.textTransform, weight: cs.fontWeight, color: cs.color, family, faces }
    }
    // The column the heading spans: its content box (a container's padding is not column).
    const columnEl = band.parentElement.closest('[data-region="main-column"], .vh-container, header') ?? band.parentElement
    const colStyle = getComputedStyle(columnEl)
    const colRect = columnEl.getBoundingClientRect()
    const column = { right: colRect.right - parseFloat(colStyle.paddingRight) - parseFloat(colStyle.borderRightWidth) }
    return {
      section: band.closest('[data-section]')?.getAttribute('data-section') ?? null,
      tag: h?.tagName ?? null,
      name: h ? h.textContent.replace(/\s+/g, ' ').trim() : null,
      text: band.textContent,
      href: link?.getAttribute('href') ?? null,
      more: band.closest('section')?.querySelector('[data-button]')?.getAttribute('href') ?? null,
      band: box(band),
      column,
      title: box(h),
      mark: box(mark),
      word: box(word),
      strip: box(strip),
      stripColor: strip ? getComputedStyle(strip).backgroundColor : null,
      backgrounds: [band, h, link].filter(Boolean).map((e) => getComputedStyle(e).backgroundColor),
      baseline,
      cap,
      style,
    }
  })
}

/** What is wrong with one measured heading, against what it should be. */
function bandProblems(m, want, where) {
  const p = []
  const say = (s) => p.push(`${where} "${m.name}": ${s}`)
  const near = (a, b, tol) => Math.abs(a - b) <= tol
  if (m.name !== want.name) say(`accessible name is "${m.name}", want "${want.name}"`)
  if (/voir tout/i.test(m.text)) say('still carries "Voir tout"')
  if (m.backgrounds.some((b) => b !== CLEAR)) say(`has a background (${m.backgrounds.join(' / ')})`)
  if (!m.mark || !m.word) return [...p, `${where} "${m.name}": no mark or no word`]
  if (m.style.transform !== 'uppercase') say(`word not in capitals (${m.style.transform})`)
  if (Number(m.style.weight) < 800) say(`word weight ${m.style.weight}, want heavy (vh.ma's black capitals)`)
  if (!m.style.faces.some((w) => /\b900\b/.test(w))) say(`no loaded ${m.style.family} face covers weight 900 (faces: ${m.style.faces.join(', ') || 'none'})`)
  if (m.style.color !== want.color) say(`word colour ${m.style.color}, want ${want.color}`)
  const markH = m.mark.height
  if (!near(markH, MARK_PX, 0.6)) say(`mark ${markH.toFixed(1)} px tall, want ${MARK_PX}`)
  if (!near(m.mark.width / markH, MARK_ASPECT, 0.012)) say(`mark aspect ${(m.mark.width / markH).toFixed(3)}, want ${MARK_ASPECT.toFixed(3)}`)
  if (!(m.band.height >= 43.5 && m.band.height <= 46)) say(`heading ${m.band.height.toFixed(1)} px tall, want the band's 44`)
  if (!near(m.cap / markH, RATIO.cap, 0.025)) say(`capitals ${(m.cap / markH).toFixed(3)} of the mark, vh.ma ${RATIO.cap.toFixed(3)}`)
  if (!near(m.baseline, m.mark.bottom, 1.5)) say(`word baseline ${m.baseline.toFixed(1)} ≠ mark bottom ${m.mark.bottom.toFixed(1)}`)
  if (m.word.left < m.mark.right - 0.5) say('word starts inside the mark')
  if (!near(m.band.right, m.column.right, 1)) say(`heading ends at ${m.band.right.toFixed(0)}, its column at ${m.column.right.toFixed(0)}`)
  if (want.rgb) {
    if (!m.strip) return [...p, `${where} "${m.name}": no strip`]
    if (m.stripColor !== rgbText(want.rgb)) say(`strip ${m.stripColor}, vh.ma ${rgbText(want.rgb)}`)
    if (!near(m.strip.height / markH, RATIO.strip, 0.025)) say(`strip ${(m.strip.height / markH).toFixed(3)} of the mark tall, vh.ma ${RATIO.strip.toFixed(3)}`)
    if (!near((m.strip.left - m.title.right) / markH, RATIO.gap, 0.03)) say(`strip ${((m.strip.left - m.title.right) / markH).toFixed(3)} of the mark after the title, vh.ma ${RATIO.gap.toFixed(3)}`)
    if (!near(m.strip.bottom, m.mark.bottom, 1.5)) say(`strip bottom ${m.strip.bottom.toFixed(1)} ≠ mark bottom ${m.mark.bottom.toFixed(1)}`)
    if (!near(m.strip.right, m.band.right, 1)) say(`strip stops at ${m.strip.right.toFixed(0)}, the heading at ${m.band.right.toFixed(0)}`)
    if (m.strip.width < 24) say(`strip only ${m.strip.width.toFixed(0)} px long`)
  } else if (m.strip) say('has a strip (vh.ma has none on black)')
  return p
}

async function withSite(fn) {
  if (BASE) return fn(BASE)
  return withServer((base) => fn(base.replace(/\/$/, '')))
}

async function withChromium(fn) {
  const browser = await chromium.launch({ channel: 'chromium' }).catch((e) => fail(`could not launch chromium: ${e.message}`))
  try {
    return await fn(async (viewport) => (await browser.newContext({ viewport })).newPage())
  } finally {
    await browser.close().catch(() => {})
  }
}

async function open(newPage, url, viewport) {
  const page = await newPage(viewport)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const res = await page.goto(url, { waitUntil: 'load', timeout: 120_000 })
  await page.evaluate(() => document.fonts.ready)
  return { page, status: res.status(), errors }
}

async function query(sql) {
  const c = new pg.Client({ connectionString: DB })
  await c.connect()
  try {
    return (await c.query(sql)).rows
  } finally {
    await c.end()
  }
}

// ── home ─────────────────────────────────────────────────────────────────────────────────────
async function checkHome() {
  await withSite((base) =>
    withChromium(async (newPage) => {
      const problems = []
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const { page, status, errors } = await open(newPage, `${base}/`, viewport)
        assert(status === 200, `home: HTTP ${status}`)
        const bands = await page.evaluate(measureBands)
        const sections = bands.map((b) => b.section)
        if (JSON.stringify(sections) !== JSON.stringify(HOME.map((h) => h.section))) {
          problems.push(`@${viewport.width}: headings in sections [${sections}], want [${HOME.map((h) => h.section)}]`)
        }
        for (const want of HOME) {
          const m = bands.find((b) => b.section === want.section)
          if (!m) continue
          const dark = !want.rgb
          problems.push(...bandProblems(m, { name: `VH ${want.word}`, rgb: want.rgb, color: dark ? WHITE : INK }, `@${viewport.width} ${want.section}`))
          if (m.tag !== 'H2') problems.push(`@${viewport.width} ${want.section}: heading is ${m.tag}, want H2`)
          if (want.unlinked ? m.href : !m.href || m.href !== m.more) problems.push(`@${viewport.width} ${want.section}: heading links to ${m.href}, its "Voir plus" to ${m.more}${want.unlinked ? ' (vh.ma: no link)' : ''}`)
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        if (overflow > 0) problems.push(`@${viewport.width}: ${overflow} px of horizontal overflow`)
        if (errors.length) problems.push(`@${viewport.width}: page errors ${errors.slice(0, 2).join(' | ')}`)

        // Control: a heading off vh.ma's proportions and colour must be caught.
        await page.addStyleTag({
          content: `.vh-band__strip{height:30px!important;margin-left:4px!important}.vh-band[data-strip=express]{--vh-strip:#123456!important}.vh-band__word{font-size:30px!important}`,
        })
        const bad = (await page.evaluate(measureBands)).find((b) => b.section === 'actu')
        const caught = bandProblems(bad, { name: 'VH Express', rgb: HOME[0].rgb, color: INK }, 'control').join('\n')
        for (const kind of ['strip rgb', 'of the mark tall', 'after the title', 'capitals']) {
          if (!caught.includes(kind)) problems.push(`@${viewport.width}: the control's ${kind} was not caught:\n${caught}`)
        }
        console.log(`  @${viewport.width}: ${bands.map((b) => b.name).join(' · ')} — control caught ${caught.split('\n').length} problems`)
        await page.context().close()
      }
      assert(problems.length === 0, problems.join('\n  '))
    }),
  )
  ok('HEADINGS_HOME_OK')
}

// ── pages ────────────────────────────────────────────────────────────────────────────────────
async function checkPages() {
  const top = await query(`select c.slug, c.name, (select count(*)::int from articles a where a.category_id = c.id and a._status = 'published') n
    from categories c where c.parent_id is null`)
  const mapped = top.filter((c) => CATEGORIES[c.slug])
  assert(mapped.length >= 5, `only ${mapped.length} of vh.ma's banner categories in this database: ${mapped.map((c) => c.slug)}`)
  const sub = (
    await query(`select c.slug, c.name, p.slug parent from categories c join categories p on p.id = c.parent_id
      where p.parent_id is null and exists (select 1 from articles a where a.category_id = c.id and a._status = 'published')
      order by (p.slug = any(array[${Object.keys(CATEGORIES).map((s) => `'${s}'`)}])) desc, c.id limit 1`)
  )[0]
  assert(sub, 'no sub-category with an article in this database')
  const video = top.find((c) => c.slug === 'video')
  const big = mapped.filter((c) => c.n > 14).sort((a, b) => b.n - a.n)[0]

  const vhPages = [
    ...mapped.map((c) => ({ path: `/category/${c.slug}/`, word: CATEGORIES[c.slug].word, rgb: CATEGORIES[c.slug].rgb })),
    { path: GRAND_ANGLE.path, word: GRAND_ANGLE.word, rgb: GRAND_ANGLE.rgb },
    ...(big ? [{ path: `/category/${big.slug}/?page=2`, word: CATEGORIES[big.slug].word, rgb: CATEGORIES[big.slug].rgb, suffix: ' — page 2' }] : []),
  ]
  const plainPages = [
    { path: `/category/${sub.parent}/${sub.slug}/`, name: sub.name },
    ...(video ? [{ path: '/category/video/', name: video.name }] : []),
  ]
  await withSite((base) =>
    withChromium(async (newPage) => {
      const problems = []
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        for (const want of vhPages) {
          const { page, status } = await open(newPage, base + want.path, viewport)
          if (status !== 200) {
            problems.push(`${want.path}: HTTP ${status}`)
            continue
          }
          const bands = await page.evaluate(measureBands)
          const h1s = await page.evaluate(() => document.querySelectorAll('h1').length)
          if (h1s !== 1) problems.push(`${want.path}: ${h1s} h1`)
          if (bands.length !== 1) problems.push(`${want.path}: ${bands.length} VH headings, want 1`)
          else {
            if (bands[0].tag !== 'H1') problems.push(`${want.path}: the VH heading is ${bands[0].tag}, want the page's h1`)
            problems.push(...bandProblems(bands[0], { name: `VH ${want.word}${want.suffix ?? ''}`, rgb: want.rgb, color: INK }, `@${viewport.width} ${want.path}`))
          }
          if (viewport.width === 1440) console.log(`  ${want.path.padEnd(44)} ${bands[0]?.name ?? '—'} (${bands[0]?.stripColor ?? 'no strip'})`)
          await page.context().close()
        }
      }
      for (const want of plainPages) {
        const { status, html } = await getHtml(base + want.path)
        const dom = stripScripts(html)
        const h1 = [...dom.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim())
        if (status !== 200) problems.push(`${want.path}: HTTP ${status}`)
        else if (dom.includes('vh-band')) problems.push(`${want.path}: carries a VH heading (vh.ma titles it in plain text)`)
        else if (h1.length !== 1 || h1[0] !== want.name) problems.push(`${want.path}: h1 ${JSON.stringify(h1)}, want ["${want.name}"]`)
        else console.log(`  ${want.path.padEnd(44)} plain h1 "${h1[0]}"`)
      }
      assert(problems.length === 0, problems.join('\n  '))
    }),
  )
  ok('HEADINGS_PAGES_OK')
}

// ── names ────────────────────────────────────────────────────────────────────────────────────
async function checkNames() {
  const pathOf = async (id) => {
    const segs = []
    while (id) {
      const [r] = await query(`select slug, parent_id from categories where id = ${Number(id)}`)
      segs.unshift(r.slug)
      id = r.parent_id
    }
    return segs.join('/')
  }
  const [a] = await query(`select a.slug, a.category_id from articles a where a._status = 'published'
    and (select count(*) from articles b where b.category_id = a.category_id and b._status = 'published') >= 4
    order by a.published_at desc limit 1`)
  assert(a, 'no article with related articles in this database')
  const article = `/${await pathOf(a.category_id)}/${a.slug}/`
  await withSite((base) =>
    withChromium(async (newPage) => {
      const problems = []
      const { page, status } = await open(newPage, base + article, { width: 1440, height: 900 })
      assert(status === 200, `${article}: HTTP ${status}`)
      const seen = await page.evaluate(() => ({
        related: document.getElementById('related-heading')?.textContent.trim() ?? null,
        widgets: [...document.querySelectorAll('[data-region="sidebar"] [data-widget]')].map((w) => ({
          key: w.getAttribute('data-widget'),
          title: w.querySelector('h2, h3')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
        })),
      }))
      if (seen.related !== 'Vous aimerez aussi') problems.push(`${article}: related block titled ${JSON.stringify(seen.related)}, want "Vous aimerez aussi"`)
      for (const [key, want] of Object.entries(PANEL_TITLES)) {
        const w = seen.widgets.find((x) => x.key === key)
        if (!w) problems.push(`${article}: no ${key} widget in the panel`)
        else if ((w.title ?? null)?.toLowerCase() !== want?.toLowerCase()) problems.push(`${article}: ${key} titled ${JSON.stringify(w.title)}, vh.ma ${JSON.stringify(want)}`)
      }
      console.log(`  ${article}: "${seen.related}"; panel ${seen.widgets.map((w) => `${w.key}=${w.title ?? '∅'}`).join(', ')}`)
      for (const path of ['/', article, `/category/${(await query(`select slug from categories where parent_id is null order by id limit 1`))[0].slug}/`]) {
        const { html } = await getHtml(base + path)
        if (/Articles similaires/i.test(html)) problems.push(`${path}: still says "Articles similaires"`)
      }
      assert(problems.length === 0, problems.join('\n  '))
    }),
  )
  ok('HEADINGS_NAMES_OK')
}

// ── vhma ─────────────────────────────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
/** The home page's on-black headings' images, which no category page opens with. */
const DARK_ONLY = ['VH-tv-web.png', 'VH-poeple-web.png']
const BANNER = /wp-content\/uploads\/\d{4}\/\d{2}\/((?:vh-[a-z-]+-categorie-banniere-min\.jpg)|(?:VH-[A-Za-z-]+-web\.png)|(?:VH-people-vh-magazine-maroc-web\.png)|(?:grand-angle-grand-min\.jpg))/g

async function vhmaHtml(path) {
  const res = await fetch(VHMA_ORIGIN + path, { headers: { 'user-agent': UA, accept: 'text/html' } })
  assert(res.ok, `vh.ma ${path}: HTTP ${res.status}`)
  return stripScripts(await res.text())
}
/** The banner files a vh.ma page shows, in order, once each. */
const bannersOf = (html) => [...new Set([...html.matchAll(BANNER)].map((m) => m[1]))]

/** A banner image measured: the strip's colour and box, the word's capitals, the mark. */
async function measureBanner(file, uploadsPath) {
  const res = await fetch(`${VHMA_ORIGIN}/wp-content/uploads/${uploadsPath}`, { headers: { 'user-agent': UA } })
  assert(res.ok, `vh.ma ${file}: HTTP ${res.status}`)
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true })
  const px = (x, y) => {
    const o = (y * info.width + x) * info.channels
    return [data[o], data[o + 1], data[o + 2]]
  }
  const lum = (x, y) => px(x, y).reduce((s, v) => s + v, 0) / 3
  // The strip: the run of non-white pixels reaching the right edge on the middle rows.
  let stripRow = -1
  for (let y = Math.floor(info.height * 0.45); y < info.height * 0.7 && stripRow < 0; y++) if (lum(info.width - 2, y) < 235) stripRow = y
  if (stripRow < 0) return { file, strip: null }
  let left = info.width - 2
  while (left > 0 && lum(left - 1, stripRow) < 235) left--
  const midX = Math.round((left + info.width) / 2)
  let top = stripRow
  let bottom = stripRow
  while (top > 0 && lum(midX, top - 1) < 235) top--
  while (bottom < info.height - 1 && lum(midX, bottom + 1) < 235) bottom++
  const rgb = px(midX, Math.round((top + bottom) / 2))
  // Left of the strip: the mark is a thin grey outline, the word solid dark capitals.
  let markTop = info.height
  let markBottom = 0
  let wordLeft = -1
  let wordRight = 0
  let capTop = info.height
  let capBottom = 0
  for (let x = 0; x < left - 4; x++) {
    let solid = 0
    for (let y = 0; y < info.height; y++) {
      if (lum(x, y) < 235) {
        markTop = Math.min(markTop, y)
        markBottom = Math.max(markBottom, y)
      }
      if (lum(x, y) < 90) solid++
    }
    if (solid >= 4) {
      if (wordLeft < 0) wordLeft = x
      wordRight = x
      for (let y = 0; y < info.height; y++) {
        if (lum(x, y) < 90) {
          capTop = Math.min(capTop, y)
          capBottom = Math.max(capBottom, y)
        }
      }
    }
  }
  const markH = markBottom - markTop + 1
  return {
    file,
    rgb,
    strip: { h: bottom - top + 1, bottom },
    ratios: { cap: (capBottom - capTop + 1) / markH, strip: (bottom - top + 1) / markH, gap: (left - wordRight - 1) / markH },
    markBottom,
  }
}

async function checkVhma() {
  const problems = []
  const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol)
  const wordOf = (file) =>
    ({ 'VH-tv-web.png': 'TV', 'VH-poeple-web.png': 'People', 'VH-people-vh-magazine-maroc-web.png': 'People', 'grand-angle-grand-min.jpg': 'Grand Angle' })[file] ??
    file.replace(/^vh-([a-z]+)-categorie.*$/, '$1').replace(/^./, (c) => c.toUpperCase())

  // Home: vh.ma's banners, in order, are ours.
  const homeHtml = await vhmaHtml('/')
  const home = bannersOf(homeHtml)
  if (JSON.stringify(home) !== JSON.stringify(HOME.map((h) => h.file))) problems.push(`vh.ma home banners [${home}], table [${HOME.map((h) => h.file)}]`)
  const homeWords = home.map(wordOf)
  if (JSON.stringify(homeWords) !== JSON.stringify(HOME.map((h) => h.word))) problems.push(`vh.ma home words [${homeWords}], ours [${HOME.map((h) => h.word)}]`)
  console.log(`  vh.ma home: ${homeWords.map((w) => `VH ${w}`).join(' · ')}`)
  const uploads = Object.fromEntries([...homeHtml.matchAll(BANNER)].map((m) => [m[1], m[0].replace('wp-content/uploads/', '')]))

  // Each category page and Grand Angle carries its banner; a sub-category carries none.
  for (const [slug, want] of [...Object.entries(CATEGORIES), [null, GRAND_ANGLE]]) {
    const path = slug ? `/category/${slug}/` : GRAND_ANGLE.path
    const html = await vhmaHtml(path)
    const files = bannersOf(html).filter((f) => !DARK_ONLY.includes(f))
    for (const m of html.matchAll(BANNER)) uploads[m[1]] ??= m[0].replace('wp-content/uploads/', '')
    if (files[0] !== want.file) problems.push(`vh.ma ${path} opens with [${files}], table ${want.file}`)
    else if (wordOf(files[0]) !== want.word) problems.push(`vh.ma ${path}: word ${wordOf(files[0])}, table ${want.word}`)
  }
  for (const path of ['/category/moteur/moto/', '/category/lifestyle-homme-maroc/montres/', '/category/video/']) {
    const files = bannersOf(await vhmaHtml(path)).filter((f) => !DARK_ONLY.includes(f))
    if (files.length) problems.push(`vh.ma ${path} shows ${files} — the table says plain title`)
  }

  // The images themselves: strip colours and proportions.
  const measured = []
  for (const want of [...Object.values(CATEGORIES), GRAND_ANGLE]) {
    if (!uploads[want.file]) {
      problems.push(`no URL for ${want.file}`)
      continue
    }
    const m = await measureBanner(want.file, uploads[want.file])
    measured.push(m)
    if (!m.strip) problems.push(`${want.file}: no strip found`)
    else if (!near(m.rgb, want.rgb, 12)) problems.push(`${want.file}: strip rgb(${m.rgb}), table rgb(${want.rgb})`)
    console.log(`  ${want.file.padEnd(42)} strip rgb(${m.rgb}) h ${m.strip?.h} — word ${want.word}`)
  }
  const express = measured.find((m) => m.file === CATEGORIES['actualite-news-express-maroc'].file)
  for (const k of ['cap', 'strip', 'gap']) {
    if (Math.abs(express.ratios[k] - RATIO[k]) > 0.03) problems.push(`express banner ${k} ratio ${express.ratios[k].toFixed(3)}, table ${RATIO[k].toFixed(3)}`)
  }
  console.log(`  express proportions: cap ${express.ratios.cap.toFixed(3)} strip ${express.ratios.strip.toFixed(3)} gap ${express.ratios.gap.toFixed(3)} of the mark`)
  for (const [tv, file] of [['TV', 'VH-tv-web.png'], ['People', 'VH-poeple-web.png']]) {
    const m = await measureBanner(file, uploads[file])
    if (m.strip) problems.push(`vh.ma's home VH ${tv} has a strip — the table says none`)
  }
  assert(problems.length === 0, problems.join('\n  '))
  ok('HEADINGS_VHMA_OK')
}

const MODES = { home: checkHome, pages: checkPages, names: checkNames, vhma: checkVhma }
if (!MODES[mode]) fail(`usage: verify-headings.mjs <${Object.keys(MODES).join('|')}> [--base <url> --db <url>]`)
await MODES[mode]().catch((e) => fail(e.stack || e.message))
