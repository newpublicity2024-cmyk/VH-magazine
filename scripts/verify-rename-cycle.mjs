/**
 * G35 — the A -> B -> A rename cycle (deferred item D3).
 *
 * G19 covers A -> B -> C (chain flattening). This covers the case where an
 * editor renames an article and then changes their mind: the original URL is
 * live again, so it must RESOLVE, not redirect — and above all must not
 * redirect to itself, which would bounce the reader forever.
 *
 * The hook is expected to handle this by deleting any redirect whose source is
 * the article's current URL. That behaviour existed but was never gate-covered,
 * which is why D3 was recorded.
 *
 * The run writes a throwaway article into vh_magazine and must leave nothing behind,
 * on every path (G43 proves the failure paths): checks throw rather than exit,
 * withCleanup always deletes the run's rows, and each run first sweeps rows an
 * interrupted earlier run left.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import {
  withServer,
  withCleanup,
  check,
  checkEqual,
  assert,
  injectedFailure,
  deleteGateRows,
  GateFailure,
  ok,
  pgClient,
  ROOT,
} from './lib/harness.mjs'

const stamp = Date.now()
const slugA = `g35-a-${stamp}`
const slugB = `g35-b-${stamp}`
const urlA = `/moteur/vh-moteur/${slugA}/`
const urlB = `/moteur/vh-moteur/${slugB}/`

const ours = { slug: `^g35-[ab]-${stamp}$`, path: `/g35-[ab]-${stamp}/$` }
const anyRun = { slug: '^g35-[ab]-[0-9]+$', path: '/g35-[ab]-[0-9]+/$' }
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

const driver = `
import 'dotenv/config'
import { getPayload } from 'payload'
import config from './src/payload.config'

const p = await getPayload({ config })
const cat = (await p.find({ collection: 'categories', where: { slug: { equals: 'vh-moteur' } }, limit: 1 })).docs[0]
const media = (await p.find({ collection: 'media', limit: 1 })).docs[0]

const doc = await p.create({ collection: 'articles', data: {
  title: 'G35 rename cycle ${stamp}',
  slug: '${slugA}',
  category: cat.id,
  featuredImage: media.id,
  publishedAt: new Date().toISOString(),
  _status: 'published',
}, context: { skipRedirects: true } })

// A -> B  (should create /…/${slugA}/ -> /…/${slugB}/)
await p.update({ collection: 'articles', id: doc.id, data: { slug: '${slugB}' } })
if (process.env.GATE_INJECT_FAILURE === 'driver') throw new Error('injected failure at "driver" (GATE_INJECT_FAILURE)')
// B -> A  (back to the original; the A redirect must now be gone)
await p.update({ collection: 'articles', id: doc.id, data: { slug: '${slugA}' } })

const redirects = (await p.find({ collection: 'redirects', where: { from: { like: '%g35-%' } }, limit: 50 })).docs
  .map((r) => ({ from: r.from, to: r.to }))
console.log(JSON.stringify({ id: doc.id, redirects }))
process.exit(0)
`

let cleaned
await withCleanup(
  async () => {
    const dp = path.join(ROOT, '.g35-driver.mts')
    writeFileSync(dp, driver, 'utf8')
    let result
    try {
      result = spawnSync('pnpm', ['exec', 'tsx', dp], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
        maxBuffer: 32 * 1024 * 1024,
      })
    } finally {
      try {
        unlinkSync(dp)
      } catch {
        /* gone */
      }
    }

    const line = (result.stdout || '')
      .trim()
      .split('\n')
      .filter((l) => l.trim().startsWith('{'))
      .pop()
    if (!line) {
      throw new GateFailure(
        `the rename driver produced no JSON summary\n${result.stdout?.slice(-1500)}\n${result.stderr?.slice(-1500)}`,
      )
    }
    const { redirects } = JSON.parse(line)

    // The article's CURRENT url must not be a redirect source.
    const selfPointing = redirects.filter((r) => r.from === urlA)
    checkEqual(
      selfPointing.length,
      0,
      `the reused URL ${urlA} is still a redirect source (${JSON.stringify(selfPointing)}) — a reader would bounce`,
    )

    // No redirect may point at itself, whatever its source.
    const loops = redirects.filter((r) => r.from === r.to)
    checkEqual(loops.length, 0, `self-referencing redirect(s): ${JSON.stringify(loops)}`)

    // The vacated URL B should redirect back to A.
    const fromB = redirects.find((r) => r.from === urlB)
    check(fromB, `no redirect from the vacated URL ${urlB}. Measured: ${JSON.stringify(redirects)}`)
    checkEqual(fromB.to, urlA, `redirect target for the vacated ${urlB}`)

    await withServer(async (baseUrl) => {
      const raw = async (p) => {
        const res = await fetch(`${baseUrl}${p}`, { redirect: 'manual' })
        return { status: res.status, location: res.headers.get('location') }
      }

      // The reused URL must RESOLVE, not redirect.
      const a = await raw(urlA)
      checkEqual(
        a.status,
        200,
        `the reused URL ${urlA} must resolve with 200, measured ${a.status} -> ${a.location}`,
      )

      // The vacated one redirects to it, and terminates there.
      const b = await raw(urlB)
      check([301, 308].includes(b.status), `${urlB} must redirect, measured ${b.status}`)
      checkEqual(new URL(b.location, baseUrl).pathname, urlA, `redirect target for ${urlB}`)
    })

    console.error(`  ${urlA} resolves 200 after A->B->A; ${urlB} -> ${urlA}; no self-redirect`)
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
assert(
  cleaned.deleted.articles === 1 &&
    cleaned.deleted.versions >= 1 &&
    cleaned.deleted.redirects === 1,
  `the cleanup found ${JSON.stringify(cleaned.deleted)} — expected the run's 1 article, its versions and 1 redirect`,
)
assert(
  Object.values(cleaned.left).every((n) => n === 0),
  `rows left after cleanup: ${JSON.stringify(cleaned.left)}`,
)
ok('RENAMECYCLE_OK')
