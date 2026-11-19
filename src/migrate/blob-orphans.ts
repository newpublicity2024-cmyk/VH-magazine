import 'dotenv/config'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { del, list } from '@vercel/blob'
import { getPayload } from 'payload'

import config from '../payload.config'

/**
 * Round 2b — find Blob objects nothing references.
 *
 *   pnpm tsx src/migrate/blob-orphans.ts --dir <migration dir>            report only
 *   pnpm tsx src/migrate/blob-orphans.ts --dir <migration dir> --delete   remove them
 *
 * Expected objects: every Media row's file and size variants, plus the raw legacy
 * newsletters recorded in <dir>/manifests/import-raw.jsonl and the production demo's seed
 * images recorded in <dir>/manifests/seed-blob-uploads.jsonl. Anything else in the
 * store is an orphan — typically the half of a create that failed after uploading.
 *
 * Run --delete only while no import is running: an object uploaded a moment before
 * its DB row commits looks exactly like an orphan.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const dir = arg('dir')
  if (!dir) throw new Error('--dir is required')
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  const remove = process.argv.includes('--delete')

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'media',
    pagination: false,
    depth: 0,
    select: { filename: true, sizes: true },
  })
  const expected = new Set<string>()
  for (const d of docs) {
    if (d.filename) expected.add(d.filename)
    for (const s of Object.values(d.sizes || {})) if (s?.filename) expected.add(s.filename)
  }
  const rawFile = path.join(dir, 'manifests', 'import-raw.jsonl')
  if (existsSync(rawFile)) {
    for (const l of readFileSync(rawFile, 'utf8').split('\n').filter(Boolean)) {
      expected.add(`legacy/${(JSON.parse(l) as { legacyPath: string }).legacyPath}`)
    }
  }

  // The production demo's seed images (upload-seed-media.ts, 2026-11-19): referenced by the
  // Neon production branch, not by vh_migration. Expected until the archive replaces the seed.
  const seedFile = path.join(dir, 'manifests', 'seed-blob-uploads.jsonl')
  if (existsSync(seedFile)) {
    for (const l of readFileSync(seedFile, 'utf8').split('\n').filter(Boolean)) {
      expected.add((JSON.parse(l) as { pathname: string }).pathname)
    }
  }

  const orphans: { pathname: string; url: string; size: number }[] = []
  let total = 0
  let cursor: string | undefined
  do {
    const page = await list({ cursor, limit: 1000 })
    for (const b of page.blobs) {
      total++
      if (!expected.has(b.pathname)) orphans.push({ pathname: b.pathname, url: b.url, size: b.size })
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  const missing = expected.size - (total - orphans.length)
  console.log(
    `store objects ${total}; referenced ${expected.size} (media rows ${docs.length}); ` +
      `orphans ${orphans.length}; referenced-but-absent ${missing}`,
  )
  for (const o of orphans.slice(0, 20)) console.log(`  orphan ${o.size} ${o.pathname}`)

  if (remove && orphans.length) {
    for (let i = 0; i < orphans.length; i += 100) await del(orphans.slice(i, i + 100).map((o) => o.url))
    console.log(`deleted ${orphans.length} orphan objects`)
  } else if (!orphans.length && missing === 0) {
    console.log('no orphan blobs')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
