/**
 * R3-G8 — articles read clearly (DESIGN-SPEC-R3 §2 defects 2–3, §5.2).
 *
 * Browser, on a seeded article:
 *   - the body carries .vh-prose and consecutive paragraphs sit ≥ 16 px apart (measured
 *     as the gap between their boxes, not read from a stylesheet);
 *   - body paragraphs are ≥ 18 px at 1440 and ≥ 17 px at 390;
 *   - the reading column is ≤ 720 px wide at 1440; the h1 wraps balanced.
 *
 * Data, on every published migrated body in vh_migration (read-only SQL; never served,
 * so no ISR cache is written from it): every top-level node is one of the block types
 * RichTextBody maps to its own block element (paragraph → <p>, heading → <h2>/<h3>,
 * list, quote, rule, upload, block), and no body has bare text at the top level. With
 * the browser measurement above, that is what "no run-together paragraphs" means for
 * all 8k migrated articles rather than a hand-picked sample.
 */
import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok } from './lib/harness.mjs'
import { seededArticleHref } from './lib/r3.mjs'

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'list', 'quote', 'horizontalrule', 'upload', 'block'])

// ── Data: migrated bodies ─────────────────────────────────────────────────
const pg = (await import('pg')).default
const client = new pg.Client({ connectionString: 'postgres://localhost/vh_migration' })
await client.connect()
let bodies
try {
  await client.query('SET default_transaction_read_only = on')
  ;({ rows: bodies } = await client.query(
    `select id, slug, body from articles where _status = 'published' and body is not null`,
  ))
} finally {
  await client.end()
}
assert(bodies.length > 5000, `only ${bodies.length} migrated bodies found in vh_migration — wrong database?`)
const offenders = []
for (const { id, slug, body } of bodies) {
  const kids = body?.root?.children
  if (!Array.isArray(kids)) {
    offenders.push(`#${id} ${slug}: no root children`)
    continue
  }
  const bad = kids.filter((n) => !BLOCK_TYPES.has(n.type)).map((n) => n.type)
  if (bad.length) offenders.push(`#${id} ${slug}: top-level ${[...new Set(bad)].join(', ')}`)
}
if (offenders.length) fail(`${offenders.length} migrated bodies have non-block top-level nodes:\n  ${offenders.slice(0, 15).join('\n  ')}`)
console.error(`  ${bodies.length} migrated bodies: every top-level node is a block the renderer spaces`)

// ── Browser: the seeded article ───────────────────────────────────────────
await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const probe = await page({ width: 1440, height: 900 })
  const article = await seededArticleHref(probe, baseUrl)
  await probe.context().close()

  for (const vp of [{ width: 1440, height: 900, minFont: 18 }, { width: 390, height: 844, minFont: 17 }]) {
    const p = await page({ width: vp.width, height: vp.height })
    await p.goto(`${baseUrl}${article}`, { waitUntil: 'load', timeout: 60_000 })
    const m = await p.evaluate(() => {
      const body = document.querySelector('[data-article-body]')
      if (!body) return null
      const ps = [...body.querySelectorAll(':scope > p')]
      const gaps = []
      for (let i = 1; i < ps.length; i += 1) gaps.push(ps[i].getBoundingClientRect().top - ps[i - 1].getBoundingClientRect().bottom)
      const h1 = document.querySelector('h1')
      const hcs = getComputedStyle(h1)
      return {
        prose: body.classList.contains('vh-prose'),
        paragraphs: ps.length,
        minGap: gaps.length ? Math.min(...gaps) : null,
        font: ps.length ? parseFloat(getComputedStyle(ps[0]).fontSize) : null,
        width: body.getBoundingClientRect().width,
        balance: hcs.textWrapStyle || hcs.textWrap,
      }
    })
    assert(m, `${vp.width}: no [data-article-body] on ${article}`)
    assert(m.prose, `${vp.width}: the article body does not carry .vh-prose`)
    assert(m.paragraphs >= 2, `${vp.width}: seeded article has ${m.paragraphs} paragraph(s) — cannot measure spacing`)
    assert(m.minGap >= 16, `${vp.width}: paragraphs are ${m.minGap}px apart (< 16px) — they run together`)
    assert(m.font >= vp.minFont, `${vp.width}: body font is ${m.font}px (< ${vp.minFont}px)`)
    if (vp.width === 1440) assert(m.width <= 720, `1440: reading column is ${m.width}px wide (> 720px)`)
    assert(String(m.balance).includes('balance'), `${vp.width}: h1 text-wrap is ${m.balance}, expected balance`)
    console.error(`  ${vp.width}: ${m.paragraphs} paragraphs, min gap ${m.minGap}px, ${m.font}px body, column ${Math.round(m.width)}px, h1 ${m.balance}`)
    await p.context().close()
  }
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

ok('R3_READING_OK')
