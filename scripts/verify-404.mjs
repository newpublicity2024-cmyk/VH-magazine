/**
 * G37 — unknown paths 404.
 *
 * The control matters more than the assertion: a site that 404s everything
 * would pass "unknown paths 404" trivially, so a known path must return 200 in
 * the same run.
 */
import { withServer, getHtml, assertEqual, ok } from './lib/harness.mjs'

const UNKNOWN = [
  '/this-path-does-not-exist-at-all/',
  '/category/no-such-category-9182/',
  '/sommaire/no-such-issue-9182/',
  '/moteur/vh-moteur/no-such-article-9182/',
]

const KNOWN = ['/', '/category/moteur/', '/vh-tv/', '/contact/']

await withServer(async (baseUrl) => {
  for (const path of UNKNOWN) {
    const res = await getHtml(`${baseUrl}${path}`)
    assertEqual(res.status, 404, `${path} must return a real 404 status`)
  }
  // Positive control: the checker is not simply seeing 404 everywhere.
  for (const path of KNOWN) {
    const res = await getHtml(`${baseUrl}${path}`)
    assertEqual(res.status, 200, `${path} must return 200 (control: proves the 404 check is not blanket)`)
  }
  console.error(`  ${UNKNOWN.length} unknown -> 404, ${KNOWN.length} known -> 200`)
})

ok('NOTFOUND_OK')
