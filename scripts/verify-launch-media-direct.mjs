/**
 * GATES-LAUNCH L6 — migrated media is served straight from Vercel Blob (LAUNCH.md step 5).
 *
 * Before: every media URL was Payload's proxy path /api/media/file/<name>, so each image the
 * optimizer missed, each og:image fetch by a social crawler, and every byte of the 229
 * migrated videos and audio files (2.5 GB, up to 81 MB each) ran through a Vercel Function
 * that also called Blob head() first. After: `disablePayloadAccessControl` makes Payload hand
 * out the public Blob URL, and the optimizer accepts that one store only.
 *
 * The server runs against vh_migration with the Blob adapter ON, given a token that has the
 * real store id and a zero secret: it can name the public store (that is all URL generation
 * needs) and can write nothing. The real token is read from the migration workspace only to
 * learn the store id, which is public anyway — it is in every Blob URL.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { assert, check, fail, GateFailure, ok, stripScripts, withServer } from './lib/harness.mjs'

const MIGRATION = process.env.VH_MIGRATION_DIR || '/Users/mc/work/hostinger-ftp/migration'

function storeId() {
  const line = readFileSync(path.join(MIGRATION, '.secrets', 'blob.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('BLOB_READ_WRITE_TOKEN='))
  const id = line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '').match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)?.[1]
  if (!id) fail('could not read the Blob store id from the migration workspace')
  return id.toLowerCase()
}

const STORE = storeId()
const BLOB = `https://${STORE}.public.blob.vercel-storage.com`
const FOREIGN = `https://${'q'.repeat(STORE.length)}.public.blob.vercel-storage.com`
assert(FOREIGN !== BLOB, 'control: the foreign store host equals ours')

process.env.DATABASE_URL = 'postgres://localhost/vh_migration'
process.env.BLOB_READ_WRITE_TOKEN = `vercel_blob_rw_${STORE}_${'0'.repeat(30)}`
delete process.env.STORAGE_VERCEL_BLOB_BASE_URL

// This Mac's network does DNS64, and Next's optimizer refuses an upstream resolving to the
// NAT64 prefix (lib/dns64-preload.cjs). Measure it with Next's own lookup and guard; only then
// give the server the preload, and say so. A real private address is never masked.
const { isPrivateIp } = await import('next/dist/server/is-private-ip.js')
const dnsModule = await import('node:dns')
const resolved = await dnsModule.promises.lookup(new URL(BLOB).hostname, { family: 0, all: true, hints: dnsModule.ALL })
const privateHits = resolved.filter((r) => isPrivateIp(r.address)).map((r) => r.address)
let dns64 = false
if (privateHits.length) {
  assert(privateHits.every((a) => /^64:ff9b::/i.test(a)), `the store resolves to a private address: ${privateHits.join(', ')}`)
  dns64 = true
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --require ${path.join(import.meta.dirname, 'lib', 'dns64-preload.cjs')}`.trim()
}

const sql = (q) =>
  execFileSync('psql', ['-d', 'vh_migration', '-At', '-c', `select row_to_json(t) from (${q}) t`], { encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))

const urlOf = (slug) =>
  sql(`select "to" from redirects where "from" like '/?p=%' and "to" like '%/${slug}/' limit 1`)[0]?.to

// The smallest video a published article body plays, and an article whose body shows images.
const [video] = sql(`
  select a.slug, m.filename, m.filesize, a.title
    from articles a join media m on m.mime_type like 'video/%'
     and a.body::text like '%"value": ' || m.id || ', "fields"%'
   where a._status = 'published'
   order by m.filesize, a.id limit 1`)
const [images] = sql(`
  select a.slug from articles a join media m on m.mime_type like 'image/%'
     and a.body::text like '%"value": ' || m.id || ', "fields"%'
   where a._status = 'published' and a.featured_image_id is not null
   order by a.id limit 1`)
assert(video && images, 'vh_migration has no published article with a body video, or none with body images')
const videoUrl = urlOf(video.slug)
const imagesUrl = urlOf(images.slug)
assert(videoUrl && imagesUrl, `no /?p= redirect names ${video.slug} or ${images.slug}`)
const categoryUrl = `/category/${videoUrl.split('/').filter(Boolean).slice(0, -1).join('/')}/`
const term = video.title.split(/[^\p{L}]+/u).filter((w) => w.length >= 6).sort((a, b) => b.length - a.length)[0]
assert(term, `no search term in "${video.title}"`)

const decode = (s) => s.replace(/&amp;/g, '&')
const candidates = (dom) =>
  [...dom.matchAll(/<img\b[^>]*>/g)].flatMap(([tag]) => {
    const src = /\bsrc="([^"]*)"/.exec(tag)?.[1]
    const set = /\bsrcset="([^"]*)"/.exec(tag)?.[1]
    return [src, ...(set ? set.split(/,\s+/).map((c) => c.trim().split(/\s+/)[0]) : [])].filter(Boolean).map(decode)
  })
// trailingSlash: true makes Next emit the optimizer as /_next/image/?url=… (both forms accepted).
const isOptimized = (c) => /^\/_next\/image\/?\?/.test(c)
const sourceOf = (c) => (isOptimized(c) ? new URL(c, 'http://x').searchParams.get('url') : c)

const jsonLdImages = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .filter((n) => n['@type'] === 'NewsArticle')
    .flatMap((n) => [n.image].flat())
    .filter(Boolean)
    .map((i) => (typeof i === 'string' ? i : i.url))

let optimizerCandidate = null

async function page(baseUrl, pathname, { article = false } = {}) {
  const res = await fetch(`${baseUrl}${pathname}`)
  const raw = await res.text()
  check(res.status === 200, `${pathname}: status ${res.status}`)
  for (const pattern of [/\/api\/media\/file\//, /%2Fapi%2Fmedia%2Ffile%2F/i]) {
    const at = raw.search(pattern)
    check(at === -1, `${pathname}: proxied media URL in the response: …${raw.slice(Math.max(0, at - 60), at + 80)}…`)
  }
  const dom = stripScripts(raw)
  const sources = candidates(dom).map(sourceOf)
  const proxied = sources.filter((s) => s.startsWith('/api/'))
  check(!proxied.length, `${pathname}: image sources through /api: ${proxied.slice(0, 2).join(', ')}`)
  const direct = sources.filter((s) => s.startsWith(`${BLOB}/`))
  check(direct.length > 0, `${pathname}: no image comes from the Blob store (${sources.slice(0, 3).join(', ')})`)
  if (article) {
    const og = decode(/<meta property="og:image" content="([^"]+)"/.exec(dom)?.[1] ?? '')
    check(og.startsWith(`${BLOB}/`), `${pathname}: og:image ${og || 'missing'} is not a Blob URL`)
    const ld = jsonLdImages(raw)
    check(ld.length > 0 && ld.every((u) => u.startsWith(`${BLOB}/`) && !u.endsWith('/')), `${pathname}: JSON-LD images ${JSON.stringify(ld)}`)
  }
  optimizerCandidate ??= candidates(dom).find((c) => isOptimized(c) && sourceOf(c).startsWith(`${BLOB}/`))
  return dom
}

try {
  await withServer(async (baseUrl) => {
    // Not the homepage: it is prerendered at build time from the build's database (vh_magazine
    // here), so against vh_migration it would show seed media. Categories, articles and search
    // render on request from the server's own database.
    await page(baseUrl, categoryUrl)
    await page(baseUrl, imagesUrl, { article: true })
    const dom = await page(baseUrl, videoUrl, { article: true })

    // The body video plays from Blob, with byte ranges (seeking; Safari will not play without).
    const want = `${BLOB}/${encodeURIComponent(video.filename)}`
    const videoSrc = decode(/<video\b[^>]*\bsrc="([^"]+)"/.exec(dom)?.[1] ?? '')
    check(videoSrc === want, `${videoUrl}: <video src> is ${videoSrc || 'missing'}, expected ${want}`)
    const whole = Buffer.from(await (await fetch(want)).arrayBuffer())
    check(whole.length === Number(video.filesize), `${want}: ${whole.length} bytes, recorded ${video.filesize}`)
    for (const [from, to] of [[0, 1023], [100_000, 165_535]]) {
      const r = await fetch(want, { headers: { Range: `bytes=${from}-${to}` } })
      const part = Buffer.from(await r.arrayBuffer())
      check(r.status === 206, `${want} Range ${from}-${to}: status ${r.status}`)
      check(r.headers.get('content-range') === `bytes ${from}-${to}/${whole.length}`, `content-range ${r.headers.get('content-range')}`)
      check(part.equals(whole.subarray(from, to + 1)), `Range ${from}-${to}: bytes differ from the file`)
    }

    // The optimizer serves our store as AVIF/WebP — and refuses the identical request for another store.
    check(optimizerCandidate, 'no optimizer candidate sourced from the Blob store')
    const accept = { Accept: 'image/avif,image/webp,image/*;q=0.8' }
    const mine = await fetch(`${baseUrl}${optimizerCandidate}`, { headers: accept })
    const mineType = mine.headers.get('content-type')
    check(mine.status === 200 && /^image\/(avif|webp)$/.test(mineType ?? ''), `optimizer on our store: ${mine.status} ${mineType}`)
    check((await mine.arrayBuffer()).byteLength > 0, 'optimizer returned an empty image')
    const foreign = new URL(optimizerCandidate, baseUrl)
    foreign.searchParams.set('url', sourceOf(optimizerCandidate).replace(BLOB, FOREIGN))
    const theirs = await fetch(foreign, { headers: accept })
    check(theirs.status === 400, `optimizer on another Blob store answered ${theirs.status}, expected 400`)

    // Live search thumbnails (read straight from SQL, not through Payload's hooks).
    const search = await (await fetch(`${baseUrl}/api/search/?q=${encodeURIComponent(term)}`)).json()
    const thumbs = (search.hits ?? []).map((h) => h.thumb).filter(Boolean)
    check(thumbs.length > 0, `live search for "${term}" returned no thumbnails`)
    check(thumbs.every((t) => t.startsWith(`${BLOB}/`)), `live-search thumbnails not on Blob: ${thumbs.filter((t) => !t.startsWith(BLOB)).slice(0, 2).join(', ')}`)
    await page(baseUrl, `/recherche/?q=${encodeURIComponent(term)}`)
  })
} catch (e) {
  fail(e instanceof GateFailure ? e.message : (e?.stack ?? String(e)))
}

console.error(
  `  ${dns64 ? '[DNS64 network: NAT64-synthesised addresses of public IPv4s dropped for the server] ' : ''}${categoryUrl}, ${imagesUrl}, ${videoUrl}, search "${term}": media on ${BLOB}; video Range 206 exact; optimizer AVIF/WebP for ours, 400 for another store`,
)
ok('MEDIA_DIRECT_OK')
