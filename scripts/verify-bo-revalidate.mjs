/**
 * BO-G11 — a draft save never purges the site cache; publishing still does.
 *
 * With autosave on, a writer saves a draft every couple of seconds. The old afterChange hook
 * purged the whole ISR cache on every save (`revalidatePath('/', 'layout')`), so each autosave
 * would have sent every article back to the database on its next view.
 *
 * Measured through `next start` and the REST API, as the admin's own saves arrive:
 *  1. a published throwaway article's page is warmed until Next answers `x-nextjs-cache: HIT`;
 *  2. the editor saves a DRAFT with a new title (`?draft=true`, what autosave sends) —
 *     the page must still answer HIT, with the old title;
 *  3. positive control: the editor PUBLISHES a third title — the next answer must not be a HIT
 *     of the old entry (MISS or STALE: the purge happened) and the new title must appear.
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

const s = stampFor('g72')
await cleanupGate(s.anyRun)

const get = async (url) => {
  const res = await fetch(url, { redirect: 'manual' })
  return {
    status: res.status,
    cache: res.headers.get('x-nextjs-cache'),
    html: stripScripts(await res.text()),
  }
}

await withCleanup(
  async () => {
    const u = createUsers(s, ['editor'])
    const { categoryId, mediaIds } = await fixtureRefs(1)
    const slug = s.slug('cache')
    const T1 = `G72 Titre publié ${s.ms}`
    const T2 = `G72 Brouillon pas en ligne ${s.ms}`
    const T3 = `G72 Nouveau titre publié ${s.ms}`
    const { id } = runDriver(`
const d = await p.create({ collection: 'articles', overrideAccess: true, context: { skipRedirects: true }, data: {
  title: ${JSON.stringify(T1)}, slug: ${JSON.stringify(slug)}, category: ${categoryId}, featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(simpleBody('Texte en cache.'))}, author: ${u.editor.id}, _status: 'published',
} })
print({ id: d.id })
`)

    await withServer(async (base) => {
      const url = `${base}/moteur/vh-moteur/${slug}/`
      let warm
      for (let i = 0; i < 4; i += 1) {
        warm = await get(url)
        if (warm.cache === 'HIT') break
      }
      checkEqual(warm.status, 200, 'article status while warming')
      checkEqual(warm.cache, 'HIT', 'cache state once warm')
      check(warm.html.includes(T1), 'warm page lacks the published title')

      const cookie = await apiLogin(base, u.editor.email)
      const patch = async (query, data) => {
        const res = await fetch(`${base}/api/articles/${id}${query}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify(data),
        })
        const text = await res.text()
        check(res.ok, `PATCH ${query} answered ${res.status}: ${text.slice(0, 300)}`)
      }

      await patch('?draft=true&depth=0', { title: T2, slug, _status: 'draft' })
      const afterDraft = await get(url)
      checkEqual(afterDraft.cache, 'HIT', 'cache state right after a draft save')
      check(
        afterDraft.html.includes(T1) && !afterDraft.html.includes(T2),
        'the draft title reached the public page',
      )

      await patch('?depth=0', { title: T3, slug, _status: 'published' })
      const afterPublish = await get(url)
      check(
        afterPublish.cache !== 'HIT' || afterPublish.html.includes(T3),
        `publishing did not purge: answered ${afterPublish.cache} with the old page`,
      )
      let fresh = afterPublish
      for (let i = 0; i < 6 && !fresh.html.includes(T3); i += 1) {
        await new Promise((r) => setTimeout(r, 500))
        fresh = await get(url)
      }
      check(fresh.html.includes(T3), 'the published title never reached the page')
      console.error(
        `  warm=HIT; draft save -> ${afterDraft.cache} (old title kept); publish -> ${afterPublish.cache}, new title served`,
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
ok('BO_REVALIDATE_OK')
