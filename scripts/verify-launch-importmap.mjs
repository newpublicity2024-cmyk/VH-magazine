/**
 * GATES-LAUNCH L2 — the admin import map matches the production configuration.
 *
 * payload.config.ts registers the Vercel Blob adapter only when BLOB_READ_WRITE_TOKEN is set,
 * and with `clientUploads` the adapter adds an admin provider component
 * (VercelBlobClientUploadHandler). Every import map generated on this Mac — where the token
 * is deliberately absent — left it out, so on Vercel the admin would look it up and miss it
 * (`getFromImportMap: PayloadComponent not found`, the failure that kept the article editor
 * from rendering until G42), and uploads would ride the 4.5 MB-limited server path.
 *
 * This gate regenerates the map with the adapter ON — a token naming the public store with a
 * zero secret, which can write nothing — compares it byte for byte with the committed file,
 * and always restores the committed file, so the gate never changes the tree it certifies.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { ROOT, assert, fail, ok } from './lib/harness.mjs'

const MIGRATION = process.env.VH_MIGRATION_DIR || '/Users/mc/work/hostinger-ftp/migration'
const MAP = path.join(ROOT, 'src', 'app', '(payload)', 'admin', 'importMap.js')
const HANDLER = '@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler'

const line = readFileSync(path.join(MIGRATION, '.secrets', 'blob.env'), 'utf8')
  .split('\n')
  .find((l) => l.startsWith('BLOB_READ_WRITE_TOKEN='))
const store = line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '').match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)?.[1]
assert(store, 'could not read the Blob store id from the migration workspace')

const committed = readFileSync(MAP, 'utf8')
let generated
try {
  const run = spawnSync('pnpm', ['-s', 'generate:importmap'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    env: { ...process.env, BLOB_READ_WRITE_TOKEN: `vercel_blob_rw_${store.toLowerCase()}_${'0'.repeat(30)}` },
  })
  if (run.status !== 0) fail(`generate:importmap exited ${run.status ?? run.signal}:\n${`${run.stdout}${run.stderr}`.slice(-2000)}`)
  generated = readFileSync(MAP, 'utf8')
} finally {
  writeFileSync(MAP, committed)
}

assert(generated.includes(HANDLER), `the generated map lacks ${HANDLER} — the adapter was not on`)
assert(committed.includes(HANDLER), `the committed import map lacks ${HANDLER}`)
assert(generated === committed, 'the committed import map differs from what Payload generates with the Blob adapter on')

console.error(`  committed import map = generated with the Blob adapter on (${committed.length} bytes, client-upload handler present)`)
ok('IMPORTMAP_OK')
