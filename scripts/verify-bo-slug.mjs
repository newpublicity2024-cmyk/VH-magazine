/**
 * BO-G10 — slugs survive autosave.
 *
 * With autosave on, « Ajouter » creates an untitled draft at once and every pause in typing is
 * a save. Measured from the database, as the admin produces them (draft saves through the
 * Local API with the writer's own access, carrying back the slug the previous save returned —
 * what the form does with `acceptValues`):
 *
 *  1. Two untitled drafts coexist (the unique slug index admits NULLs, never two '').
 *  2. A never-published draft saved as « G75 Le », then « G75 Le nouveau Range … » ends with
 *     the slug of the FINAL title, not of the first save.
 *  3. A slug an editor types by hand is kept through a later title change.
 *  4. Once published, a title change saved as a draft and then published does not move the URL.
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

const s = stampFor('g75')
await cleanupGate(s.anyRun)

await withCleanup(
  async () => {
    const u = createUsers(s, ['journalist', 'editor'])
    const { categoryId, mediaIds } = await fixtureRefs(1)
    const finalTitle = `G75 Le nouveau Range Rover ${s.ms}`
    const handSlug = s.slug('mon-slug')
    const liveTitle = `G75 En ligne ${s.ms}`

    const r = runDriver(`
const J = await p.findByID({ collection: 'users', id: ${u.journalist.id}, overrideAccess: true })
const E = await p.findByID({ collection: 'users', id: ${u.editor.id}, overrideAccess: true })
const save = async (user: unknown, id: number | string, data: Record<string, unknown>) =>
  (await p.update({ collection: 'articles', id, user: user as never, overrideAccess: false, draft: true, data: { ...data, _status: 'draft' } })) as { slug?: string | null }
const out: Record<string, unknown> = {}

const a = await p.create({ collection: 'articles', user: J, overrideAccess: false, draft: true, data: {} })
const b = await p.create({ collection: 'articles', user: J, overrideAccess: false, draft: true, data: {} })
out.untitled = [a.id, b.id]

let r1 = await save(J, a.id, { title: 'G75 Le' })
let r2 = await save(J, a.id, { title: 'G75 Le nouveau', slug: r1.slug })
let r3 = await save(J, a.id, { title: ${JSON.stringify(finalTitle)}, slug: r2.slug })
out.followIds = a.id
out.followSlugs = [r1.slug, r2.slug, r3.slug]

let h1 = await save(E, b.id, { title: 'G75 Titre provisoire' })
let h2 = await save(E, b.id, { title: 'G75 Titre provisoire', slug: ${JSON.stringify(handSlug)} })
let h3 = await save(E, b.id, { title: 'G75 Un tout autre titre', slug: h2.slug })
out.handSlugs = [h1.slug, h2.slug, h3.slug]
out.handId = b.id

const live = await p.create({ collection: 'articles', user: E, overrideAccess: false, context: { skipRedirects: true }, data: {
  title: ${JSON.stringify(liveTitle)}, category: ${categoryId}, featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(simpleBody('Déjà en ligne.'))}, _status: 'published',
} })
out.liveId = live.id
out.liveSlug = live.slug
const d = await save(E, live.id, { title: 'G75 Titre changé après publication', slug: live.slug })
out.liveDraftSlug = d.slug
const pub = await p.update({ collection: 'articles', id: live.id, user: E, overrideAccess: false, context: { skipRedirects: true }, data: { _status: 'published', title: 'G75 Titre changé après publication', slug: d.slug } })
out.livePublishedSlug = (pub as { slug?: string }).slug
print(out)
`)

    const c = await pgClient()
    try {
      const mainSlugs = (
        await c.query('select id, slug from articles where id = any($1::int[]) order by id', [
          r.untitled,
        ])
      ).rows
      checkEqual(mainSlugs.length, 2, 'untitled drafts stored')
      check(
        mainSlugs.every((row) => row.slug === null),
        `untitled drafts must store a NULL slug, measured ${JSON.stringify(mainSlugs)}`,
      )

      const latest = async (id) =>
        (
          await c.query('select version_slug from _articles_v where parent_id = $1 and latest', [
            id,
          ])
        ).rows[0]?.version_slug
      const expected = finalTitle.toLowerCase().replace(/\s+/g, '-')
      checkEqual(
        await latest(r.followIds),
        expected,
        "never-published draft's slug after three autosaves",
      )
      checkEqual(
        r.followSlugs[0],
        'g75-le',
        'slug after the first, partial save (control: it did start short)',
      )

      checkEqual(await latest(r.handId), handSlug, 'hand-typed slug after a later title change')
      checkEqual(r.handSlugs[0], 'g75-titre-provisoire', 'slug before the hand edit (control)')

      const liveMain = (
        await c.query('select slug, _status from articles where id = $1', [r.liveId])
      ).rows[0]
      checkEqual(
        r.liveDraftSlug,
        r.liveSlug,
        'published article slug after a title change saved as draft',
      )
      checkEqual(
        liveMain.slug,
        r.liveSlug,
        'published article slug after re-publishing with a new title',
      )
      checkEqual(liveMain._status, 'published', 'published article status')
    } finally {
      await c.end()
    }
    console.error(
      `  2 untitled drafts (NULL slugs); draft slug followed the title g75-le -> ${finalTitle.toLowerCase().replace(/\s+/g, '-')}; hand slug kept; live slug fixed`,
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
ok('BO_SLUG_OK')
