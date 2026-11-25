/**
 * GATES-SIDEBAR — the side panel as on vh.ma (2026-11-25).
 *
 *   node scripts/verify-sidebar.mjs <mode> [--base <url> --db <postgres url>]
 *
 *   panel     SB2 / SB11 — one panel per panel page, vh.ma's widgets in vh.ma's order; none on
 *             the full-width pages. With --base (production) it also checks a category's page 2,
 *             an author page, Le Club VH's image and link, and /le-luxe/.
 *   inside    SB3 — on the home page Le Club VH, Chroniques cigare, the collector and Cool Drives
 *             are inside the panel and nowhere else.
 *   scroll    SB4 — the panel scrolls with the page (real wheel events), never sticky, no scroll
 *             of its own; the control makes it sticky and must be caught.
 *   geometry  SB5 — 300 px panel, 48 px gap, main column = the rest; below at 390 px.
 *   widgets   SB6 — each widget works as on vh.ma (slider buttons, autoplay, reduced motion…).
 *   leluxe    SB7 — a category's bare slug redirects to its address; unknown bare slugs 404.
 *
 * Without --base the modes start `next start` on the current build (the database in .env,
 * vh_magazine). Test pages are picked from the database (--db, else .env's DATABASE_URL), so the
 * same code checks the seed locally and the archive on production.
 */
import pg from 'pg'

import { assert, fail, getHtml, loadEnv, ok, stripScripts, withServer, elementHtml } from './lib/harness.mjs'
import { horizontalOverflow, withBrowser } from './lib/browser.mjs'

const mode = process.argv[2]
const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const BASE = argOf('base')
const DB = argOf('db') || loadEnv().DATABASE_URL

/** vh.ma's panel, top to bottom (measured 2026-11-25); its two ad slots are not reproduced. */
const FULL = ['collector-promo', 'podcast', 'newsletter', 'instagram', 'most-read', 'latest-articles', 'whos-who', 'chroniques-cigare', 'collector', 'cool-drives']
/** vh.ma hides "Les plus lus" on its home page only. */
const HOME = FULL.filter((k) => k !== 'most-read')
const NO_PANEL = ['/magazine-maroc/', '/contact/', '/vh-tv/', '/rafik-lahlou-team-vh/', '/sondage/']
const LECLUB = { image: 'leclub-VH1', link: '/who-s-who-les-interviews-de-vh/' }

