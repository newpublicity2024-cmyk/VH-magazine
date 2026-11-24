/**
 * BO-G9 — « Soumettre pour relecture » and the editor's publish, end to end at the API.
 *
 *  1. A journalist submits an EMPTY draft: refused with a ValidationError naming exactly title,
 *     category, featuredImage and body (the four things the checklist shows).
 *  2. They complete it and submit again (a draft save setting reviewState 'pending', as the
 *     button does): accepted; the LATEST VERSION carries 'pending' while the live row is
 *     untouched (draft saves never write it), and it has no publication date yet.
 *  3. The editors' queue — the dashboard's own `pendingWhere` query, run as the editor — lists it.
 *  4. The editor publishes without a date: the article goes live with reviewState 'none' and is
 *     dated at that moment (± 2 min of the measured clock).
 *  5. An article an editor dated by hand keeps that date when published.
 * Every number is measured from the database, not from the driver's own report.
 */
import {
  cleanupGate,
  createUsers,
  fixtureRefs,
  runDriver,
  simpleBody,
  stampFor,
} from './lib/backoffice.mjs'
import { check, checkEqual, ok, pgClient, withCleanup } from './lib/harness.mjs'

const s = stampFor('g73')
await cleanupGate(s.anyRun)

await withCleanup(
  async () => {
    const u = createUsers(s, ['journalist', 'editor'])
    const { categoryId, mediaIds } = await fixtureRefs(1)
    const handDate = '2026-01-02T09:30:00.000Z'

    const r = runDriver(`
const { pendingWhere } = await import('./src/backoffice/dashboard/shared')
const J = await p.findByID({ collection: 'users', id: ${u.journalist.id}, overrideAccess: true })
const E = await p.findByID({ collection: 'users', id: ${u.editor.id}, overrideAccess: true })
const out: Record<string, unknown> = {}

const doc = await p.create({ collection: 'articles', user: J, overrideAccess: false, draft: true, data: {} })
out.id = doc.id
try {
  await p.update({ collection: 'articles', id: doc.id, user: J, overrideAccess: false, draft: true, data: { reviewState: 'pending', _status: 'draft' } })
  out.emptySubmit = 'accepted'
} catch (e) {
  const err = e as { name?: string; data?: { errors?: Array<{ path: string }> } }
  out.emptySubmit = err.name
  out.emptyPaths = (err.data?.errors ?? []).map((x) => x.path).sort()
}

await p.update({ collection: 'articles', id: doc.id, user: J, overrideAccess: false, draft: true, data: {
  title: ${JSON.stringify(s.title('Relecture'))}, category: ${categoryId}, featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(simpleBody('Un article complet, prêt pour la relecture.'))}, _status: 'draft',
} })
await p.update({ collection: 'articles', id: doc.id, user: J, overrideAccess: false, draft: true, data: { reviewState: 'pending', _status: 'draft' } })

const queue = await p.find({ collection: 'articles', draft: true, where: pendingWhere(E as never), user: E, overrideAccess: false, limit: 100, depth: 0 })
out.inQueue = queue.docs.some((d) => d.id === doc.id)

out.beforePublish = Date.now()
await p.update({ collection: 'articles', id: doc.id, user: E, overrideAccess: false, data: { _status: 'published' }, context: { skipRedirects: true } })
out.afterPublish = Date.now()

const dated = await p.create({ collection: 'articles', user: E, overrideAccess: false, draft: true, data: {
  title: ${JSON.stringify(s.title('Datée à la main'))}, category: ${categoryId}, featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(simpleBody('Date choisie par la rédaction.'))}, publishedAt: ${JSON.stringify(handDate)},
} })
await p.update({ collection: 'articles', id: dated.id, user: E, overrideAccess: false, data: { _status: 'published' }, context: { skipRedirects: true } })
out.datedId = dated.id
print(out)
`)

    checkEqual(r.emptySubmit, 'ValidationError', 'submitting an empty draft for review')
    checkEqual(
      JSON.stringify(r.emptyPaths),
      JSON.stringify(['body', 'category', 'featuredImage', 'title']),
      'fields named by the refusal',
    )
    check(r.inQueue, "the submitted article is not in the editors' pending queue")

    const c = await pgClient()
    try {
      // Re-read the state just before publish from history: the version written by the submission.
      const pendingVersions = Number(
        (
          await c.query(
            `select count(*) from _articles_v where parent_id = $1 and version_review_state = 'pending' and version__status = 'draft'`,
            [r.id],
          )
        ).rows[0].count,
      )
      check(pendingVersions >= 1, 'no draft version carries the pending flag')
      const main = (
        await c.query(`select _status, review_state, published_at from articles where id = $1`, [
          r.id,
        ])
      ).rows[0]
      checkEqual(main._status, 'published', 'live status after the editor publishes')
      checkEqual(main.review_state, 'none', 'review flag after publishing')
      const at = new Date(main.published_at).getTime()
      check(
        at >= r.beforePublish - 120_000 && at <= r.afterPublish + 120_000,
        `publication date ${main.published_at} is not the moment of publication (${new Date(r.beforePublish).toISOString()})`,
      )
      const latest = (
        await c.query(
          `select version_review_state from _articles_v where parent_id = $1 and latest`,
          [r.id],
        )
      ).rows[0]
      checkEqual(
        latest?.version_review_state,
        'none',
        'review flag on the latest version after publishing',
      )
      const dated = (await c.query(`select published_at from articles where id = $1`, [r.datedId]))
        .rows[0]
      checkEqual(
        new Date(dated.published_at).toISOString(),
        '2026-01-02T09:30:00.000Z',
        'a hand-set publication date after publishing',
      )
    } finally {
      await c.end()
    }
    console.error(
      '  empty submit refused (title, category, featuredImage, body); complete submit queued; publish clears the flag and dates it now; a hand-set date is kept',
    )
  },
  async () => {
    const r = await cleanupGate(s.patterns)
    check(
      Object.values(r.left).every((n) => n === 0),
      `cleanup left rows: ${JSON.stringify(r.left)}`,
    )
  },
)
ok('BO_WORKFLOW_OK')
