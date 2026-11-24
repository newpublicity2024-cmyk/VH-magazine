/**
 * BO-G21 — a link block no platform can play is refused at both doors to publication, and one
 * block per supported platform goes through both.
 *
 * Payload validates blocks only on a non-draft save, and a journalist only ever saves drafts —
 * so the two doors are different code: an editor's Publish (Payload's field validation, the
 * block's `validate`) and a journalist's « Soumettre pour relecture » (the workflow hook, through
 * `missingForReview` → `unplayableLinks`). Through the Local API with access enforced, as
 * throwaway users:
 *  - each refused link, as the only link block of an otherwise complete article, must make the
 *    editor's publish AND the journalist's submission throw a ValidationError on `body` whose text
 *    carries the editor's instruction (short link, profile, platform list);
 *  - an article holding one block per supported platform must be submitted by the journalist and
 *    published by the editor, its stored blocks holding each link as typed.
 * A plain draft save of a bad link is allowed (autosave must never fail mid-sentence) — asserted,
 * since it is the reason the review door exists. Rows are stamped g80-… and removed.
 */
import { randomBytes } from 'node:crypto'

import { cleanupGate, createUsers, fixtureRefs, runDriver, stampFor } from './lib/backoffice.mjs'
import { check, checkEqual, ok, withCleanup } from './lib/harness.mjs'

const s = stampFor('g80')
await cleanupGate(s.anyRun)
const { categoryId, mediaIds } = await fixtureRefs(1)
const oid = () => randomBytes(12).toString('hex')

const para = (text) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  textFormat: 0,
  children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
})
const link = (url) => ({
  type: 'block',
  format: '',
  version: 2,
  fields: { id: oid(), blockName: '', blockType: 'videoEmbed', url, caption: 'zzlegende' },
})
const bodyWith = (urls) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [para('Texte de l’article zzg80.'), ...urls.map(link)],
  },
})

const refused = [
  ['https://vm.tiktok.com/ZMabcdef/', /raccourci/],
  ['https://www.instagram.com/vh.magazine/', /profil/],
  ['https://www.linkedin.com/posts/vh-magazine-123', /YouTube, Vimeo, Dailymotion, Facebook, Instagram, TikTok ou X/],
  ['https://notyoutube.com/watch?v=dQw4w9WgXcQ', /YouTube, Vimeo/],
]
const accepted = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://vimeo.com/76979871',
  'https://www.dailymotion.com/video/x84sh87',
  'https://www.facebook.com/reel/1409970240554716',
  'https://www.instagram.com/p/B2WMmBohFOg/',
  'https://www.tiktok.com/@bloom_media/video/7218664686135364870',
  'https://x.com/AchrafHakimi/status/2029652402450903499',
]

await withCleanup(
  async () => {
    const u = createUsers(s, ['journalist', 'editor'])
    const complete = (title, urls) => ({
      title,
      category: categoryId,
      featuredImage: mediaIds[0],
      body: bodyWith(urls),
    })
    const cases = refused.map(([url], i) => ({ url, data: complete(s.title(`refus ${i}`), [url]) }))
    const good = complete(s.title('toutes plateformes'), accepted)
    const r = runDriver(`
const journalist = await p.findByID({ collection: 'users', id: ${u.journalist.id}, overrideAccess: true })
const editor = await p.findByID({ collection: 'users', id: ${u.editor.id}, overrideAccess: true })
const failure = (e) => ({ name: e?.name, text: String(e?.message ?? '') + ' ' + JSON.stringify(e?.data ?? null) })
const cases = ${JSON.stringify(cases)}
const out = { refused: [], good: null }
for (const c of cases) {
  const row = { url: c.url }
  // Door 1: an editor publishes.
  try {
    await p.create({ collection: 'articles', overrideAccess: false, user: editor, data: { ...c.data, _status: 'published' } })
    row.publish = { saved: true }
  } catch (e) { row.publish = failure(e) }
  // Door 2: a journalist saves a draft (allowed), then submits it for review.
  try {
    const draft = await p.create({ collection: 'articles', draft: true, overrideAccess: false, user: journalist, data: { ...c.data, _status: 'draft' } })
    row.draftSaved = true
    try {
      await p.update({ collection: 'articles', id: draft.id, draft: true, overrideAccess: false, user: journalist, data: { _status: 'draft', reviewState: 'pending' } })
      row.submit = { saved: true }
    } catch (e) { row.submit = failure(e) }
  } catch (e) { row.draftSaved = false; row.draftError = failure(e) }
  out.refused.push(row)
}
const g = ${JSON.stringify(good)}
const draft = await p.create({ collection: 'articles', draft: true, overrideAccess: false, user: journalist, data: { ...g, _status: 'draft' } })
await p.update({ collection: 'articles', id: draft.id, draft: true, overrideAccess: false, user: journalist, data: { _status: 'draft', reviewState: 'pending' } })
const pending = await p.findByID({ collection: 'articles', id: draft.id, draft: true, overrideAccess: true })
await p.update({ collection: 'articles', id: draft.id, overrideAccess: false, user: editor, data: { _status: 'published' } })
const live = await p.findByID({ collection: 'articles', id: draft.id, overrideAccess: true })
out.good = {
  reviewState: pending.reviewState,
  status: live._status,
  links: (live.body?.root?.children ?? []).filter((n) => n.type === 'block').map((n) => n.fields?.url),
}
print(out)
`)
    for (const [url, why] of refused) {
      const row = r.refused.find((x) => x.url === url)
      check(row, `no result for ${url}`)
      check(!row.publish?.saved, `an editor published a link no platform can play: ${url}`)
      checkEqual(row.publish.name, 'ValidationError', `editor's publish error for ${url}`)
      check(/body/.test(row.publish.text), `publish refusal of ${url} does not name the body: ${row.publish.text.slice(0, 300)}`)
      check(why.test(row.publish.text), `publish refusal of ${url} lacks ${why}: ${row.publish.text.slice(0, 400)}`)
      check(row.draftSaved, `a journalist's draft with a bad link was refused (autosave would fail): ${JSON.stringify(row.draftError)}`)
      check(!row.submit?.saved, `a journalist submitted a link no platform can play: ${url}`)
      checkEqual(row.submit.name, 'ValidationError', `journalist's submission error for ${url}`)
      check(/body/.test(row.submit.text), `submission refusal of ${url} does not name the body: ${row.submit.text.slice(0, 300)}`)
      check(why.test(row.submit.text), `submission refusal of ${url} lacks ${why}: ${row.submit.text.slice(0, 400)}`)
    }
    checkEqual(r.good.reviewState, 'pending', 'the all-platforms article after « Soumettre »')
    checkEqual(r.good.status, 'published', 'the all-platforms article after the editor’s Publish')
    checkEqual(JSON.stringify(r.good.links), JSON.stringify(accepted), 'stored links of the published article')
    console.error(
      `  ${refused.length} unplayable links refused at Publish and at « Soumettre » (drafts kept); ${accepted.length} platforms submitted and published`,
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
ok('BO_EMBED_VALIDATION_OK')
