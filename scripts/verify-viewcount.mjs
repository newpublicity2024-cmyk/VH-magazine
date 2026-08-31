/**
 * G29 — the view counter increments once per reader, not per render.
 *
 * Driven through a real browser so the sessionStorage dedupe is genuinely
 * exercised: a fetch-based test would bypass the client guard entirely and
 * prove nothing about the behaviour readers actually get.
 */
import { withPage } from './lib/browser.mjs'
import { assert, assertEqual, ok, pgClient } from './lib/harness.mjs'

const PATH = '/moteur/vh-moteur/porsche-licone-sous-pression/'

const readCount = async () => {
  const c = await pgClient()
  const { rows } = await c.query(
    `select view_count from articles where slug = 'porsche-licone-sous-pression'`,
  )
  await c.end()
  assert(rows.length === 1, 'the control article is missing — run `pnpm seed`')
  return Number(rows[0].view_count ?? 0)
}

const before = await readCount()

await withPage(async ({ page, baseUrl }) => {
  // First view: must increment exactly once.
  await page.goto(`${baseUrl}${PATH}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const afterFirst = await readCount()
  assertEqual(afterFirst, before + 1, 'a first view must increment the count by exactly 1')

  // Reload in the SAME session: sessionStorage must suppress it.
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const afterReload = await readCount()
  assertEqual(
    afterReload,
    afterFirst,
    'a reload in the same session must NOT increment again — the sessionStorage dedupe is not working',
  )

  // A different session (fresh context) is a different reader and does count,
  // but the server throttle also applies per IP+article, so the honest
  // assertion is that the count never DECREASES and never double-counts a reload.
  console.error(`  view count ${before} -> ${afterFirst} on first view, unchanged on reload`)
})

// The endpoint itself must reject nonsense rather than incrementing blindly.
await withPage(async ({ page, baseUrl }) => {
  // Must be on the origin before evaluating fetch — about:blank cannot issue
  // an http request and throws "Failed to fetch".
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })

  const bad = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articleId: 'not-a-number' }),
    })
    return res.status
  }, baseUrl)
  assertEqual(bad, 400, 'POST /api/view with a non-numeric id must be rejected')

  const missing = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articleId: 99999999 }),
    })
    return res.status
  }, baseUrl)
  assert([404, 200].includes(missing), `POST /api/view for a missing article returned ${missing}`)
})

ok('VIEWCOUNT_OK')
