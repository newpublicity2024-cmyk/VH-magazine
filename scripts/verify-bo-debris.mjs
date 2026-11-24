/**
 * BO-G17 — the back-office gates leave nothing behind.
 *
 * Every BO gate stamps its rows `g7N-…` or `g8N-…` (users by email, articles and versions by slug or by a
 * stamped author, redirects by path), and sweeps them before and after it runs. This gate:
 *  1. plants one row of each kind a BO gate can leave — a user, an article and its version, a
 *     redirect, a document lock and a preference held by that user, a rubric — through Payload;
 *  2. requires the detector — the planted rows' own stamp AND the broad g7N/g8N pattern — to
 *     count each planted kind (a detector that counts nothing would certify any database clean);
 *     the plant is stamped g89, so the broad pattern is shown to reach the g8N range;
 *  3. removes them with the same cleanup the gates use, and requires the whole database to hold
 *     no row stamped by ANY back-office gate.
 */
import { cleanupGate, runDriver, stampFor } from './lib/backoffice.mjs'
import { check, checkEqual, ok, pgClient, withCleanup } from './lib/harness.mjs'

const ALL = {
  email: '^g[78][0-9]-[a-z0-9]+-[0-9]+@gate\\.vh\\.ma$',
  slug: '^g[78][0-9]-',
  path: '/g[78][0-9]-',
}

async function detect(p) {
  const c = await pgClient()
  try {
    const q = async (sql, args) => Number((await c.query(sql, args)).rows[0].count)
    const users = `(select id from users where email ~ $1)`
    return {
      users: await q(`select count(*) from users where email ~ $1`, [p.email]),
      articles: await q(`select count(*) from articles where slug ~ $2 or author_id in ${users}`, [
        p.email,
        p.slug,
      ]),
      versions: await q(
        `select count(*) from _articles_v where version_slug ~ $2 or version_author_id in ${users}`,
        [p.email, p.slug],
      ),
      redirects: await q(`select count(*) from redirects where "from" ~ $1 or "to" ~ $1`, [p.path]),
      locks: await q(
        `select count(*) from payload_locked_documents_rels where users_id in ${users}`,
        [p.email],
      ),
      preferences: await q(
        `select count(*) from payload_preferences_rels where users_id in ${users}`,
        [p.email],
      ),
      categories: await q(`select count(*) from categories where slug ~ $1`, [p.slug]),
    }
  } finally {
    await c.end()
  }
}

const s = stampFor('g89')
const planted = {
  email: s.patterns.email,
  slug: `^g89-plant-${s.ms}$`,
  path: `/g89-plant-${s.ms}/`,
}

await withCleanup(
  async () => {
    const { user } = runDriver(`
const u = await p.create({ collection: 'users', overrideAccess: true, data: { email: ${JSON.stringify(s.email('plant'))}, password: 'Plant-2026!', name: 'G89 Plant', role: 'journalist' } })
const a = await p.create({ collection: 'articles', overrideAccess: true, draft: true, data: { title: 'G89 plant', slug: ${JSON.stringify(`g89-plant-${s.ms}`)}, author: u.id } })
await p.create({ collection: 'redirects', overrideAccess: true, data: { from: ${JSON.stringify(`/g89-plant-${s.ms}/`)}, to: '/', source: 'manual' } })
await p.create({ collection: 'payload-locked-documents', overrideAccess: true, data: { document: { relationTo: 'articles', value: a.id }, user: { relationTo: 'users', value: u.id } } })
await p.create({ collection: 'categories', overrideAccess: true, data: { name: 'G89 plant', slug: ${JSON.stringify(`g89-plant-${s.ms}`)} } })
print({ user: u.id })
`)
    // A preference is planted in SQL, the way Payload stores one (row + 'user' relation): its
    // Local API refuses a hand-made preference's polymorphic user field.
    const c = await pgClient()
    try {
      const pref = (
        await c.query(
          `insert into payload_preferences (key, value) values ('g89-plant', '{"planted":true}') returning id`,
        )
      ).rows[0].id
      await c.query(
        `insert into payload_preferences_rels ("order", parent_id, path, users_id) values (1, $1, 'user', $2)`,
        [pref, user],
      )
    } finally {
      await c.end()
    }
    const seen = await detect(planted)
    for (const [kind, n] of Object.entries(seen))
      check(n >= 1, `the detector does not see the planted ${kind} (counted ${n})`)
    const seenBroad = await detect(ALL)
    for (const [kind, n] of Object.entries(seenBroad))
      check(n >= 1, `the g7N/g8N detector does not see the planted g89 ${kind} (counted ${n})`)

    const removed = await cleanupGate(planted)
    check(
      Object.values(removed.left).every((n) => n === 0),
      `cleanup left planted rows: ${JSON.stringify(removed.left)}`,
    )
    const after = await detect(planted)
    for (const [kind, n] of Object.entries(after)) checkEqual(n, 0, `planted ${kind} after cleanup`)

    const everything = await detect(ALL)
    for (const [kind, n] of Object.entries(everything))
      checkEqual(n, 0, `${kind} stamped by a back-office gate (g70–g89)`)
    console.error(
      `  detector counted every planted kind ${JSON.stringify(seen)}; after cleanup the database holds no g7N/g8N row of any kind`,
    )
  },
  async () => {
    await cleanupGate(planted)
  },
)
ok('BO_DEBRIS_OK')
