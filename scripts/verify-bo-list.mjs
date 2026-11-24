/**
 * BO-G15 — WordPress-style status links over the articles table, counted honestly.
 *
 * « Tous | Mes articles | Publiés | Brouillons | En attente de relecture », each with a count.
 * For an admin AND for a journalist (who may read published articles plus their own):
 *  - each count equals a SQL count over the articles' LATEST versions (what the list view
 *    shows — it queries with `draft: true`), filtered by the viewer's access, written here
 *    from the schema;
 *  - each link, opened, shows a list whose total (Payload's « 1-5 de N ») is that same count —
 *    the number beside a link is the number of rows behind it — and marks itself current.
 * Fixture: the journalist owns two articles, one draft and one submitted for review.
 */
import { withPage } from './lib/browser.mjs'
import {
  browserLogin,
  cleanupGate,
  createUsers,
  fixtureRefs,
  runDriver,
  simpleBody,
  stampFor,
} from './lib/backoffice.mjs'
import { check, checkEqual, ok, pgClient, withCleanup } from './lib/harness.mjs'

const s = stampFor('g74')
await cleanupGate(s.anyRun)

const LATEST = `from _articles_v v join articles a on a.id = v.parent_id where v.latest`
const sqlCounts = async (c, viewer) => {
  const scope =
    viewer.role === 'journalist'
      ? ` and (v.version__status = 'published' or v.version_author_id = ${Number(viewer.id)})`
      : ''
  const one = async (extra) =>
    Number((await c.query(`select count(*) ${LATEST}${scope}${extra}`)).rows[0].count)
  return {
    all: await one(''),
    mine: await one(` and v.version_author_id = ${Number(viewer.id)}`),
    published: await one(` and v.version__status = 'published'`),
    drafts: await one(` and v.version__status = 'draft'`),
    pending: await one(` and v.version__status = 'draft' and v.version_review_state = 'pending'`),
  }
}

async function measure(page, baseUrl, viewer, label) {
  await page.goto(`${baseUrl}/admin/collections/articles/`, { waitUntil: 'load' })
  await page.waitForSelector('[data-status-links]', { timeout: 30_000 })
  const links = await page.$$eval('[data-status-links] a', (els) =>
    els.map((a) => ({
      key: a.getAttribute('data-status'),
      count: Number(a.getAttribute('data-count')),
      href: a.getAttribute('href'),
    })),
  )
  checkEqual(
    links.map((l) => l.key).join(','),
    'all,mine,published,drafts,pending',
    `${label}: status links`,
  )
  const c = await pgClient()
  let expected
  try {
    expected = await sqlCounts(c, viewer)
  } finally {
    await c.end()
  }
  for (const l of links) checkEqual(l.count, expected[l.key], `${label}: « ${l.key} » count vs SQL`)

  for (const l of links) {
    const url = `${baseUrl}${l.href}${l.href.includes('?') ? '&' : '?'}limit=5`
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForSelector('[data-status-links]', { timeout: 30_000 })
    const info =
      (await page
        .locator('.page-controls__page-info')
        .first()
        .textContent()
        .catch(() => null)) ?? ''
    const rows = await page.locator('.table tbody tr').count()
    const total = info ? Number(info.replace(/\s/g, '').match(/(\d+)$/)?.[1] ?? NaN) : rows
    checkEqual(total, l.count, `${label}: rows behind « ${l.key} » (page info "${info.trim()}")`)
    checkEqual(
      await page.getAttribute(`[data-status="${l.key}"]`, 'aria-current'),
      'page',
      `${label}: « ${l.key} » marked current`,
    )
  }
  return Object.fromEntries(links.map((l) => [l.key, l.count]))
}

await withCleanup(
  async () => {
    const u = createUsers(s, ['admin', 'journalist'])
    const { categoryId, mediaIds } = await fixtureRefs(1)
    runDriver(`
const J = await p.findByID({ collection: 'users', id: ${u.journalist.id}, overrideAccess: true })
await p.create({ collection: 'articles', user: J, overrideAccess: false, draft: true, data: { title: ${JSON.stringify(s.title('Brouillon'))} } })
const d = await p.create({ collection: 'articles', user: J, overrideAccess: false, draft: true, data: {
  title: ${JSON.stringify(s.title('Soumis'))}, category: ${categoryId}, featuredImage: ${mediaIds[0]}, body: ${JSON.stringify(simpleBody('Prêt.'))},
} })
await p.update({ collection: 'articles', id: d.id, user: J, overrideAccess: false, draft: true, data: { reviewState: 'pending', _status: 'draft' } })
print({ ok: true })
`)
    await withPage(
      async ({ page, baseUrl, browser, pageErrors }) => {
        await browserLogin(page, baseUrl, u.admin.email)
        const admin = await measure(page, baseUrl, u.admin, 'admin')
        check(
          admin.pending >= 1 && admin.drafts >= 2,
          `admin counts miss the fixtures: ${JSON.stringify(admin)}`,
        )

        const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
        const jp = await ctx.newPage()
        await browserLogin(jp, baseUrl, u.journalist.email)
        const journalist = await measure(jp, baseUrl, u.journalist, 'journalist')
        checkEqual(journalist.mine, 2, 'journalist « Mes articles »')
        checkEqual(journalist.pending, 1, 'journalist « En attente de relecture »')
        check(
          journalist.all < admin.all + 1 && journalist.all === journalist.published + 2,
          `journalist « Tous » should be published + own: ${JSON.stringify(journalist)}`,
        )
        check(!pageErrors.length, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
        console.error(
          `  admin ${JSON.stringify(admin)}; journalist ${JSON.stringify(journalist)} — all = SQL and = rows behind each link`,
        )
      },
      { viewport: { width: 1600, height: 1000 } },
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
ok('BO_LIST_OK')
