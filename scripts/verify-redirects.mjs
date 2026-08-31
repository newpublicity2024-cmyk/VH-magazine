/**
 * G19 — the article rename hook (amendment A3).
 *
 * Three behaviours, exercised against a throwaway article through the Local API
 * so the hook runs exactly as it would for an editor in the admin:
 *
 *   1. Renaming a PUBLISHED article creates exactly one redirect old → new.
 *   2. Renaming AGAIN repoints the first redirect instead of chaining, so the
 *      set stays flat (A→C and B→C, never A→B→C).
 *   3. Renaming a DRAFT article creates nothing — a draft has no URL in the wild.
 *
 * Negative control (proves the oracle can fail):
 *   node scripts/verify-redirects.mjs --self-test
 * runs case 1 with the hook bypassed and asserts the checker rejects it.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import { pgClient, assert, assertEqual, ok, fail, ROOT } from './lib/harness.mjs'

const SELF_TEST = process.argv.includes('--self-test')

// Driving Payload needs its TS config loaded, so the actual mutations run in a
// tsx child process which prints a JSON summary. This script owns the assertions.
const driver = `
// The driver runs as its own process, so it must load .env itself — payload.config
// reads PAYLOAD_SECRET and DATABASE_URL at import time.
import 'dotenv/config'
import { getPayload } from 'payload'
import config from './src/payload.config.ts'

const payload = await getPayload({ config })
const bypass = ${SELF_TEST}
const stamp = Date.now()

const category = (await payload.find({
  collection: 'categories',
  where: { slug: { equals: 'vh-moteur' } },
  limit: 1,
})).docs[0]
if (!category) { console.log(JSON.stringify({ error: 'category vh-moteur not seeded' })); process.exit(0) }

const media = (await payload.find({ collection: 'media', limit: 1 })).docs[0]
if (!media) { console.log(JSON.stringify({ error: 'no media seeded' })); process.exit(0) }

const base = {
  title: 'Gate G19 ' + stamp,
  category: category.id,
  featuredImage: media.id,
  publishedAt: new Date().toISOString(),
}

const created = []
const mk = async (slug, status) => {
  const doc = await payload.create({
    collection: 'articles',
    data: { ...base, slug, _status: status },
    // The self-test bypasses the hook to prove the checker rejects a world in
    // which the hook does nothing.
    context: bypass ? { skipRedirects: true } : {},
  })
  created.push(doc.id)
  return doc
}
const rename = async (id, slug) =>
  payload.update({
    collection: 'articles',
    id,
    data: { slug },
    context: bypass ? { skipRedirects: true } : {},
  })

// Case 1 + 2: published article, renamed twice.
const pub = await mk('g19-a-' + stamp, 'published')
await rename(pub.id, 'g19-b-' + stamp)
await rename(pub.id, 'g19-c-' + stamp)

// Case 3: draft article, renamed.
const draft = await mk('g19-draft-a-' + stamp, 'draft')
await rename(draft.id, 'g19-draft-b-' + stamp)

const redirects = (await payload.find({
  collection: 'redirects',
  where: { from: { like: '%g19-%' } },
  limit: 100,
})).docs.map((r) => ({ from: r.from, to: r.to, permanent: r.permanent, source: r.source }))

console.log(JSON.stringify({ stamp, redirects, articleIds: created }))
process.exit(0)
`

// Written to a real file rather than passed via `tsx --eval`: --eval does not
// reliably resolve relative TS imports or the tsconfig `paths` aliases, and the
// driver imports payload.config.ts by relative path.
const driverPath = path.join(ROOT, '.g19-driver.mts')
writeFileSync(driverPath, driver, 'utf8')

let result
try {
  result = spawnSync('pnpm', ['exec', 'tsx', driverPath], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
    maxBuffer: 32 * 1024 * 1024,
  })
} finally {
  try {
    unlinkSync(driverPath)
  } catch {
    /* already gone */
  }
}

const lastLine = (result.stdout || '')
  .trim()
  .split('\n')
  .filter((l) => l.trim().startsWith('{'))
  .pop()

if (!lastLine) {
  console.error(result.stdout?.slice(-2000))
  console.error(result.stderr?.slice(-2000))
  fail('the Payload driver produced no JSON summary')
}

const payloadResult = JSON.parse(lastLine)
if (payloadResult.error) fail(payloadResult.error)

const { stamp, redirects, articleIds } = payloadResult

const A = `/moteur/vh-moteur/g19-a-${stamp}/`
const B = `/moteur/vh-moteur/g19-b-${stamp}/`
const C = `/moteur/vh-moteur/g19-c-${stamp}/`
const draftA = `/moteur/vh-moteur/g19-draft-a-${stamp}/`

/** Always clean up, whatever the assertions do. */
const cleanup = async () => {
  const client = await pgClient()
  await client.query(`delete from redirects where "from" like $1`, [`%g19-%${stamp}%`])
  if (articleIds?.length) {
    await client.query(`delete from articles where id = any($1::int[])`, [articleIds])
    await client.query(`delete from _articles_v where parent_id = any($1::int[])`, [articleIds])
  }
  await client.end()
}

try {
  const byFrom = new Map(redirects.map((r) => [r.from, r]))

  if (SELF_TEST) {
    // With the hook bypassed there must be NO redirects. If the checker would
    // still pass here, it is not measuring the hook at all.
    if (byFrom.has(A)) {
      await cleanup()
      fail('self-test: redirects were created even with the hook bypassed — the bypass is broken')
    }
    console.error('  self-test: hook bypassed → no redirects, as expected')
    console.error('  self-test: the assertions below would have failed. Oracle can fail.')
    await cleanup()
    ok('SELF_TEST_OK')
    process.exit(0)
  }

  // Case 1 + 2: flat set. A→C and B→C, and no A→B chain survives.
  assert(byFrom.has(A), `no redirect from the first URL ${A}. Measured: ${JSON.stringify(redirects)}`)
  assert(byFrom.has(B), `no redirect from the second URL ${B}. Measured: ${JSON.stringify(redirects)}`)

  assertEqual(byFrom.get(A).to, C, `redirect target for ${A} (must be repointed, not chained)`)
  assertEqual(byFrom.get(B).to, C, `redirect target for ${B}`)
  assertEqual(byFrom.get(A).permanent, true, `redirect from ${A} is permanent (301)`)
  assertEqual(byFrom.get(A).source, 'auto', `redirect from ${A} is marked auto-generated`)

  // Exactly two — one per vacated URL, no duplicates.
  const published = redirects.filter((r) => !r.from.includes('draft'))
  assertEqual(published.length, 2, `redirects created by two renames of one published article`)

  // The live URL must never be a redirect source, or the article bounces forever.
  assert(!byFrom.has(C), `the current URL ${C} is itself a redirect source — infinite bounce`)

  // Case 3: a draft rename creates nothing.
  const draftRedirects = redirects.filter((r) => r.from.includes('draft'))
  assertEqual(
    draftRedirects.length,
    0,
    `renaming an unpublished article created ${draftRedirects.length} redirect(s): ${JSON.stringify(
      draftRedirects,
    )} (expected none — ${draftA} was never live)`,
  )

  console.error(`  ${A} → ${C}`)
  console.error(`  ${B} → ${C}`)
  console.error('  draft rename → no redirect')
} finally {
  await cleanup()
}

ok('REDIRECTS_OK')
