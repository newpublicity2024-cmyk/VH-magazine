/**
 * GATES-FINISH F10 — the production demo's seed images are on Blob (upload-seed-media.ts).
 *
 * Every pathname recorded in <migration>/manifests/seed-blob-uploads.jsonl — 47 images × 6
 * renditions, the files the Neon production branch's media rows name — answers 200 from the
 * public store with the byte size recorded at upload. Control: a pathname that was never
 * uploaded answers 404, so a store that answered everything would fail.
 */
import { readFileSync } from 'node:fs'
import { fail, ok } from './lib/harness.mjs'

const MIG = '/Users/mc/work/hostinger-ftp/migration'
const STORE = 'https://uytqkgrnyabwhjzu.public.blob.vercel-storage.com'
const rows = readFileSync(`${MIG}/manifests/seed-blob-uploads.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
if (rows.length !== 282) fail(`${rows.length} recorded uploads, expected 282 (47 × 6)`)
const head = async (p) => {
  const r = await fetch(`${STORE}/${encodeURIComponent(p)}`, { method: 'HEAD' })
  return { status: r.status, size: Number(r.headers.get('content-length')) }
}
const control = await head(`vh-verify-never-uploaded-${Date.now()}.jpg`)
if (control.status !== 404) fail(`control: a never-uploaded pathname answered ${control.status}`)
const problems = []
for (let i = 0; i < rows.length; i += 16) {
  const batch = rows.slice(i, i + 16)
  const res = await Promise.all(batch.map((r) => head(r.pathname)))
  res.forEach((h, j) => {
    if (h.status !== 200 || h.size !== batch[j].size) problems.push(`${batch[j].pathname}: ${h.status}, ${h.size} B (recorded ${batch[j].size})`)
  })
}
if (problems.length) fail(`${problems.length} seed file(s) wrong: ${problems.slice(0, 5).join('; ')}`)
console.error(`  ${rows.length} seed files on Blob at their recorded sizes; control 404`)
ok('SEED_BLOB_OK')
