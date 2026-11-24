/**
 * BO-G14 — an admin's dashboard reaches and measures every part of the site.
 *
 * Fixture: a journalist's complete article submitted for review (so the queue is not empty).
 * A throwaway admin logs in through the form, then:
 *  - the dashboard holds every admin widget, and the « Gérer le site » panel holds a door to
 *    each of the 10 collections and 2 globals;
 *  - EVERY link inside the widgets is requested with the admin's session and answers 200 (a
 *    gate that checks a link's text has not checked the link — G12/G40 lesson);
 *  - the nav lists all 10 collections and 2 globals;
 *  - every number shown equals a count measured independently in SQL — the stats row, each
 *    panel door, the 30-day chart total and the top « plus lus » figure. The SQL below is written
 *    from the schema, not from the widgets' code (Casablanca days by Postgres' own time zones);
 *  - the admin's article screen keeps slug, SEO, author, date, views and « Publier ».
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

const s = stampFor('g79')
await cleanupGate(s.anyRun)
const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

const SQL = {
  live: `select count(*) from articles where _status = 'published'`,
  today: `select count(*) from articles where _status = 'published'
            and published_at >= (date_trunc('day', now() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca')`,
  week: `select count(*) from articles where _status = 'published'
            and published_at >= ((date_trunc('day', now() at time zone 'Africa/Casablanca') - interval '6 days') at time zone 'Africa/Casablanca')`,
  month: `select count(*) from articles where _status = 'published'
            and published_at >= ((date_trunc('day', now() at time zone 'Africa/Casablanca') - interval '29 days') at time zone 'Africa/Casablanca')`,
  pending: `select count(*) from _articles_v v join articles a on a.id = v.parent_id
             where v.latest and v.version__status = 'draft' and v.version_review_state = 'pending'`,
  drafts: `select count(*) from _articles_v v join articles a on a.id = v.parent_id
             where v.latest and v.version__status = 'draft'
               and (v.version_review_state is distinct from 'pending')
               and v.version_title is not null and v.version_title <> ''`,
  topViews: `select coalesce(max(view_count), 0) as count from articles where _status = 'published' and view_count > 0`,
}
const PARTS = {
  articles: 'articles',
  media: 'media',
  'magazine-issues': 'magazine_issues',
  categories: 'categories',
  tags: 'tags',
  authors: 'authors', // Signatures (parity pass, 2026-11-24)
  banners: 'banners',
  'contact-messages': 'contact_messages',
  'newsletter-subscribers': 'newsletter_subscribers',
  redirects: 'redirects',
  users: 'users',
}

await withCleanup(
  async () => {
    const u = createUsers(s, ['admin', 'journalist'])
    const { categoryId, mediaIds } = await fixtureRefs(1)
    runDriver(`
const J = await p.findByID({ collection: 'users', id: ${u.journalist.id}, overrideAccess: true })
const d = await p.create({ collection: 'articles', user: J, overrideAccess: false, draft: true, data: {
  title: ${JSON.stringify(s.title('À relire'))}, category: ${categoryId}, featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(simpleBody('Prêt pour la relecture.'))},
} })
await p.update({ collection: 'articles', id: d.id, user: J, overrideAccess: false, draft: true, data: { reviewState: 'pending', _status: 'draft' } })
// Published just now, so « today », « 7 days » and the chart have something to count: a tile
// that matches SQL at 0 = 0 proves nothing about counting.
await p.create({ collection: 'articles', overrideAccess: true, context: { skipRedirects: true }, data: {
  title: ${JSON.stringify(s.title('Publié maintenant'))}, category: ${categoryId}, featuredImage: ${mediaIds[0]},
  body: ${JSON.stringify(simpleBody('En ligne aujourd’hui.'))}, _status: 'published',
} })
print({ id: d.id })
`)

    await withPage(
      async ({ page, baseUrl, pageErrors }) => {
        await browserLogin(page, baseUrl, u.admin.email)
        await page.waitForSelector('[data-widget="vh-site"]', { timeout: 30_000 })

        const widgets = await page.$$eval('[data-widget]', (els) =>
          els.map((e) => e.getAttribute('data-widget')),
        )
        const expected = [
          'vh-welcome',
          'vh-stats',
          'vh-review',
          'vh-activity',
          'vh-site',
          'vh-published',
          'vh-popular',
          'vh-drafts',
          'vh-readers',
        ]
        check(
          sameSet(widgets, expected),
          `admin widgets ${JSON.stringify(widgets)}, expected ${JSON.stringify(expected)}`,
        )

        const parts = await page.$$eval('[data-part]', (els) =>
          els.map((e) => [
            e.getAttribute('data-part'),
            e.getAttribute('data-count'),
            e.getAttribute('href'),
          ]),
        )
        const partKeys = parts.map((p) => p[0])
        const expectedParts = [...Object.keys(PARTS), 'homepage', 'grand-angle', 'site-settings']
        check(
          sameSet(partKeys, expectedParts),
          `site panel doors ${JSON.stringify(partKeys)}, expected ${JSON.stringify(expectedParts)}`,
        )

        const nav = await page.$$eval('.nav .nav__link', (els) => els.map((e) => e.id))
        const expectedNav = [
          ...Object.keys(PARTS).map((k) => `nav-${k}`),
          'nav-global-homepage',
          'nav-global-grand-angle',
          'nav-global-site-settings',
        ]
        check(
          sameSet(nav, expectedNav),
          `admin nav ${JSON.stringify(nav)}, expected ${JSON.stringify(expectedNav)}`,
        )

        const stats = Object.fromEntries(
          await page.$$eval('[data-stat]', (els) =>
            els.map((e) => [e.getAttribute('data-stat'), Number(e.getAttribute('data-value'))]),
          ),
        )
        const chartTotal = Number(await page.getAttribute('.vhb-chart__summary', 'data-total'))
        const topViews = Number(
          await page.getAttribute('.vhb-meter', 'data-views').catch(() => '0'),
        )
        const queueRows = await page.locator('[data-widget="vh-review"] .vhb-row').count()

        const c = await pgClient()
        try {
          const one = async (sql) => Number((await c.query(sql)).rows[0].count)
          for (const key of ['pending', 'drafts', 'today', 'week', 'live']) {
            checkEqual(stats[key], await one(SQL[key]), `dashboard « ${key} » tile vs SQL`)
          }
          check(
            stats.today >= 1 && stats.week >= 1 && chartTotal >= 1,
            `counting control: today ${stats.today}, week ${stats.week}, chart ${chartTotal} should include the article published now`,
          )
          check(
            stats.pending >= 1 && queueRows >= 1,
            `the submitted article is not in the queue (tile ${stats.pending}, rows ${queueRows})`,
          )
          checkEqual(
            stats.subscribers,
            await one('select count(*) from newsletter_subscribers'),
            'newsletter subscribers vs SQL',
          )
          checkEqual(chartTotal, await one(SQL.month), '30-day chart total vs SQL')
          checkEqual(topViews, await one(SQL.topViews), '« Les plus lus » top figure vs SQL')
          for (const [key, count] of parts) {
            if (!PARTS[key]) continue
            checkEqual(
              Number(count),
              await one(`select count(*) from ${PARTS[key]}`),
              `site panel « ${key} » count vs SQL`,
            )
          }
        } finally {
          await c.end()
        }

        const hrefs = [
          ...new Set(
            await page.$$eval('[data-widget] a[href]', (els) =>
              els.map((a) => a.getAttribute('href')),
            ),
          ),
        ]
        const internal = hrefs.filter((h) => h.startsWith('/'))
        check(
          internal.length >= 25,
          `only ${internal.length} dashboard links found — selector control`,
        )
        const broken = []
        for (const href of internal) {
          const res = await page.request.get(`${baseUrl}${href}`, { maxRedirects: 5 })
          if (res.status() !== 200) broken.push(`${res.status()} ${href}`)
        }
        check(!broken.length, `dashboard links not answering 200: ${broken.join(', ')}`)

        await page.goto(`${baseUrl}/admin/collections/articles/`, { waitUntil: 'load' })
        const first = await page.getAttribute('.table tbody tr a', 'href')
        await page.goto(`${baseUrl}${first}`, { waitUntil: 'load' })
        await page
          .locator('[data-lexical-editor="true"]')
          .first()
          .waitFor({ state: 'visible', timeout: 30_000 })
        for (const sel of [
          '#field-slug',
          '#field-seo',
          '#field-author',
          '#field-publishedAt',
          '#field-viewCount',
          '#field-reviewState',
          '#action-save',
          '[data-publishbox]',
        ]) {
          check((await page.locator(sel).count()) > 0, `admin article screen lacks ${sel}`)
        }
        checkEqual(
          await page.locator('#action-submit-review').count(),
          0,
          'review button on the admin screen',
        )
        checkEqual(
          await page.locator('[data-writer-guide]').count(),
          0,
          "journalist guide on the admin's screen",
        )
        check(!pageErrors.length, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
        console.error(
          `  admin: 9 widgets, 12 doors, 12 nav items, ${internal.length} links all 200, stats ${JSON.stringify(stats)} = SQL, chart ${chartTotal} = SQL`,
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
ok('BO_ADMIN_UI_OK')
