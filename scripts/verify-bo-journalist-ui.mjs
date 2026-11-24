/**
 * BO-G13 — a journalist's back office is the simple one, measured in a real browser.
 *
 * A throwaway journalist logs in through the admin form, and:
 *  - the dashboard holds exactly the journalist widgets (welcome with « Bonjour/Bonsoir », numbers,
 *    drafts, in review, published, guide) and none of the editor's;
 *  - the nav holds exactly Articles and Médiathèque;
 *  - the routes to users, settings, homepage, banners and rubrics answer 404 for them;
 *  - « Écrire un article » opens a saved draft (autosave creates it) whose screen has the title,
 *    the body editor, the chapô, the cover image, rubric and keywords, the guide, the « Publier »
 *    box and « Soumettre pour relecture » — and has no Publish button, slug, SEO, author, date,
 *    views, review field or API tab;
 *  - typing a title is saved without pressing anything: the article's latest version in the
 *    database holds it within 15 s, and the checklist ticks « Un titre ».
 */
import { withPage } from './lib/browser.mjs'
import { browserLogin, cleanupGate, createUsers, stampFor } from './lib/backoffice.mjs'
import { check, checkEqual, ok, pgClient, withCleanup } from './lib/harness.mjs'

const s = stampFor('g77')
await cleanupGate(s.anyRun)

const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

await withCleanup(
  async () => {
    const u = createUsers(s, ['journalist'])
    await withPage(
      async ({ page, baseUrl, pageErrors }) => {
        await browserLogin(page, baseUrl, u.journalist.email)
        await page.waitForSelector('[data-widget="vh-welcome"]', { timeout: 30_000 })

        const widgets = await page.$$eval('[data-widget]', (els) =>
          els.map((e) => e.getAttribute('data-widget')),
        )
        const expected = [
          'vh-welcome',
          'vh-stats',
          'vh-drafts',
          'vh-review',
          'vh-published',
          'vh-guide',
        ]
        check(
          sameSet(widgets, expected),
          `journalist widgets ${JSON.stringify(widgets)}, expected ${JSON.stringify(expected)}`,
        )
        const hello = await page.textContent('.vhb-welcome__title')
        check(/^(Bonjour|Bonsoir) /.test(hello?.trim() ?? ''), `welcome heading: ${hello}`)

        const nav = await page.$$eval('.nav .nav__link', (els) => els.map((e) => e.id))
        check(sameSet(nav, ['nav-articles', 'nav-media']), `journalist nav ${JSON.stringify(nav)}`)

        for (const route of [
          'collections/users',
          'globals/site-settings',
          'globals/homepage',
          'collections/banners',
          'collections/categories',
        ]) {
          const res = await page.goto(`${baseUrl}/admin/${route}/`, { waitUntil: 'load' })
          checkEqual(res?.status(), 404, `journalist on /admin/${route}/`)
        }

        await page.goto(`${baseUrl}/admin/`, { waitUntil: 'load' })
        await Promise.all([
          page.waitForURL(/\/admin\/collections\/articles\/\d+\/?$/, { timeout: 60_000 }),
          page.click('.vhb-welcome a[href$="/collections/articles/create"]'),
        ])
        const id = Number(page.url().match(/articles\/(\d+)/)[1])
        await page
          .locator('[data-lexical-editor="true"]')
          .first()
          .waitFor({ state: 'visible', timeout: 30_000 })

        const present = [
          '#field-title',
          '[data-lexical-editor="true"]',
          '#field-excerpt',
          '#field-featuredImage',
          '#field-category',
          '#field-tags',
          '[data-writer-guide]',
          '[data-publishbox]',
          '#action-submit-review',
          '#action-save-draft',
        ]
        for (const sel of present)
          check((await page.locator(sel).count()) > 0, `journalist editor lacks ${sel}`)
        const absent = [
          '#action-save',
          '#field-slug',
          '#field-seo',
          '#field-author',
          '#field-publishedAt',
          '#field-viewCount',
          '#field-reviewState',
        ]
        for (const sel of absent)
          checkEqual(
            await page.locator(sel).count(),
            0,
            `journalist editor elements matching ${sel}`,
          )
        const tabs = await page.$$eval('.doc-tabs a, .doc-tab', (els) =>
          els.map((e) => `${e.getAttribute('href') ?? ''} ${e.textContent?.trim()}`),
        )
        check(tabs.length > 0, 'no document tabs found (selector control)')
        check(
          !tabs.some((t) => /\/api\/?\s|\bAPI\b/.test(t)),
          `an API tab is shown: ${JSON.stringify(tabs)}`,
        )
        checkEqual(
          await page.textContent('#action-submit-review').then((t) => t?.trim()),
          'Soumettre pour relecture',
          'review button label',
        )

        const title = s.title('Autosave')
        await page.fill('#field-title', title)
        const c = await pgClient()
        let saved = null
        try {
          for (let i = 0; i < 30 && saved !== title; i += 1) {
            await new Promise((r) => setTimeout(r, 500))
            saved =
              (
                await c.query(
                  'select version_title from _articles_v where parent_id = $1 and latest',
                  [id],
                )
              ).rows[0]?.version_title ?? null
          }
        } finally {
          await c.end()
        }
        checkEqual(saved, title, 'title in the latest version 15 s after typing (autosave)')
        checkEqual(
          await page.getAttribute('[data-check="title"]', 'data-done'),
          'true',
          'checklist « Un titre » after typing',
        )
        check(!pageErrors.length, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`)
        console.error(
          `  journalist: 6 widgets, nav articles+media, 5 routes 404, editor fields as designed, autosaved title on article ${id}`,
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
ok('BO_JOURNALIST_UI_OK')
