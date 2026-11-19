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
 *
 * The run writes throwaway articles into vh_magazine and must leave nothing behind, on
 * every path (G43 proves the failure paths): checks throw rather than exit, withCleanup
 * always deletes the run's rows, and each run first sweeps rows an interrupted earlier
 * run left. The stamp is made here, not in the driver, so a driver that dies mid-run can
 * still be cleaned up.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import {
  pgClient,
  assert,
  check,
  checkEqual,
  withCleanup,
  injectedFailure,
  deleteGateRows,
  GateFailure,
  ok,
  ROOT,
} from './lib/harness.mjs'

const SELF_TEST = process.argv.includes('--self-test')
const stamp = Date.now()

const ours = { slug: `^g19-(draft-)?[a-c]-${stamp}$`, path: `/g19-(draft-)?[a-c]-${stamp}/$` }
const anyRun = { slug: '^g19-(draft-)?[a-c]-[0-9]+$', path: '/g19-(draft-)?[a-c]-[0-9]+/$' }
const sweep = async (patterns) => {
  const c = await pgClient()
  try {
    return await deleteGateRows(c, patterns)
  } finally {
    await c.end()
  }
}

const stale = await sweep(anyRun)
if (Object.values(stale.deleted).some((n) => n > 0)) {
  console.error(`  removed rows left by an earlier run: ${JSON.stringify(stale.deleted)}`)
}

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
const stamp = ${stamp}

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
if (process.env.GATE_INJECT_FAILURE === 'driver') throw new Error('injected failure at "driver" (GATE_INJECT_FAILURE)')
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

const A = `/moteur/vh-moteur/g19-a-${stamp}/`
const B = `/moteur/vh-moteur/g19-b-${stamp}/`
const C = `/moteur/vh-moteur/g19-c-${stamp}/`
const draftA = `/moteur/vh-moteur/g19-draft-a-${stamp}/`

let cleaned
await withCleanup(
  async () => {
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
      throw new GateFailure(
        `the Payload driver produced no JSON summary\n${result.stdout?.slice(-2000)}\n${result.stderr?.slice(-2000)}`,
      )
    }
    const payloadResult = JSON.parse(lastLine)
    if (payloadResult.error) throw new GateFailure(payloadResult.error)
    const { redirects } = payloadResult
    const byFrom = new Map(redirects.map((r) => [r.from, r]))

    if (SELF_TEST) {
      // With the hook bypassed there must be NO redirects. If the checker would
      // still pass here, it is not measuring the hook at all.
      check(
        !byFrom.has(A),
        'self-test: redirects were created even with the hook bypassed — the bypass is broken',
      )
      console.error('  self-test: hook bypassed → no redirects, as expected')
      console.error('  self-test: the assertions below would have failed. Oracle can fail.')
      return
    }

    // Case 1 + 2: flat set. A→C and B→C, and no A→B chain survives.
    check(
      byFrom.has(A),
      `no redirect from the first URL ${A}. Measured: ${JSON.stringify(redirects)}`,
    )
    check(
      byFrom.has(B),
      `no redirect from the second URL ${B}. Measured: ${JSON.stringify(redirects)}`,
    )

    checkEqual(byFrom.get(A).to, C, `redirect target for ${A} (must be repointed, not chained)`)
    checkEqual(byFrom.get(B).to, C, `redirect target for ${B}`)
    checkEqual(byFrom.get(A).permanent, true, `redirect from ${A} is permanent (301)`)
    checkEqual(byFrom.get(A).source, 'auto', `redirect from ${A} is marked auto-generated`)

    // Exactly two — one per vacated URL, no duplicates.
    const published = redirects.filter((r) => !r.from.includes('draft'))
    checkEqual(published.length, 2, `redirects created by two renames of one published article`)

    // The live URL must never be a redirect source, or the article bounces forever.
    check(!byFrom.has(C), `the current URL ${C} is itself a redirect source — infinite bounce`)

    // Case 3: a draft rename creates nothing.
    const draftRedirects = redirects.filter((r) => r.from.includes('draft'))
    checkEqual(
      draftRedirects.length,
      0,
      `renaming an unpublished article created ${draftRedirects.length} redirect(s): ${JSON.stringify(
        draftRedirects,
      )} (expected none — ${draftA} was never live)`,
    )

    console.error(`  ${A} → ${C}`)
    console.error(`  ${B} → ${C}`)
    console.error('  draft rename → no redirect')
    injectedFailure('assert')
  },
  async () => {
    cleaned = await sweep(ours)
    console.error(
      `  cleanup: deleted ${JSON.stringify(cleaned.deleted)}, left ${JSON.stringify(cleaned.left)}`,
    )
  },
)

// Reached only when the checks and the cleanup both succeeded. The deletions double as a
// control: had the patterns stopped matching what the run creates, they would find nothing.
const wantRedirects = SELF_TEST ? 0 : 2
assert(
  cleaned.deleted.articles === 2 &&
    cleaned.deleted.versions >= 2 &&
    cleaned.deleted.redirects === wantRedirects,
  `the cleanup found ${JSON.stringify(cleaned.deleted)} — expected the run's 2 articles, their versions and ${wantRedirects} redirects`,
)
assert(
  Object.values(cleaned.left).every((n) => n === 0),
  `rows left after cleanup: ${JSON.stringify(cleaned.left)}`,
)
ok(SELF_TEST ? 'SELF_TEST_OK' : 'REDIRECTS_OK')