/** Text as typed, whatever French typography the page applied (typoFr: ’ and narrow spaces). */
const plain = (s) => (s ?? '').replace(/[’']/g, "'").replace(/[\u00a0\u202f\s]+/g, ' ').trim()

const sameSequence = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
// Control: the comparison must reject a reordered panel and a missing widget.
if (sameSequence(FULL, [...FULL.slice(0, 6), FULL[7], FULL[6], ...FULL.slice(8)]) || sameSequence(FULL, HOME)) {
  fail('control: the sequence comparison accepts a reordered or shortened panel')
}

/** Test pages picked from the database: every panel page type, by URL. */
async function pickPages() {
  const c = new pg.Client({ connectionString: DB })
  await c.connect()
  try {
    const one = async (sql) => (await c.query(sql)).rows[0] ?? null
    const pathOf = async (categoryId) => {
      const segs = []
      for (let id = categoryId, d = 0; id && d < 8; d++) {
        const r = await one(`select slug, parent_id from categories where id = ${Number(id)}`)
        if (!r) break
        segs.unshift(r.slug)
        id = r.parent_id
      }
      return segs.join('/')
    }
    const a2 = await one(`select a.slug, a.category_id from articles a join categories c on c.id = a.category_id
      where a._status = 'published' and c.parent_id is null order by a.published_at desc limit 1`)
    const a3 = await one(`select a.slug, a.category_id from articles a join categories c on c.id = a.category_id
      join categories p on p.id = c.parent_id where a._status = 'published' and p.parent_id is null order by a.published_at desc limit 1`)
    const big = await one(`select c.slug, count(*)::int n from articles a join categories c on c.id = a.category_id
      where a._status = 'published' and c.parent_id is null group by c.slug order by n desc limit 1`)
    const empty = await one(`select c.id from categories c where not exists (select 1 from articles a where a.category_id = c.id)
      and not exists (select 1 from articles_rels r where r.categories_id = c.id)
      and not exists (select 1 from categories k where k.parent_id = c.id) order by c.id limit 1`)
    const issue = await one(`select slug from magazine_issues where article_id is null order by number desc limit 1`)
    const author = await one(`select slug from authors order by id limit 1`)
    const word = await one(`select title from articles where _status = 'published' order by published_at desc limit 1`)
    const term = (word?.title.match(/[A-Za-zÀ-ÿ]{5,}/) ?? ['Maroc'])[0]
    const pages = {
      home: '/',
      article2: a2 && `/${await pathOf(a2.category_id)}/${a2.slug}/`,
      article3: a3 && `/${await pathOf(a3.category_id)}/${a3.slug}/`,
      category: big && `/category/${big.slug}/`,
      emptyCategory: empty && `/category/${await pathOf(empty.id)}/`,
      searchHits: `/recherche/?q=${encodeURIComponent(term)}`,
      searchNone: '/recherche/?q=zzqxwvkjhg',
      issue: issue && `/sommaire/${issue.slug}/`,
      grandAngle: '/vh-grand-angle-2/',
    }
    if (BASE && big?.n > 14) pages.categoryPage2 = `/category/${big.slug}/?page=2`
    if (author) pages.author = `/author/${author.slug}/`
    for (const [k, v] of Object.entries(pages)) if (!v) fail(`no ${k} page in this database to test`)
    return pages
  } finally {
    await c.end()
  }
}

/** The panel's widget keys, in document order, and how many panels the page has. */
function panelOf(html) {
  const dom = stripScripts(html)
  const panels = dom.split('data-region="sidebar"').length - 1
  const body = elementHtml(dom, 'data-region', 'sidebar')
  const widgets = body ? [...body.matchAll(/data-widget="([^"]+)"/g)].map((m) => m[1]) : []
  return { dom, panels, body, widgets }
}

async function checkPanel(base) {
  const pages = await pickPages()
  const problems = []
  const lines = []
  for (const [kind, path] of Object.entries(pages)) {
    const { status, html } = await getHtml(base + path)
    if (status !== 200) {
      problems.push(`${kind} ${path}: HTTP ${status}`)
      continue
    }
    const { panels, widgets, body } = panelOf(html)
    const want = kind === 'home' ? HOME : FULL
    if (panels !== 1) problems.push(`${kind} ${path}: ${panels} panels`)
    if (!sameSequence(widgets, want)) problems.push(`${kind} ${path}: widgets [${widgets}] ≠ [${want}]`)
    if (BASE && body) {
      const club = elementHtml(body, 'data-widget', 'whos-who') ?? ''
      if (!club.includes(LECLUB.image)) problems.push(`${kind}: Le Club VH does not show ${LECLUB.image}`)
      if (!club.includes(`href="${LECLUB.link}"`)) problems.push(`${kind}: Le Club VH does not link to ${LECLUB.link}`)
    }
    lines.push(`  ${kind.padEnd(14)} ${path} — ${widgets.length} widgets`)
  }
  for (const path of NO_PANEL) {
    const { status, html } = await getHtml(base + path)
    const { panels } = panelOf(html)
    if (status !== 200) problems.push(`${path}: HTTP ${status}`)
    else if (panels !== 0) problems.push(`${path}: a full-width page renders ${panels} panel(s)`)
    else lines.push(`  ${'full-width'.padEnd(14)} ${path} — no panel`)
  }
  if (BASE) {
    const res = await fetch(`${base}/le-luxe/`, { redirect: 'manual' })
    const to = res.headers.get('location') ?? ''
    if (![301, 308].includes(res.status) || !to.endsWith('/category/le-luxe/')) problems.push(`/le-luxe/: ${res.status} → ${to || 'nowhere'}`)
    else lines.push(`  le-luxe        /le-luxe/ — ${res.status} → /category/le-luxe/`)
  }
  console.log(lines.join('\n'))
  assert(problems.length === 0, `panel:\n  ${problems.join('\n  ')}`)
  ok('SIDEBAR_PANEL_OK')
}

async function checkInside() {
  const pages = await pickPages()
  await withBrowser(async ({ page, baseUrl }) => {
    const problems = []
    const { html } = await getHtml(`${baseUrl}/`)
    const { dom, body } = panelOf(html)
    for (const key of ['whos-who', 'chroniques-cigare', 'collector', 'cool-drives']) {
      if (dom.includes(`data-section="${key}"`)) problems.push(`home still has a full-width section "${key}"`)
      const total = dom.split(`data-widget="${key}"`).length - 1
      const inPanel = (body ?? '').split(`data-widget="${key}"`).length - 1
      if (total !== 1 || inPanel !== 1) problems.push(`widget "${key}": ${total} on the page, ${inPanel} in the panel`)
    }
    const p = await page({ width: 1440, height: 900 })
    await p.goto(`${baseUrl}${pages.home}`, { waitUntil: 'load' })
    const boxes = await p.evaluate(() => {
      const aside = document.querySelector('[data-region="sidebar"]').getBoundingClientRect()
      return ['whos-who', 'chroniques-cigare', 'collector', 'cool-drives'].map((k) => {
        const r = document.querySelector(`[data-region="sidebar"] [data-widget="${k}"]`)?.getBoundingClientRect()
        return { k, inside: !!r && r.left >= aside.left - 0.5 && r.right <= aside.right + 0.5 && r.top >= aside.top - 0.5 && r.bottom <= aside.bottom + 0.5, w: r ? Math.round(r.width) : 0 }
      })
    })
    for (const b of boxes) if (!b.inside) problems.push(`widget "${b.k}" is drawn outside the panel's column`)
    console.log(boxes.map((b) => `  ${b.k}: inside the panel, ${b.w} px wide`).join('\n'))
    if (problems.length) throw new Error(problems.join('\n  '))
  })
  ok('SIDEBAR_INSIDE_OK')
}

/** Wheel down then up over the main column; the panel must move exactly with the page. */
async function measureScroll(p) {
  return p.evaluate(async () => {
    const aside = document.querySelector('[data-region="sidebar"]')
    const issues = []
    for (let n = aside; n && n !== document.documentElement; n = n.parentElement) {
      const pos = getComputedStyle(n).position
      if (pos === 'sticky' || pos === 'fixed') issues.push(`${n.tagName.toLowerCase()} is position:${pos}`)
    }
    const cs = getComputedStyle(aside)
    if (!/visible|clip/.test(cs.overflowY) || aside.scrollHeight > aside.clientHeight + 1) issues.push(`the panel scrolls on its own (overflow-y ${cs.overflowY}, ${aside.scrollHeight}/${aside.clientHeight})`)
    return issues
  }).then(async (issues) => {
    const main = await p.$('[data-region="main-column"]')
    const mb = await main.boundingBox()
    await p.mouse.move(mb.x + 40, 450)
    const at = () => p.evaluate(() => ({ y: scrollY, top: document.querySelector('[data-region="sidebar"]').getBoundingClientRect().top }))
    let prev = await at()
    let moved = 0
    const step = async (dy) => {
      await p.mouse.wheel(0, dy)
      await p.waitForTimeout(250)
      const now = await at()
      const dScroll = now.y - prev.y
      const dTop = now.top - prev.top
      moved += Math.abs(dScroll)
      if (Math.abs(dTop + dScroll) > 1) issues.push(`at scrollY ${Math.round(now.y)} the panel moved ${Math.round(dTop)} px for a ${Math.round(dScroll)} px scroll`)
      prev = now
    }
    for (let i = 0; i < 12; i++) await step(400)
    for (let i = 0; i < 6; i++) await step(-400)
    if (moved < 2000) issues.push(`the page scrolled only ${moved} px`)
    return issues
  })
}

async function checkScroll() {
  const pages = await pickPages()
  await withBrowser(async ({ page, baseUrl }) => {
    const problems = []
    for (const kind of ['home', 'article2', 'category']) {
      const p = await page({ width: 1440, height: 900 })
      await p.goto(baseUrl + pages[kind], { waitUntil: 'load' })
      const issues = await measureScroll(p)
      problems.push(...issues.map((x) => `${kind}: ${x}`))
      console.log(`  ${kind}: ${issues.length ? issues.length + ' issue(s)' : 'moves 1:1 with the page, not sticky, no own scroll'}`)
    }
    // Control: the same measurement must flag a sticky panel.
    const c = await page({ width: 1440, height: 900 })
    await c.goto(baseUrl + pages.article2, { waitUntil: 'load' })
    await c.addStyleTag({ content: '[data-region="sidebar"] { position: sticky !important; top: 0 !important; align-self: start; }' })
    const control = await measureScroll(c)
    if (control.length === 0) problems.push('control: a sticky panel went unnoticed')
    else console.log(`  control (sticky panel): caught — ${control[0]}`)
    if (problems.length) throw new Error(problems.join('\n  '))
  })
  ok('SIDEBAR_SCROLL_OK')
}

async function checkGeometry() {
  const pages = await pickPages()
  await withBrowser(async ({ page, baseUrl }) => {
    const problems = []
    const kinds = ['home', 'article2', 'category', 'searchHits', 'issue', 'grandAngle']
    for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]]) {
      const p = await page({ width: w, height: h })
      for (const kind of kinds) {
        await p.goto(baseUrl + pages[kind], { waitUntil: 'load' })
        const g = await p.evaluate(() => {
          const aside = document.querySelector('[data-region="sidebar"]')
          const main = document.querySelector('[data-region="main-column"]')
          const box = aside.closest('.vh-container')
          const cs = getComputedStyle(box)
          const inner = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
          const a = aside.getBoundingClientRect()
          const m = main.getBoundingClientRect()
          return { inner, aw: a.width, mw: m.width, gap: a.left - m.right, below: a.top >= m.bottom - 0.5 }
        })
        const near = (x, y) => Math.abs(x - y) <= 1
        if (w >= 1024) {
          if (!near(g.aw, 300)) problems.push(`${w} ${kind}: panel ${g.aw} px, not 300`)
          if (!near(g.gap, 48)) problems.push(`${w} ${kind}: gap ${g.gap} px, not 48`)
          if (!near(g.mw, g.inner - 348)) problems.push(`${w} ${kind}: main column ${g.mw} px, not ${g.inner - 348}`)
        } else {
          if (!g.below) problems.push(`${w} ${kind}: the panel is not below the main column`)
          if (!near(g.aw, g.inner)) problems.push(`${w} ${kind}: panel ${g.aw} px, not the container's ${g.inner}`)
          const o = await horizontalOverflow(p)
          if (o.overflow > 0) problems.push(`${w} ${kind}: ${o.overflow} px horizontal overflow (${o.culprit})`)
        }
      }
      console.log(`  ${w}px: ${kinds.length} page types measured`)
    }
    if (problems.length) throw new Error(problems.join('\n  '))
  })
  ok('SIDEBAR_GEOMETRY_OK')
}

