/**
 * BO-G8 — the role model holds at the API, not just in the admin screens.
 *
 * Three throwaway users (journalists A and B, editor E) act through Payload's Local API with
 * their own access (`overrideAccess: false` — what REST and the admin go through). The driver
 * records what each attempt actually did; this script judges it. A hidden button is not a
 * permission, so every rule the back office shows is tried here directly:
 *
 *  - A's article is A's even when A names E as author; A's « publish » stays a draft;
 *  - B can neither read, edit nor delete A's draft;
 *  - E can publish it; A can then no longer delete it (a public URL is an editorial matter),
 *    while A can delete a draft never published;
 *  - A cannot change the homepage, the site settings, a banner, a rubric, or their own role.
 */
import {
  cleanupGate,
  createUsers,
  fixtureRefs,
  runDriver,
  simpleBody,
  stampFor,
} from './lib/backoffice.mjs'
import { check, checkEqual, ok, withCleanup } from './lib/harness.mjs'

const s = stampFor('g78')
await cleanupGate(s.anyRun)

await withCleanup(
  async () => {
    const u = createUsers(s, ['journalist', 'journalist2', 'editor'])
    const { categoryId, mediaIds } = await fixtureRefs(1)
    const A = u.journalist.id
    const B = u.journalist2.id
    const E = u.editor.id

    const r = runDriver(`
const user = async (id: number) => await p.findByID({ collection: 'users', id, overrideAccess: true })
const A = await user(${A}), B = await user(${B}), E = await user(${E})
const attempt = async (fn: () => Promise<unknown>) => { try { await fn(); return 'ok' } catch (e) { return (e as Error).name || 'Error' } }
const main = async (id: number) => (await p.find({ collection: 'articles', where: { id: { equals: id } }, overrideAccess: true, depth: 0, limit: 1 })).docs[0] as any
const out: Record<string, unknown> = {}

const created = await p.create({ collection: 'articles', user: A, overrideAccess: false, data: {
  title: ${JSON.stringify(s.title('Accès A'))}, slug: ${JSON.stringify(s.slug('acces-a'))},
  category: ${categoryId}, featuredImage: ${mediaIds[0]}, body: ${JSON.stringify(simpleBody('Texte du journaliste.'))},
  author: ${E}, _status: 'published',
} })
let m = await main(created.id as number)
out.createdAuthor = m.author; out.createdStatus = m._status

out.publishAttempt = await attempt(() => p.update({ collection: 'articles', id: created.id, user: A, overrideAccess: false, data: { _status: 'published', title: ${JSON.stringify(s.title('Accès A bis'))} } }))
m = await main(created.id as number)
out.afterPublishAttemptStatus = m._status; out.afterPublishAttemptAuthor = m.author

out.bFind = (await p.find({ collection: 'articles', user: B, overrideAccess: false, draft: true, where: { id: { equals: created.id } } })).totalDocs
out.bFindById = await attempt(() => p.findByID({ collection: 'articles', id: created.id, user: B, overrideAccess: false, draft: true }))
out.bUpdate = await attempt(() => p.update({ collection: 'articles', id: created.id, user: B, overrideAccess: false, draft: true, data: { title: 'pris par B' } }))
out.bDelete = await attempt(() => p.delete({ collection: 'articles', id: created.id, user: B, overrideAccess: false }))
out.existsAfterB = Boolean(await main(created.id as number))

out.ePublish = await attempt(() => p.update({ collection: 'articles', id: created.id, user: E, overrideAccess: false, data: { _status: 'published' }, context: { skipRedirects: true } }))
m = await main(created.id as number)
out.afterEditorStatus = m._status

// Once live, a journalist's writes must stay drafts: no unpublish, no live edit, no live restore.
const liveTitle = m.title
out.aUnpublish = await attempt(() => p.update({ collection: 'articles', id: created.id, user: A, overrideAccess: false, data: { _status: 'draft' } }))
out.aLiveEdit = await attempt(() => p.update({ collection: 'articles', id: created.id, user: A, overrideAccess: false, data: { _status: 'published', title: 'G78 réécrit en ligne' } }))
out.aDraftEdit = await attempt(() => p.update({ collection: 'articles', id: created.id, user: A, overrideAccess: false, draft: true, data: { _status: 'draft', title: 'G78 proposition de correction' } }))
const oldest = (await p.findVersions({ collection: 'articles', where: { parent: { equals: created.id } }, sort: 'createdAt', limit: 1, overrideAccess: true })).docs[0]
out.aRestore = oldest ? await attempt(() => p.restoreVersion({ collection: 'articles', id: oldest.id, user: A, overrideAccess: false })) : 'no-version'
m = await main(created.id as number)
out.afterJournalistOnLive = { status: m._status, title: m.title, expectedTitle: liveTitle }

out.aDeletePublished = await attempt(() => p.delete({ collection: 'articles', id: created.id, user: A, overrideAccess: false }))
out.existsAfterADelete = Boolean(await main(created.id as number))

const draft = await p.create({ collection: 'articles', user: A, overrideAccess: false, draft: true, data: { title: ${JSON.stringify(s.title('Brouillon à jeter'))} } })
out.aDeleteDraft = await attempt(() => p.delete({ collection: 'articles', id: draft.id, user: A, overrideAccess: false }))
out.draftGone = !(await main(draft.id as number))

out.homepage = await attempt(() => p.updateGlobal({ slug: 'homepage', user: A, overrideAccess: false, data: {} }))
out.settings = await attempt(() => p.updateGlobal({ slug: 'site-settings', user: A, overrideAccess: false, data: {} }))
const banner = (await p.find({ collection: 'banners', limit: 1, overrideAccess: true })).docs[0] as any
out.banner = banner ? await attempt(() => p.update({ collection: 'banners', id: banner.id, user: A, overrideAccess: false, data: {} })) : 'no-banner'
out.category = await attempt(() => p.create({ collection: 'categories', user: A, overrideAccess: false, data: { name: 'G78 rubrique', slug: ${JSON.stringify(s.slug('rubrique'))} } }))
out.roleAttempt = await attempt(() => p.update({ collection: 'users', id: ${A}, user: A, overrideAccess: false, data: { role: 'admin' } }))
out.roleAfter = (await user(${A}) as any).role
// Users.read is isAdminOrSelf: a list query has no id, so a journalist's list is refused outright.
out.aListUsers = await attempt(() => p.find({ collection: 'users', user: A, overrideAccess: false, limit: 50 }))
out.aReadsEditor = await attempt(() => p.findByID({ collection: 'users', id: ${E}, user: A, overrideAccess: false }))
out.aReadsSelf = await attempt(() => p.findByID({ collection: 'users', id: ${A}, user: A, overrideAccess: false }))
out.ids = { article: created.id }
print(out)
`)

    checkEqual(r.createdAuthor, A, "author of a journalist's new article (sent as the editor's id)")
    checkEqual(r.createdStatus, 'draft', 'status of a journalist-created article sent as published')
    check(
      r.publishAttempt === 'ok',
      `journalist save with _status published should succeed as a draft, got ${r.publishAttempt}`,
    )
    checkEqual(r.afterPublishAttemptStatus, 'draft', "status after a journalist's publish attempt")
    checkEqual(r.afterPublishAttemptAuthor, A, 'author after the journalist edit')
    checkEqual(r.bFind, 0, "another journalist finding A's draft")
    check(r.bFindById !== 'ok', `another journalist opened A's draft by id (${r.bFindById})`)
    check(r.bUpdate !== 'ok', `another journalist edited A's draft (${r.bUpdate})`)
    check(r.bDelete !== 'ok', `another journalist deleted A's draft (${r.bDelete})`)
    check(r.existsAfterB, "A's article vanished after B's attempts")
    checkEqual(r.ePublish, 'ok', 'editor publishing the journalist article')
    checkEqual(r.afterEditorStatus, 'published', "status after the editor's publish")
    check(r.aUnpublish !== 'ok', `journalist unpublished a live article (${r.aUnpublish})`)
    check(
      r.aLiveEdit !== 'ok',
      `journalist edited a live article's published version (${r.aLiveEdit})`,
    )
    checkEqual(r.aDraftEdit, 'ok', 'journalist saving a draft edit of their live article')
    check(
      r.aRestore !== 'ok' && r.aRestore !== 'no-version',
      `journalist restored a version onto a live article (${r.aRestore})`,
    )
    checkEqual(
      r.afterJournalistOnLive.status,
      'published',
      'live article status after the journalist attempts',
    )
    checkEqual(
      r.afterJournalistOnLive.title,
      r.afterJournalistOnLive.expectedTitle,
      'live article title after the journalist attempts',
    )
    check(
      r.aDeletePublished !== 'ok',
      `journalist deleted a published article (${r.aDeletePublished})`,
    )
    check(r.existsAfterADelete, 'published article vanished after the journalist delete attempt')
    checkEqual(r.aDeleteDraft, 'ok', 'journalist deleting their own never-published draft')
    check(r.draftGone, 'the deleted draft is still there')
    check(r.homepage !== 'ok', `journalist changed the homepage (${r.homepage})`)
    check(r.settings !== 'ok', `journalist changed the site settings (${r.settings})`)
    check(
      r.banner !== 'ok' && r.banner !== 'no-banner',
      `journalist changed a banner (${r.banner})`,
    )
    check(r.category !== 'ok', `journalist created a rubric (${r.category})`)
    checkEqual(
      r.roleAfter,
      'journalist',
      `journalist role after trying to become admin (attempt: ${r.roleAttempt})`,
    )
    check(r.aListUsers !== 'ok', `a journalist listed the users (${r.aListUsers})`)
    check(r.aReadsEditor !== 'ok', `a journalist read another user's document (${r.aReadsEditor})`)
    checkEqual(r.aReadsSelf, 'ok', 'a journalist reading their own user document')
    console.error(
      `  author forced, publish refused to draft, B blocked (find/read/edit/delete), editor publishes, live row untouchable by A (unpublish/edit/restore refused, draft edit ok), published undeletable by A, own draft deletable, globals/banner/rubric/role locked`,
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
ok('BO_ACCESS_OK')
