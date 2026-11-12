/**
 * G42 — an editor can open an article in the admin and its body editor renders.
 *
 * G17 proves the admin shell answers and a user can authenticate, but nothing had ever
 * opened a document. The admin's import map (src/app/(payload)/admin/importMap.js) was
 * committed empty, so every rich-text feature's client component — the editor itself —
 * was missing: the Articles body field rendered nothing. Regenerating the map
 * (`pnpm generate:importmap`) fixed it; this gate keeps it fixed, and covers any future
 * editor feature added without regenerating the map.
 *
 * Measured in a real browser: log in through the form, read a seeded article's opening
 * words through the REST API, open that article's edit view, and require the Lexical
 * editor to be on the page and to contain those words.
 */
import { withPage } from './lib/browser.mjs'
import { fail, ok, loadEnv } from './lib/harness.mjs'

// Throw (never exit) inside the browser callback, so withPage/withServer's finally blocks
// close chromium and kill the server; harness `assert` would process.exit past them.
const check = (cond, message) => {
  if (!cond) throw new Error(message)
}

const env = loadEnv()
const email = env.SEED_ADMIN_EMAIL || 'admin@vh.ma'
const password = env.SEED_ADMIN_PASSWORD || 'vhmagazine'

/** First run of text in a Lexical document, at least a few words long. */
function openingWords(root) {
  const texts = []
  ;(function walk(n) {
    if (!n) return
    if (n.type === 'text' && n.text) texts.push(n.text)
    for (const c of n.children ?? []) walk(c)
  })(root)
  const first = texts.join(' ').replace(/\s+/g, ' ').trim()
  return first.split(' ').slice(0, 5).join(' ')
}

try {
  await withPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'load' })
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 }),
      page.click('button[type="submit"]'),
    ])

    // The page's cookie authenticates the API call too.
    const res = await page.request.get(`${baseUrl}/api/articles/?limit=50&depth=0`)
    check(res.ok(), `GET /api/articles answered ${res.status()} after login`)
    const { docs } = await res.json()
    const article = docs.find((d) => openingWords(d.body?.root).split(' ').length >= 3)
    check(article, 'no seeded article with a body of at least three words')
    const words = openingWords(article.body.root)

    await page.goto(`${baseUrl}/admin/collections/articles/${article.id}`, { waitUntil: 'load' })
    const editor = page.locator('[data-lexical-editor="true"]').first()
    try {
      await editor.waitFor({ state: 'visible', timeout: 30_000 })
    } catch {
      throw new Error(
        `the Articles body editor did not render for article ${article.id} — is the admin import map ` +
          'missing the rich-text components? Run `pnpm generate:importmap`.' +
          (pageErrors.length ? ` Page errors: ${pageErrors.slice(0, 3).join(' | ')}` : ''),
      )
    }
    const shown = (await editor.innerText()).replace(/\s+/g, ' ')
    check(
      shown.includes(words),
      `the body editor rendered but does not show the article's opening words "${words}"`,
    )
    check(
      !pageErrors.length,
      `the edit view raised page errors: ${pageErrors.slice(0, 3).join(' | ')}`,
    )
  })
} catch (error) {
  fail(error.message)
}

ok('ADMIN_EDITOR_OK')
