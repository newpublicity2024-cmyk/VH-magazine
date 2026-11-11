import 'dotenv/config'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, statSync } from 'fs'
import os from 'os'
import path from 'path'
import { put } from '@vercel/blob'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import sharp from 'sharp'

import config from '../payload.config'

/**
 * Round 2b — import WordPress media originals into Payload Media (Blob + DB).
 *
 *   pnpm tsx src/migrate/import-media.ts --dir <migration dir> [--concurrency 6] [--limit N]
 *
 * Input is the local staging produced from the vh.ma FTP account:
 *   <dir>/manifests/staged.jsonl   one record per downloaded file (last record wins)
 *   <dir>/staging/wp-content/uploads/YYYY/MM/<file>
 *
 * Per file, by type:
 *   image / pdf / video / audio  → payload.create('media'), keyed by `legacyPath`
 *   html (old newsletters)       → raw Blob object at `legacy/<legacyPath>` (no Media row:
 *                                  editors must never be able to publish HTML into Media)
 *   anything else                → skipped and recorded with a reason
 *   name-scaled.ext beside name.ext → skipped as an alias; /api/legacy-media folds
 *                                  "-scaled" and "-WxH" back onto the original
 *
 * Idempotent: rows already carrying a legacyPath are skipped, raw objects are
 * overwritten in place. Every outcome is appended to <dir>/manifests/import-*.jsonl.
 *
 * Collisions: Blob refuses to overwrite a pathname and Payload picks `photo-1.jpg`
 * when `photo.jpg` exists by querying the DB first. Two concurrent creates of
 * same-named files could therefore race for one pathname. Files are grouped by a
 * collision key (lower-cased stem without -N / -WxH / -scaled / -e<ts> suffixes)
 * and each group runs sequentially on one worker, so no two uploads ever race.
 *
 * Payload's uniqueness check only compares the main filename, so `photo.jpeg`
 * and `photo.jpg` both pass it and then generate the same size-variant names
 * (`photo-160x160.jpg`) — Blob rejects the second. On "already exists" the file is
 * retried as `<stem>-<YYYY>-<MM>.<ext>`, then `<stem>-<YYYY>-<MM>-<hash6>.<ext>`
 * (see candidateNames). Blobs a failed attempt left behind are swept afterwards by
 * blob-orphans.ts.
 *
 * Undecodable sources, decided by a strict sharp decode of our own (Payload hides
 * the cause): JPEGs truncated on the old server (vh.ma serves the same short bytes)
 * are re-encoded via a tolerant decode; images sharp's decoders reject (an AVIF
 * bitstream) are transcoded to JPEG with macOS `sips`. Either way the row records
 * `repaired: <method>` so byte-identity checks exclude exactly those files. A file
 * neither fix can read is recorded as an unrecoverable skip, never retried.
 */

type Staged = { path: string; size: number; sha256: string }
type Kind = 'media' | 'raw' | 'skip' | 'alias'

/** A source file no tool can turn into an image; recorded as a skip, not an error. */
class Unrecoverable extends Error {}

const MEDIA_EXT = new Set(
  'jpg jpeg png gif webp avif tif tiff bmp heic pdf mp4 m4v mov webm mp3 m4a wav ogg'.split(' '),
)
const RAW_EXT = new Set(['html', 'htm'])

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T)
}

const extOf = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '')

