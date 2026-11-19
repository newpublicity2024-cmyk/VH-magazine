/**
 * R3-G15 — French typesetting is applied and safe (DESIGN-SPEC-R3 §3.2).
 *
 * 1. Fixtures: typoFr puts U+202F before ? ! ; : and inside « », a no-break space between
 *    a number and its unit, and leaves URLs, e-mail addresses and times alone.
 * 2. Every published migrated title in vh_migration (read-only SQL): typoFr is idempotent
 *    on it, and its output never has a plain space next to a narrow no-break space (the
 *    double-space the spec warned about, from titles that already carry typed spaces).
 * 3. Rendered: the seeded "Starlink … Royal Air Maroc ?" title shows U+202F before the
 *    question mark in its category-listing card and its article h1 (located via the DB).
 */
import { typoFr } from '../src/lib/typo-fr.ts'
import { withBrowser } from './lib/browser.mjs'
import { assert, fail, ok, pgClient } from './lib/harness.mjs'

const NNBSP = ' '
const NBSP = ' '

const FIXTURES = [
  ['Pourquoi ?', `Pourquoi${NNBSP}?`],
  ['Pourquoi?', `Pourquoi${NNBSP}?`],
  ['Jour 2 : les maîtres', `Jour 2${NNBSP}: les maîtres`],
  ['« Main de Dieu »', `«${NNBSP}Main de Dieu${NNBSP}»`],
  ['Rendez-vous à 12:24', 'Rendez-vous à 12:24'],
  ['Voir https://vh.ma/a?b=c ici', 'Voir https://vh.ma/a?b=c ici'],
  ['Écrire à contact@vh.ma !', `Écrire à contact@vh.ma${NNBSP}!`],
  ['690 DH', `690${NBSP}DH`],
  ['8,6 %', `8,6${NNBSP}%`],
]
for (const [input, want] of FIXTURES) {
  const got = typoFr(input)
  assert(got === want, `typoFr(${JSON.stringify(input)}) = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`)
}

const pg = (await import('pg')).default
const client = new pg.Client({ connectionString: 'postgres://localhost/vh_migration' })
await client.connect()
let titles
try {
  await client.query('SET default_transaction_read_only = on')
  ;({ rows: titles } = await client.query(`select id, title from articles where _status = 'published'`))
} finally {
  await client.end()
}
assert(titles.length > 5000, `only ${titles.length} migrated titles — wrong database?`)
const bad = []
let changed = 0
for (const { id, title } of titles) {
  const once = typoFr(title)
  if (once !== title) changed += 1
  if (typoFr(once) !== once) bad.push(`#${id} not idempotent: ${JSON.stringify(title)}`)
  if (/[  ][ ]|[ ][  ]/.test(once)) bad.push(`#${id} space beside NNBSP: ${JSON.stringify(once)}`)
}
if (bad.length) fail(`${bad.length} migrated title(s) mis-set:\n  ${bad.slice(0, 15).join('\n  ')}`)
console.error(`  ${titles.length} migrated titles: idempotent, no doubled spaces (${changed} adjusted)`)

// The seeded Starlink article: its URL and category listing come from the database, so the
// check does not depend on which block the homepage happens to show it in.
const local = await pgClient()
let target
try {
  const { rows } = await local.query(
    `select a.slug, c.slug as cat, pc.slug as parent
       from articles a join categories c on c.id = a.category_id
       left join categories pc on pc.id = c.parent_id
      where a._status = 'published' and a.title like 'Starlink%?'`,
  )
  assert(rows.length === 1, `expected one seeded Starlink article, found ${rows.length}`)
  const r = rows[0]
  const catPath = [r.parent, r.cat].filter(Boolean).join('/')
  target = { article: `/${catPath}/${r.slug}/`, listing: `/category/${catPath}/` }
} finally {
  await local.end()
}

await withBrowser(async ({ page, baseUrl, pageErrors }) => {
  const p = await page({ width: 1440, height: 900 })
  await p.goto(`${baseUrl}${target.listing}`, { waitUntil: 'load', timeout: 60_000 })
  const card = await p.evaluate(() => {
    const t = [...document.querySelectorAll('[data-headline]')].find((el) => el.textContent.includes('Starlink'))
    return t ? t.textContent : null
  })
  assert(card, `the Starlink card is not on its category page ${target.listing}`)
  assert(card.includes(`Maroc${NNBSP}?`), `card title is ${JSON.stringify(card)} — no U+202F before "?"`)
  await p.goto(`${baseUrl}${target.article}`, { waitUntil: 'load', timeout: 60_000 })
  const h1 = await p.locator('h1').first().textContent()
  assert(h1.includes(`Maroc${NNBSP}?`), `article h1 is ${JSON.stringify(h1)} — no U+202F before "?"`)
  console.error('  rendered: listing card and article h1 carry U+202F before "?"')
  await p.context().close()
  assert(pageErrors.length === 0, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
})

ok('R3_TYPO_OK')
