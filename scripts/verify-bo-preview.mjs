/**
 * BO-G12 — the draft preview (/apercu/{id}/) shows the right version to the right people.
 *
 * Fixtures: journalist J's never-published draft, and a live article with a newer unpublished
 * draft. Served by `next start`, requested with each user's real session cookie:
 *  - no session → redirected to the admin login, which will bring them back;
 *  - J → 200 with the draft's title and text, `noindex`, exactly one h1, and NO view counter and
 *    NO NewsArticle structured data (positive control: the live article's public page carries
 *    both, measured by the same patterns);
 *  - an editor → 200 with the same draft;
 *  - another journalist → 404;
 *  - the live article's preview shows the unpublished title and links to the live URL.
 */
import {
  apiLogin,
  cleanupGate,
  createUsers,
  fixtureRefs,
  runDriver,
  simpleBody,
  stampFor,
} from './lib/backoffice.mjs'
import { check, checkEqual, ok, stripScripts, withCleanup, withServer } from './lib/harness.mjs'

const s = stampFor('g76')
await cleanupGate(s.anyRun)

const fetchAs = async (url, cookie) => {
  const res = await fetch(url, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} })
  return { status: res.status, location: res.headers.get('location') ?? '', html: await res.text() }
}
const viewCounterFor = (html, id) => new RegExp(`\\\\?"articleId\\\\?":${id}\\b`).test(html)
const hasNewsArticle = (html) =>
  /"@type":"NewsArticle"/.test(html) || /\\"@type\\":\\"NewsArticle\\"/.test(html)

await withCleanup(
  async () => {
    const u = createUsers(s, ['journalist', 'journalist2', 'editor'])
    const { categoryId, mediaIds } = await fixtureRefs(1)
    const draftTitle = `G76 Brouillon secret ${s.ms}`
    const liveSlug = s.slug('en-ligne')
    const liveTitle = `G76 Titre en ligne ${s.ms}`
    const editTitle = `G76 Titre retouché ${s.ms}`
    const ids = runDriver(`
const J = await p.findByID({ collection: 'users', id: ${u.journalist.id}, overrideAccess: true })
const d = await p.create({ collection: 'articles', user: J, overrideAccess: false, draft: true, data: {
  title: ${JSON.stringify(draftTitle)}, category: ${categoryId}, featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(simpleBody(`zzdraftbody ${s.ms}`))},
} })
const live = await p.create({ collection: 'articles', overrideAccess: true, context: { skipRedirects: true }, data: {
  title: ${JSON.stringify(liveTitle)}, slug: ${JSON.stringify(liveSlug)}, category: ${categoryId}, featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(simpleBody('Texte public.'))}, author: ${u.journalist.id}, _status: 'published',
} })
await p.update({ collection: 'articles', id: live.id, overrideAccess: true, draft: true, data: { title: ${JSON.stringify(editTitle)}, slug: ${JSON.stringify(liveSlug)}, _status: 'draft' } })
print({ draft: d.id, live: live.id })
`)

    await withServer(async (base) => {
      const draftUrl = `${base}/apercu/${ids.draft}/`
      const anon = await fetchAs(draftUrl)
      check(
        [302, 303, 307, 308].includes(anon.status),
        `anonymous preview answered ${anon.status}, expected a redirect`,
      )
      check(
        /\/admin\/login\/?\?redirect=/.test(anon.location) &&
          anon.location.includes(encodeURIComponent(`/apercu/${ids.draft}/`)),
        `anonymous preview redirect: ${anon.location}`,
      )

      const J = await apiLogin(base, u.journalist.email)
      const K = await apiLogin(base, u.journalist2.email)
      const E = await apiLogin(base, u.editor.email)

      const mine = await fetchAs(draftUrl, J)
      checkEqual(mine.status, 200, "author's preview status")
      const dom = stripScripts(mine.html)
      check(
        dom.includes(draftTitle) && dom.includes(`zzdraftbody ${s.ms}`),
        'preview lacks the draft title or text',
      )
      checkEqual((dom.match(/<h1\b/g) ?? []).length, 1, 'h1 count in the preview')
      check(
        /<meta name="robots" content="noindex, nofollow/.test(mine.html),
        'preview is not noindex',
      )
      check(dom.includes('data-preview-banner'), 'preview banner missing')
      check(!viewCounterFor(mine.html, ids.draft), 'the preview mounts the view counter')
      check(!hasNewsArticle(mine.html), 'the preview emits NewsArticle structured data')

      const editor = await fetchAs(draftUrl, E)
      checkEqual(editor.status, 200, "editor's preview status")
      check(
        stripScripts(editor.html).includes(draftTitle),
        "editor's preview lacks the draft title",
      )

      const other = await fetchAs(draftUrl, K)
      checkEqual(other.status, 404, "another journalist's preview status")
      check(
        !other.html.includes(draftTitle),
        "another journalist's response contains the draft title",
      )

      const livePreview = await fetchAs(`${base}/apercu/${ids.live}/`, J)
      checkEqual(livePreview.status, 200, 'live article preview status')
      const liveDom = stripScripts(livePreview.html)
      check(liveDom.includes(editTitle), 'live article preview does not show the unpublished edit')
      check(
        liveDom.includes(`href="/moteur/vh-moteur/${liveSlug}/"`),
        'live article preview does not link the live URL',
      )

      // Positive control for the two absence checks: the public page has both.
      const publicPage = await fetchAs(`${base}/moteur/vh-moteur/${liveSlug}/`)
      checkEqual(publicPage.status, 200, 'public page status (control)')
      check(
        viewCounterFor(publicPage.html, ids.live),
        'control failed: the view-counter detector does not see the public page counter',
      )
      check(
        hasNewsArticle(publicPage.html),
        'control failed: the NewsArticle detector does not see the public page data',
      )
      check(
        stripScripts(publicPage.html).includes(liveTitle) && !publicPage.html.includes(editTitle),
        'the unpublished edit leaked to the public page',
      )
      console.error(
        `  anon -> ${anon.status} login; author 200 (noindex, no counter, no JSON-LD); editor 200; other journalist 404; live preview shows edit + live link`,
      )
    })
  },
  async () => {
    const r = await cleanupGate(s.patterns)
    check(
      Object.values(r.left).every((n) => n === 0),
      `cleanup left rows: ${JSON.stringify(r.left)}`,
    )
  },
)
ok('BO_PREVIEW_OK')
