/**
 * G5 — seed content is present at the expected per-collection counts, including
 * at least one article filed under the moteur/vh-moteur subcategory (A1).
 *
 * Every figure below is MEASURED from the database. Nothing is echoed back from
 * the seed script: if the seed and this checker both read from the same constant
 * the gate would prove only that the constant exists.
 */
import { pgClient, assert, assertEqual, ok } from './lib/harness.mjs'

/** Minimum rows per table, driven by what the homepage needs to render. */
const MINIMUMS = {
  categories: 8, // §4.2 nav categories + the two subcategories
  articles: 30, // 4+4+4+6+5 blocks, plus most-read/latest overlap and slack
  'magazine_issues': 4, // §5.13 "Toutes nos unes"
  banners: 7, // §5 has seven promo slots
  media: 30, // one featured image per article, plus banners and covers
  users: 1, // the seeded admin
}

const client = await pgClient()

for (const [table, minimum] of Object.entries(MINIMUMS)) {
  const { rows } = await client.query(`select count(*)::int as n from ${table}`)
  const measured = rows[0].n
  assert(
    measured >= minimum,
    `table "${table}" has ${measured} rows, expected at least ${minimum}`,
  )
}

// Every article the homepage renders must be published — a draft would silently
// drop a card and make the count gate fail with a confusing message instead.
const { rows: statusRows } = await client.query(
  `select count(*)::int as n from articles where _status is distinct from 'published'`,
)
/*
 * Round 2a: the seed now creates exactly ONE deliberate draft — the negative
 * control G31 uses to prove the sitemap excludes unpublished articles. Asserting
 * "zero drafts" would fail; asserting "any number" would let a genuinely broken
 * seed through. So pin it to the one expected control, by slug.
 */
assertEqual(statusRows[0].n, 1, 'number of non-published seeded articles (the G31 draft control)')

const { rows: draftRows } = await client.query(
  `select slug from articles where _status <> 'published'`,
)
assertEqual(
  draftRows[0]?.slug,
  'brouillon-controle-sitemap',
  'the only unpublished article must be the G31 sitemap control',
)

// A1: the nested category must exist, with the right parent...
const { rows: nested } = await client.query(
  `select c.slug as child, p.slug as parent
     from categories c join categories p on c.parent_id = p.id
    where c.slug = 'vh-moteur'`,
)
assert(nested.length === 1, 'category "vh-moteur" with a parent was not seeded')
assertEqual(nested[0].parent, 'moteur', 'parent of the vh-moteur category')

// ...and at least one article must actually be filed under it, otherwise the
// nested URL shape is defined but never rendered (see G11's vacuity guard).
const { rows: nestedArticles } = await client.query(
  `select count(*)::int as n
     from articles a
     join categories c on a.category_id = c.id
    where c.slug = 'vh-moteur' and a._status = 'published'`,
)
assert(
  nestedArticles[0].n >= 1,
  `no published article filed under moteur/vh-moteur — the 3-segment URL case would never render`,
)

// The slugify contract: the live vh.ma URL for this article is known exactly, so
// assert the seeded slug reproduces it. A regression in the diacritic or
// apostrophe handling would break SEO continuity on every migrated URL.
const { rows: slugRows } = await client.query(
  `select slug from articles where title like 'Porsche%'`,
)
assert(slugRows.length > 0, 'the Porsche article (spec §5.3) was not seeded')
assertEqual(
  slugRows[0].slug,
  'porsche-licone-sous-pression',
  'slug for "Porsche, l’icône sous pression" (must match the live vh.ma URL)',
)

// Media rows must carry real dimensions, or next/image cannot emit width/height
// and G14 fails downstream with a less obvious cause.
const { rows: dimRows } = await client.query(
  `select count(*)::int as n from media
    where mime_type like 'image/%' and (width is null or height is null or width = 0)`,
)
assertEqual(dimRows[0].n, 0, 'image media rows missing width/height')

// Every article needs a featured image: it is required in the schema, but a
// null here would surface as a broken card rather than a validation error.
const { rows: imgRows } = await client.query(
  `select count(*)::int as n from articles where featured_image_id is null`,
)
assertEqual(imgRows[0].n, 0, 'articles with no featured image')

await client.end()
ok('SEED_OK')