async function checkWidgets() {
  const pages = await pickPages()
  const c = new pg.Client({ connectionString: DB })
  await c.connect()
  const banners = Object.fromEntries((await c.query(`select key, title, link_url, body from banners where active`)).rows.map((r) => [r.key, r]))
  await c.end()
  for (const k of ['whos-who', 'collector-sport', 'cool-drives']) if (!banners[k]) fail(`no active ${k} banner in this database`)
  await withBrowser(async ({ page, baseUrl }) => {
    const problems = []
    const p = await page({ width: 1440, height: 900 })
    await p.goto(baseUrl + pages.article2, { waitUntil: 'load' })
    const w = await p.evaluate(() => {
      const q = (k) => document.querySelector(`[data-region="sidebar"] [data-widget="${k}"]`)
      const club = q('whos-who'), col = q('collector'), cool = q('cool-drives')
      return {
        club: { href: club?.querySelector('a')?.getAttribute('href'), img: !!club?.querySelector('a img') },
        collector: { title: col?.querySelector('h2')?.textContent.trim(), href: col?.querySelector('a')?.getAttribute('href'), img: !!col?.querySelector('a img'), titleAbove: !!col && col.querySelector('h2').getBoundingClientRect().bottom <= col.querySelector('a img').getBoundingClientRect().top },
        cool: { href: cool?.querySelector('a')?.getAttribute('href'), img: !!cool?.querySelector('a img'), heading: cool?.querySelector('h2')?.textContent.trim(), text: cool?.querySelector('p')?.textContent.trim() ?? null },
        mostRead: { list: q('most-read')?.querySelector('ol') ? 'ol' : null, cards: q('most-read')?.querySelectorAll('[data-card]').length },
        latest: q('latest-articles')?.querySelectorAll('[data-card]').length,
        slides: [...(q('chroniques-cigare')?.querySelectorAll('[data-slide] a') ?? [])].map((a) => a.getAttribute('href')),
      }
    })
    const b = banners
    if (w.club.href !== b['whos-who'].link_url || !w.club.img) problems.push(`Le Club VH: ${JSON.stringify(w.club)} (banner link ${b['whos-who'].link_url})`)
    if (plain(w.collector.title) !== plain(b['collector-sport'].title) || w.collector.href !== b['collector-sport'].link_url || !w.collector.img || !w.collector.titleAbove) problems.push(`collector: ${JSON.stringify(w.collector)}`)
    if (
      w.cool.href !== b['cool-drives'].link_url ||
      !w.cool.img ||
      plain(w.cool.heading) !== plain(b['cool-drives'].title) ||
      plain(w.cool.text) !== plain(b['cool-drives'].body)
    ) {
      problems.push(`Cool Drives: ${JSON.stringify(w.cool)}`)
    }
    if (w.mostRead.list !== 'ol' || w.mostRead.cards !== 5) problems.push(`Les plus lus: ${JSON.stringify(w.mostRead)}`)
    if (w.latest !== 5) problems.push(`Derniers articles: ${w.latest} cards`)
    if (w.slides.length !== 5 || new Set(w.slides).size !== 5 || !w.slides.every((h) => /^\/[^/]+\/([^/]+\/)?[^/]+\/$/.test(h ?? ''))) problems.push(`Chroniques cigare slides: ${JSON.stringify(w.slides)}`)

    // The slider: one slide at a time inside the panel; the next button advances it.
    const slider = async (pg2) =>
      pg2.evaluate(() => {
        const box = document.querySelector('[data-widget="chroniques-cigare"]')
        const t = box.querySelector('[data-carousel-track]')
        const s = box.querySelector('[data-slide]')
        const aside = document.querySelector('[data-region="sidebar"]').getBoundingClientRect()
        const tr = t.getBoundingClientRect()
        return { left: Math.round(t.scrollLeft), cw: t.clientWidth, sw: Math.round(s.getBoundingClientRect().width), total: t.scrollWidth, inPanel: tr.left >= aside.left - 0.5 && tr.right <= aside.right + 0.5, count: box.querySelector('[data-carousel-count]')?.textContent.trim() }
      })
    await p.locator('[data-widget="chroniques-cigare"]').scrollIntoViewIfNeeded()
    await p.mouse.move(5, 5)
    let s0 = await slider(p)
    if (Math.abs(s0.sw - s0.cw) > 1 || Math.abs(s0.total - 5 * s0.cw) > 2 || !s0.inPanel) problems.push(`slider is not one slide at a time inside the panel: ${JSON.stringify(s0)}`)
    // Reload so autoplay has not moved it, then press next.
    await p.reload({ waitUntil: 'load' })
    await p.locator('[data-widget="chroniques-cigare"] [data-carousel-next]').click()
    await p.waitForTimeout(900)
    const s1 = await slider(p)
    if (Math.abs(s1.left - s1.cw) > 2 || !/^2 \/ 5$/.test(s1.count ?? '')) problems.push(`next button: ${JSON.stringify(s1)}`)

    // Autoplay: on screen, pointer away, it advances within 7 s.
    const a = await page({ width: 1440, height: 900 })
    await a.goto(baseUrl + pages.article2, { waitUntil: 'load' })
    await a.locator('[data-widget="chroniques-cigare"]').scrollIntoViewIfNeeded()
    await a.mouse.move(5, 5)
    let advanced = false
    for (let t = 0; t < 14 && !advanced; t++) {
      await a.waitForTimeout(500)
      advanced = (await slider(a)).left > 0
    }
    if (!advanced) problems.push('autoplay: the slider did not advance within 7 s')

    // Reduced motion: it never moves on its own.
    const browserCtx = a.context().browser()
    const rm = await browserCtx.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const r = await rm.newPage()
    await r.goto(baseUrl + pages.article2, { waitUntil: 'load' })
    await r.locator('[data-widget="chroniques-cigare"]').scrollIntoViewIfNeeded()
    await r.mouse.move(5, 5)
    await r.waitForTimeout(7000)
    if ((await slider(r)).left !== 0) problems.push('reduced motion: the slider moved on its own')
    await rm.close()

    console.log(`  Le Club VH → ${w.club.href}; collector "${w.collector.title}"; Cool Drives "${w.cool.heading}"`)
    console.log(`  Les plus lus ${w.mostRead.cards} ranked; Derniers articles ${w.latest}; Chroniques cigare ${w.slides.length} slides, next → "${s1.count}", autoplay ${advanced ? 'advanced' : 'stuck'}`)
    if (problems.length) throw new Error(problems.join('\n  '))
  })
  ok('SIDEBAR_WIDGETS_OK')
}

