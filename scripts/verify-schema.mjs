/**
 * G4 — every collection and global exists as a real table, and categories
 * carries a self-referencing parent foreign key.
 *
 * The parent FK is checked structurally (pg_constraint, confrelid = conrelid)
 * rather than by "a column called parent_id exists": a column of the right name
 * with no constraint behind it would let the nested-URL scheme silently rot.
 */
import { pgClient, assert, ok } from './lib/harness.mjs'

const EXPECTED_COLLECTION_TABLES = [
  'articles',
  'categories',
  'tags',
  'magazine_issues',
  'banners',
  'newsletter_subscribers',
  'contact_messages',
  'redirects',
  'media',
  'users',
]

const EXPECTED_GLOBAL_TABLES = ['homepage', 'site_settings']

const client = await pgClient()

const { rows: tableRows } = await client.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'`,
)
const tables = new Set(tableRows.map((r) => r.table_name))

const missing = [...EXPECTED_COLLECTION_TABLES, ...EXPECTED_GLOBAL_TABLES].filter(
  (t) => !tables.has(t),
)
assert(
  missing.length === 0,
  `missing tables: ${missing.join(', ')} — present: ${[...tables].sort().join(', ')}`,
)

// Drafts are enabled on articles, so the versions table must exist too;
// without it, publish/unpublish and the redirect hook's _status checks are moot.
assert(
  tables.has('_articles_v'),
  `articles versions table (_articles_v) missing — drafts are not enabled`,
)

// categories.parent must be a self-referencing FK.
const { rows: fkRows } = await client.query(
  `select con.conname, con.conrelid::regclass::text as from_table,
          con.confrelid::regclass::text as to_table,
          (select array_agg(att.attname::text order by att.attnum)
             from unnest(con.conkey) as k(attnum)
             join pg_attribute att
               on att.attrelid = con.conrelid and att.attnum = k.attnum) as columns
     from pg_constraint con
    where con.contype = 'f'
      and con.conrelid = 'public.categories'::regclass
      and con.confrelid = 'public.categories'::regclass`,
)

assert(
  fkRows.length > 0,
  'categories has no self-referencing foreign key — nested category paths (A1) cannot work',
)

/** node-postgres parses text[] into an array, but a driver or type change
 *  could hand back the raw `{parent_id}` literal — accept both. */
const columnsOf = (row) => {
  const c = row.columns
  if (Array.isArray(c)) return c
  if (typeof c === 'string') return c.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
  return []
}

const parentFk = fkRows.find((r) => columnsOf(r).some((c) => /parent/i.test(c)))
assert(
  Boolean(parentFk),
  `categories self-FK exists but not on a parent column — found on ${JSON.stringify(
    fkRows.map((r) => columnsOf(r)),
  )}`,
)

// The redirect map is uniquely keyed on `from`; without this a rename could
// write a second row for the same old URL and the map would be ambiguous.
const { rows: uniqueRows } = await client.query(
  `select indexdef from pg_indexes
    where schemaname = 'public' and tablename = 'redirects'`,
)
assert(
  uniqueRows.some((r) => /unique/i.test(r.indexdef) && /\(.*\bfrom\b.*\)/i.test(r.indexdef)),
  `redirects.from has no unique index — indexes present: ${uniqueRows
    .map((r) => r.indexdef)
    .join(' | ')}`,
)

await client.end()
ok('SCHEMA_OK')
