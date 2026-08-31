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
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import { withServer, assert, assertEqual, ok, fail, pgClient, ROOT } from './lib/harness.mjs'

const stamp = Date.now()
const slugA = `g35-a-${stamp}`
const slugB = `g35-b-${stamp}`

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
// B -> A  (back to the original; the A redirect must now be gone)
await p.update({ collection: 'articles', id: doc.id, data: { slug: '${slugA}' } })

const redirects = (await p.find({ collection: 'redirects', where: { from: { like: '%g35-%' } }, limit: 50 })).docs
  .map((r) => ({ from: r.from, to: r.to }))
console.log(JSON.stringify({ id: doc.id, redirects }))
process.exit(0)
`

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
  try { unlinkSync(dp) } catch { /* gone */ }
}

const line = (result.stdout || '').trim().split('\n').filter((l) => l.trim().startsWith('{')).pop()
if (!line) {
  console.error(result.stdout?.slice(-1500))
  console.error(result.stderr?.slice(-1500))
  fail('the rename driver produced no JSON summary')
}
const { id, redirects } = JSON.parse(line)

const urlA = `/moteur/vh-moteur/${slugA}/`
const urlB = `/moteur/vh-moteur/${slugB}/`

const cleanup = async () => {
  const c = await pgClient()
  await c.query(`delete from redirects where "from" like '%g35-%'`)
  await c.query('delete from articles where id = $1', [id])
  await c.query('delete from _articles_v where parent_id = $1', [id])
  await c.end()
}

try {
  // The article's CURRENT url must not be a redirect source.
  const selfPointing = redirects.filter((r) => r.from === urlA)
  assertEqual(
    selfPointing.length,
    0,
    `the reused URL ${urlA} is still a redirect source (${JSON.stringify(selfPointing)}) — a reader would bounce`,
  )

  // No redirect may point at itself, whatever its source.
  const loops = redirects.filter((r) => r.from === r.to)
  assertEqual(loops.length, 0, `self-referencing redirect(s): ${JSON.stringify(loops)}`)

  // The vacated URL B should redirect back to A.
  const fromB = redirects.find((r) => r.from === urlB)
  assert(fromB, `no redirect from the vacated URL ${urlB}. Measured: ${JSON.stringify(redirects)}`)
  assertEqual(fromB.to, urlA, `redirect target for the vacated ${urlB}`)

  await withServer(async (baseUrl) => {
    const raw = async (p) => {
      const res = await fetch(`${baseUrl}${p}`, { redirect: 'manual' })
      return { status: res.status, location: res.headers.get('location') }
    }

    // The reused URL must RESOLVE, not redirect.
    const a = await raw(urlA)
    assertEqual(a.status, 200, `the reused URL ${urlA} must resolve with 200, measured ${a.status} -> ${a.location}`)

    // The vacated one redirects to it, and terminates there.
    const b = await raw(urlB)
    assert([301, 308].includes(b.status), `${urlB} must redirect, measured ${b.status}`)
    assertEqual(new URL(b.location, baseUrl).pathname, urlA, `redirect target for ${urlB}`)
  })

  console.error(`  ${urlA} resolves 200 after A->B->A; ${urlB} -> ${urlA}; no self-redirect`)
} finally {
  await cleanup()
}

ok('RENAMECYCLE_OK')
