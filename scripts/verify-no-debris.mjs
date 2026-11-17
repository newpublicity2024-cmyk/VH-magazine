/**
 * G44 — the dev database holds no gate debris.
 *
 * G19, G34 and G35 write throwaway rows into vh_magazine. Until 2026-11-17 they left some
 * behind: an assertion calls process.exit, which skips `finally`, so a failing run kept its
 * article (one showed in "Derniers articles"); and the cleanups deleted the article before
 * its versions — `_articles_v.parent_id` is ON DELETE SET NULL, so the versions survived
 * as orphans that the follow-up `where parent_id = $1` could no longer find (97 of them).
 *
 * This measures the database, not the writers: it uses its own patterns, broader than any
 * single gate's (every gate stamps its slugs `g<NN>-…`), so a new writer is covered too.
 * The form gates are counted as well: G26 stores contact messages from `g26-…@example.com`
 * and G13 subscribes `gate-g13@vh-magazine.test`; both sweep their own rows when they start.
 * Control: one planted row of each kind, counted inside a transaction that is rolled back.
 */
import { ok, fail, pgClient } from './lib/harness.mjs'

const SLUG = '^g[0-9]{2}-'
const PATH = '/g[0-9]{2}-'
const EMAIL = '^(g[0-9]{2}-|gate-g[0-9]{2}@)'

const census = async (c) => {
  const { rows } = await c.query(
    `select
       (select count(*) from articles where slug ~ $1)::int as articles,
       (select count(*) from _articles_v where version_slug ~ $1)::int as versions,
       (select count(*) from _articles_v where parent_id is null)::int as orphans,
       (select count(*) from redirects where "from" ~ $2 or "to" ~ $2)::int as redirects,
       (select count(*) from contact_messages where email ~ $3)::int as contacts,
       (select count(*) from newsletter_subscribers where email ~ $3)::int as subscribers`,
    [SLUG, PATH, EMAIL],
  )
  return rows[0]
}

const c = await pgClient()
let control
let real
let samples = []
try {
  const { rows } = await c.query('select current_database() as db')
  if (rows[0].db !== 'vh_magazine') fail(`DATABASE_URL points at ${rows[0].db}, not vh_magazine`)

  // Control: the census must see one planted row of each kind.
  await c.query('begin')
  try {
    const before = await census(c)
    await c.query(`insert into articles (title, slug) values ('planted', 'g99-planted-control')`)
    await c.query(
      `insert into _articles_v (parent_id, version_slug, version_title) values (null, 'g99-planted-control', 'planted')`,
    )
    await c.query(`insert into redirects ("from", "to") values ('/g99-planted-control/', '/')`)
    await c.query(
      `insert into contact_messages (name, email, subject, message) values ('planted', 'g99-planted@example.com', 'x', 'x')`,
    )
    await c.query(`insert into newsletter_subscribers (email) values ('gate-g99@vh-magazine.test')`)
    const after = await census(c)
    control = Object.fromEntries(Object.keys(after).map((k) => [k, after[k] - before[k]]))
  } finally {
    await c.query('rollback')
  }

  real = await census(c)
  if (Object.values(real).some((n) => n > 0)) {
    const { rows: s } = await c.query(
      `select 'article' as kind, slug as what from articles where slug ~ $1
       union all select 'version', coalesce(version_slug, '(no slug)') || ' parent=' || coalesce(parent_id::text, 'null')
         from _articles_v where version_slug ~ $1 or parent_id is null
       union all select 'redirect', "from" || ' -> ' || "to" from redirects where "from" ~ $2 or "to" ~ $2
       union all select 'contact', email from contact_messages where email ~ $3
       union all select 'subscriber', email from newsletter_subscribers where email ~ $3
       limit 12`,
      [SLUG, PATH, EMAIL],
    )
    samples = s.map((r) => `${r.kind} ${r.what}`)
  }
} finally {
  await c.end()
}

// one of each; the planted version counts twice — by its slug and as an orphan
const want = { articles: 1, versions: 1, orphans: 1, redirects: 1, contacts: 1, subscribers: 1 }
for (const [k, n] of Object.entries(want)) {
  if (control[k] !== n)
    fail(`control: the census counted ${control[k]} planted ${k}, expected ${n}`)
}
console.error(`  control: planted rows counted ${JSON.stringify(control)}, rolled back`)

const found = Object.entries(real).filter(([, n]) => n > 0)
if (found.length) {
  fail(
    `gate debris in vh_magazine: ${found.map(([k, n]) => `${n} ${k}`).join(', ')}. e.g. ${samples.join('; ')}`,
  )
}
console.error(`  vh_magazine: ${JSON.stringify(real)}`)
ok('NO_DEBRIS_OK')