/** "Lalla-Khadija_MAP-2.jpg" → "Lalla Khadija MAP" — a placeholder until WP alt text arrives. */
export function altFromFilename(name: string): string {
  let stem = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
  try {
    stem = decodeURIComponent(stem)
  } catch {
    /* keep raw */
  }
  stem = stem
    .replace(/-e\d{10,}$/, '')
    .replace(/-scaled$/, '')
    .replace(/-\d+$/, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (stem || 'Image VH Magazine').slice(0, 200)
}

function collisionKey(name: string): string {
  let stem = (name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name).toLowerCase()
  for (let prev = ''; prev !== stem; ) {
    prev = stem
    stem = stem.replace(/(-\d+x\d+|-\d+|-scaled|-e\d{10,})$/, '')
  }
  return stem
}

async function main() {
  const dir = arg('dir')
  if (!dir || !existsSync(path.join(dir, 'manifests', 'staged.jsonl'))) {
    throw new Error('--dir must point at the migration folder (manifests/staged.jsonl not found)')
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set — files would land on local disk, refusing')
  }
  const concurrency = Number(arg('concurrency', '6'))
  const limit = arg('limit') ? Number(arg('limit')) : Infinity
  const dbName = new URL(process.env.DATABASE_URL || 'postgres://unset/unset').pathname.slice(1)
  console.log(`target database: ${dbName}; concurrency ${concurrency}; limit ${limit}`)

  const man = (f: string) => path.join(dir, 'manifests', f)
  const staging = path.join(dir, 'staging')
  const staged = new Map<string, Staged>()
  for (const r of readJsonl<Staged>(man('staged.jsonl'))) staged.set(r.path, r)

  // classify every staged file that is fully on disk
  const byDir = new Map<string, Set<string>>()
  for (const p of staged.keys()) {
    const d = p.slice(0, p.lastIndexOf('/'))
    if (!byDir.has(d)) byDir.set(d, new Set())
    byDir.get(d)!.add(p.slice(p.lastIndexOf('/') + 1))
  }
  const items: { legacyPath: string; abs: string; name: string; kind: Kind; reason?: string }[] = []
  for (const [p, s] of staged) {
    const legacyPath = p.replace(/^\/public_html\//, '')
    const abs = path.join(staging, legacyPath)
    if (!existsSync(abs) || statSync(abs).size !== s.size) continue // still downloading
    const name = p.slice(p.lastIndexOf('/') + 1)
    const ext = extOf(name)
    const scaled = name.match(/^(.*)-scaled(\.[A-Za-z0-9]+)$/)
    let kind: Kind
    let reason: string | undefined
    if (scaled && byDir.get(p.slice(0, p.lastIndexOf('/')))!.has(scaled[1] + scaled[2])) {
      kind = 'alias'
      reason = `alias of ${scaled[1]}${scaled[2]}`
    } else if (s.size === 0) {
      kind = 'skip'
      reason = 'empty on the old server (0 bytes)'
    } else if (MEDIA_EXT.has(ext)) kind = 'media'
    else if (RAW_EXT.has(ext)) kind = 'raw'
    else {
      kind = 'skip'
      reason = `not media (.${ext || 'none'})`
    }
    items.push({ legacyPath, abs, name, kind, reason })
  }
  items.sort((a, b) => a.legacyPath.localeCompare(b.legacyPath))

  const payload: Payload = await getPayload({ config })
  const existing = new Set<string>()
  const found = await payload.find({
    collection: 'media',
    where: { legacyPath: { exists: true } },
    select: { legacyPath: true },
    pagination: false,
    depth: 0,
  })
  for (const d of found.docs) if (d.legacyPath) existing.add(d.legacyPath)

  // Reconcile: a `-scaled` copy imported in an early pass, before its original had
  // finished downloading, is now an alias. Delete those rows (Payload's storage
  // adapter removes their Blob files) so each image exists exactly once.
  const staleAliases = items.filter((i) => i.kind === 'alias' && existing.has(i.legacyPath)).map((i) => i.legacyPath)
  if (staleAliases.length) {
    await payload.delete({ collection: 'media', where: { legacyPath: { in: staleAliases } }, depth: 0 })
    for (const p of staleAliases) existing.delete(p)
    console.log(`reconciled: removed ${staleAliases.length} -scaled rows whose original is now imported`)
  }

  const record = (file: string, row: object) => appendFileSync(man(file), JSON.stringify(row) + '\n')

  // Payload always re-encodes GIF/WebP/AVIF originals through sharp (generateFileData:
  // "fileIsAnimatedType"), which is lossy for already-lossy WebP/AVIF and bloats some
  // GIFs. A migration keeps the server's bytes: once Payload has made the row and its
  // size variants, the main object is overwritten with the original and filesize fixed
  // through the DB adapter (no upload hooks, so nothing is re-processed).
  const repairedPaths = new Set(
    readJsonl<{ legacyPath: string; repaired?: unknown }>(man('import-media.jsonl'))
      .filter((r) => r.repaired)
      .map((r) => r.legacyPath),
  )
  async function restoreOriginal(doc: { id: number; filename?: string | null; mimeType?: string | null }, abs: string) {
    const bytes = readFileSync(abs)
    await put(doc.filename!, bytes, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365, // same as the storage adapter
      contentType: doc.mimeType || undefined,
    })
    await payload.db.updateOne({ collection: 'media', id: doc.id, data: { filesize: bytes.length } })
    return bytes.length
  }
  {
    const rows = await payload.find({
      collection: 'media',
      where: { legacyPath: { exists: true } },
      select: { legacyPath: true, filename: true, filesize: true, mimeType: true },
      pagination: false,
      depth: 0,
    })
    const drifted = rows.docs.filter((d) => {
      const s = staged.get(`/public_html/${d.legacyPath}`)
      return s && !repairedPaths.has(d.legacyPath!) && d.filesize !== s.size
    })
    for (const d of drifted) {
      const size = await restoreOriginal(d, path.join(staging, d.legacyPath!))
      record('import-restored.jsonl', { legacyPath: d.legacyPath, filename: d.filename, size })
    }
    if (drifted.length) console.log(`restored ${drifted.length} originals Payload had re-encoded`)
  }
  // Passes repeat while staging is still downloading: never re-record or re-upload.
  const done = (file: string) => new Set(readJsonl<{ legacyPath: string }>(man(file)).map((r) => r.legacyPath))
  const skippedBefore = done('import-skipped.jsonl')
  const rawBefore = done('import-raw.jsonl')
  for (const it of items.filter((i) => i.kind === 'skip' || i.kind === 'alias')) {
    if (!skippedBefore.has(it.legacyPath)) record('import-skipped.jsonl', { legacyPath: it.legacyPath, reason: it.reason })
  }

  const todo = items.filter(
    (i) =>
      // a media file once recorded as unrecoverable is not retried every pass
      (i.kind === 'media' && !existing.has(i.legacyPath) && !skippedBefore.has(i.legacyPath)) ||
      (i.kind === 'raw' && !rawBefore.has(i.legacyPath)),
  )
  const groups = new Map<string, typeof todo>()
  for (const it of todo.slice(0, limit)) {
    const k = collisionKey(it.name)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(it)
  }
  const queue = [...groups.values()]
  const total = queue.reduce((n, g) => n + g.length, 0)
  console.log(
    `staged on disk ${items.length}; media ${items.filter((i) => i.kind === 'media').length} ` +
      `(already imported ${existing.size}); raw ${items.filter((i) => i.kind === 'raw').length}; ` +
      `alias ${items.filter((i) => i.kind === 'alias').length}; skip ${items.filter((i) => i.kind === 'skip').length}; ` +
      `to process now ${total} in ${queue.length} collision groups`,
  )

  let stop = false
  process.on('SIGINT', () => {
    stop = true
    console.log('SIGINT: finishing in-flight files, then stopping')
  })
  const stats = { created: 0, raw: 0, errors: 0, renamed: 0, repaired: 0, unrecoverable: 0 }
  const started = Date.now()
  const renameDir = mkdtempSync(path.join(os.tmpdir(), 'vh-import-'))

  type Item = { legacyPath: string; abs: string; name: string }
  const splitName = (name: string) => {
    const dot = name.lastIndexOf('.')
    return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  }
  const copyAs = (src: string, name: string): string => {
    const target = path.join(mkdtempSync(path.join(renameDir, 'f-')), name)
    copyFileSync(src, target)
    return target
  }

  /**
   * Filenames to try, in order: the original name; `<stem>-<YYYY>-<MM>`; and
   * `<stem>-<YYYY>-<MM>-<hash6>`. The folder tag alone is not enough when one month
   * folder holds both photo.jpeg and photo.jpg (their size variants share a .jpg
   * extension); the hash of the full legacy path is unique by construction.
   */
  function candidateNames(it: Item, name: string): string[] {
    const folder = it.legacyPath.match(/(\d{4})\/(\d{2})\/[^/]+$/)
    const tag = folder ? `${folder[1]}-${folder[2]}` : 'legacy'
    const hash = createHash('sha1').update(it.legacyPath).digest('hex').slice(0, 6)
    const [stem, ext] = splitName(name)
    return [name, `${stem}-${tag}${ext}`, `${stem}-${tag}-${hash}${ext}`]
  }

  /** Truncated JPEG → tolerant decode → valid JPEG at the same name (a copy). */
  async function repairJpeg(it: Item): Promise<string> {
    const target = path.join(mkdtempSync(path.join(renameDir, 'repair-')), it.name)
    await sharp(it.abs, { failOn: 'none' }).jpeg({ quality: 92, mozjpeg: true }).toFile(target)
    return target
  }

  /**
   * An image sharp's bundled decoders cannot read (seen: an AVIF whose AV1 bitstream
   * libheif rejects) → macOS ImageIO via `sips` → JPEG. This migration runs on a Mac;
   * where sips is absent the file falls through to "unrecoverable".
   */
  function transcodeWithSips(it: Item): string {
    const target = path.join(mkdtempSync(path.join(renameDir, 'sips-')), `${splitName(it.name)[0]}.jpg`)
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', it.abs, '--out', target], {
      stdio: 'ignore',
    })
    return target
  }

  /** The underlying sharp/Blob cause, which Payload wraps in a generic upload error. */
  const causeOf = (err: unknown): string => {
    const parts: string[] = []
    for (let e: unknown = err; e instanceof Error && parts.length < 4; e = (e as { cause?: unknown }).cause) {
      parts.push(e.message)
    }
    return parts.join(' <- ')
  }

  /** Upload `src` as a Media row, walking the candidate names past Blob collisions. */
  async function upload(it: Item, src: string) {
    const names = candidateNames(it, path.basename(src))
    for (let i = 0; ; i++) {
      try {
        const doc = await payload.create({
          collection: 'media',
          data: { alt: altFromFilename(it.name), legacyPath: it.legacyPath },
          filePath: i === 0 ? src : copyAs(src, names[i]),
          context: { skipRedirects: true },
          depth: 0,
        })
        return { doc, renamed: i > 0 }
      } catch (err) {
        if (i + 1 < names.length && /already exists/i.test(causeOf(err))) continue
        throw err
      }
    }
  }

  async function createMedia(it: Item) {
    try {
      return { ...(await upload(it, it.abs)), repaired: false as false | string }
    } catch (err) {
      // Payload hides sharp's message behind a generic upload error, so decide by
      // decoding the source ourselves. Only a source that fails a strict decode is
      // "fixed"; anything else is a real error and is reported as one.
      const isImage = /\.(jpe?g|png|gif|webp|avif|heic|heif|tiff?|bmp)$/i.test(it.name)
      const strictOk = isImage && (await sharp(it.abs).toBuffer().then(() => true, () => false))
      if (!isImage || strictOk) throw new Error(causeOf(err))
      const fixes: [string, () => Promise<string> | string][] = [
        ...(/\.jpe?g$/i.test(it.name) ? [['sharp-tolerant', () => repairJpeg(it)] as [string, () => Promise<string>]] : []),
        ['sips-transcode', () => transcodeWithSips(it)],
      ]
      const reasons: string[] = []
      for (const [method, fix] of fixes) {
        let fixed: string
        try {
          fixed = await fix()
        } catch (fixErr) {
          reasons.push(`${method}: ${causeOf(fixErr)}`)
          continue
        }
        return { ...(await upload(it, fixed)), repaired: method }
      }
      throw new Unrecoverable(`unrecoverable corrupt image: ${reasons.join(' | ')}`)
    }
  }

  async function worker() {
    for (;;) {
      if (stop) return
      const group = queue.shift()
      if (!group) return
      for (const it of group) {
        try {
          if (it.kind === 'raw') {
            const res = await put(`legacy/${it.legacyPath}`, readFileSync(it.abs), {
              access: 'public',
              addRandomSuffix: false,
              allowOverwrite: true,
              contentType: 'text/html; charset=utf-8',
            })
            record('import-raw.jsonl', { legacyPath: it.legacyPath, url: res.url, size: statSync(it.abs).size })
            stats.raw++
          } else {
            const { doc, renamed, repaired } = await createMedia(it)
            if (renamed) stats.renamed++
            if (repaired) stats.repaired++
            if (!repaired && doc.filesize !== statSync(it.abs).size) {
              doc.filesize = await restoreOriginal(doc, it.abs)
              record('import-restored.jsonl', { legacyPath: it.legacyPath, filename: doc.filename, size: doc.filesize })
            }
            record('import-media.jsonl', {
              legacyPath: it.legacyPath,
              renamed,
              repaired,
              id: doc.id,
              filename: doc.filename,
              url: doc.url,
              mimeType: doc.mimeType,
              filesize: doc.filesize,
              width: doc.width,
              height: doc.height,
              sizes: Object.fromEntries(
                Object.entries(doc.sizes || {}).map(([k, v]) => [k, v?.filename ?? null]),
              ),
            })
            stats.created++
          }
        } catch (err) {
          if (err instanceof Unrecoverable) {
            stats.unrecoverable++
            record('import-skipped.jsonl', { legacyPath: it.legacyPath, reason: err.message })
            continue
          }
          stats.errors++
          record('import-errors.jsonl', {
            legacyPath: it.legacyPath,
            kind: it.kind,
            error: err instanceof Error ? err.message : String(err),
          })
        }
        const n = stats.created + stats.raw + stats.errors
        if (n % 100 === 0) {
          const rate = n / ((Date.now() - started) / 1000)
          console.log(
            `  ... ${n}/${total} (${stats.created} media, ${stats.raw} raw, ${stats.errors} errors) ` +
              `${rate.toFixed(1)}/s, eta ${Math.round((total - n) / Math.max(rate, 0.01) / 60)} min`,
          )
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  console.log(
    `import pass complete: ${stats.created} media created (${stats.renamed} renamed after a name collision, ` +
      `${stats.repaired} undecodable sources repaired or transcoded), ` +
      `${stats.raw} raw uploaded, ${stats.unrecoverable} unrecoverable (skipped), ${stats.errors} errors, ` +
      `${existing.size} already present${stop ? ' (stopped early)' : ''}`,
  )
  process.exit(stats.errors ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