async function checkLeLuxe() {
  const c = new pg.Client({ connectionString: DB })
  await c.connect()
  const top = (await c.query(`select c.slug from categories c where c.parent_id is null and exists (select 1 from categories k where k.parent_id = c.id) order by c.id limit 1`)).rows[0]
  const child = (await c.query(`select c.slug, p.slug as parent from categories c join categories p on p.id = c.parent_id where p.parent_id is null order by c.id limit 1`)).rows[0]
  await c.end()
  if (!top || !child) fail('no top-level and child category in this database')
  await withServer(async (baseUrl) => {
    const problems = []
    const cases = [
      [`/${top.slug}/`, `/category/${top.slug}/`],
      [`/${child.slug}/`, `/category/${child.parent}/${child.slug}/`],
    ]
    for (const [from, to] of cases) {
      const res = await fetch(baseUrl + from, { redirect: 'manual' })
      const loc = res.headers.get('location') ?? ''
      if (![301, 308].includes(res.status) || new URL(loc, baseUrl).pathname !== to) problems.push(`${from}: ${res.status} → ${loc || 'nowhere'} (want ${to})`)
      else console.log(`  ${from} → ${res.status} ${to}`)
    }
    const miss = await fetch(`${baseUrl}/zz-no-such-category-qx/`, { redirect: 'manual' })
    if (miss.status !== 404) problems.push(`/zz-no-such-category-qx/: ${miss.status}, want 404`)
    else console.log('  /zz-no-such-category-qx/ → 404')
    assert(problems.length === 0, problems.join('\n  '))
  })
  ok('LELUXE_OK')
}

const MODES = {
  panel: () => (BASE ? checkPanel(BASE.replace(/\/$/, '')) : withServer((u) => checkPanel(u))),
  inside: checkInside,
  scroll: checkScroll,
  geometry: checkGeometry,
  widgets: checkWidgets,
  leluxe: checkLeLuxe,
}
if (!MODES[mode]) fail(`usage: verify-sidebar.mjs <${Object.keys(MODES).join('|')}> [--base <url> --db <url>]`)
await MODES[mode]().catch((e) => fail(e.message))
