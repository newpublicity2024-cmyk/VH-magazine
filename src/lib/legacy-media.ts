/**
 * Legacy WordPress upload URLs → migrated media (round 2b, phase P4).
 *
 * Pure functions only; `app/api/legacy-media/route.ts` does the I/O. Kept apart
 * so the resolution rules can be checked without a server or a database.
 *
 * What the old server holds under /wp-content/uploads/ (inventory, 2026-11-05):
 * 430,831 files. Only the 29k originals were imported (decision Q1); the other
 * 398k are WordPress size variants of them. Measured against the import, every
 * media file on the old server resolves through exactly these rules:
 *
 *   31,131  the path itself is an imported original
 *  398,356  one `-WxH` size suffix folded           photo-300x200.jpg → photo.jpg
 *       94  `-WxH` then `-scaled` folded            photo-scaled-300x200.jpg → photo.jpg
 *       24  two `-WxH` suffixes folded              logo-375x195-150x150.jpg → logo.jpg
 *      166  old HTML newsletters (raw Blob objects, not Media)
 *
 * The rest is server debris — plugin logs, article exports, Elementor CSS — and
 * must 404 rather than be handed to the old origin.
 */

export const UPLOADS_PREFIX = 'wp-content/uploads/'

/** Hosts that are the real site; mirrors PRODUCTION_HOSTS in middleware (B3). */
const PRODUCTION_HOSTS = new Set(['vh.ma', 'www.vh.ma'])

/**
 * Extensions worth sending to the old origin when nothing was imported for the
 * path: media uploaded after the inventory (phase P6 syncs those) and files the
 * importer skipped. The same set the importer treats as media, plus the HTML
 * newsletters. Everything else — `.php`, `.csv`, `.xlsx`, a Word invoice — 404s,
 * so this domain never becomes a redirector to private debris on the old server.
 */
const ORIGIN_FALLBACK_EXT = new Set(
  'jpg jpeg png gif webp avif tif tiff bmp heic pdf mp4 m4v mov webm mp3 m4a wav ogg html htm'.split(' '),
)

const extOf = (p: string) => {
  const name = p.slice(p.lastIndexOf('/') + 1)
  return name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
}

export const isRawHtml = (legacyPath: string) => ['html', 'htm'].includes(extOf(legacyPath))
export const isOriginFallbackCandidate = (legacyPath: string) => ORIGIN_FALLBACK_EXT.has(extOf(legacyPath))

/** `%E9` read as Latin-1, for pre-UTF-8 links that decodeURIComponent rejects. */
function decodeLatin1(raw: string): string {
  return raw.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * The request pathname, as received (percent-encoded), → the `legacyPath` key
 * the importer stored (`wp-content/uploads/2016/05/rayé.jpg`), or null when it
 * is not a well-formed uploads path. Traversal segments are rejected after
 * decoding, so `%2e%2e` cannot slip past.
 */
export function decodeLegacyPath(raw: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = decodeLatin1(raw)
  }
  const p = decoded.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!p.startsWith(UPLOADS_PREFIX) || p.length === UPLOADS_PREFIX.length) return null
  if (p.includes('\0')) return null
  if (p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return null
  return p
}

const WXH = /-\d+x\d+(\.[A-Za-z0-9]+)$/
const SCALED = /-scaled(\.[A-Za-z0-9]+)$/

/**
 * Every `legacyPath` the request may correspond to, most specific first. The
 * caller takes the first one that exists, so an original whose own name ends
 * in `-WxH` (203 do) is matched exactly before any folding is tried.
 *
 * Each rule is tried in all Unicode forms: 459 imported paths are stored
 * decomposed (NFD, as macOS writes them), while browsers and crawlers often
 * send composed text. No two imported paths collide under normalisation, so
 * trying both cannot pick the wrong file.
 *
 * Not needed, measured: 634 files carry `#Uxxxx`-mangled names
 * (`son-#U00e9pouse.jpg`), and every one has a readable-named twin among the
 * imports, so a readable link already resolves exactly; the mangled names
 * resolve at their own URLs.
 */
export function candidatePaths(legacyPath: string): string[] {
  const out: string[] = []
  const add = (s: string) => {
    if (!out.includes(s)) out.push(s)
  }
  const forms = [legacyPath, legacyPath.normalize('NFC'), legacyPath.normalize('NFD')]

  const tiers: string[][] = [[], [], [], []]
  for (const f of forms) {
    tiers[0].push(f) //                                          as requested
    const once = f.replace(WXH, '$1')
    if (once !== f) tiers[1].push(once) //                       one size suffix
    const twice = once.replace(WXH, '$1')
    if (twice !== once) tiers[2].push(twice) //                  two size suffixes
    for (const s of [f, once]) {
      const unscaled = s.replace(SCALED, '$1')
      if (unscaled !== s) tiers[3].push(unscaled) //             -scaled, bare or under a size suffix
    }
  }
  for (const tier of tiers) tier.forEach(add)
  return out
}

/**
 * Public base URL of the Blob store, derived exactly as
 * `@payloadcms/storage-vercel-blob` derives it, so a redirect target can never
 * drift from the URL Payload itself generates for the same file.
 */
export function blobBaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const override = env.STORAGE_VERCEL_BLOB_BASE_URL
  if (override) return override.replace(/\/+$/, '')
  const storeId = env.BLOB_READ_WRITE_TOKEN?.match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)?.[1]?.toLowerCase()
  return storeId ? `https://${storeId}.public.blob.vercel-storage.com` : null
}

/** A Media file's direct Blob URL — Payload's generateURL with no prefix. */
export const blobFileUrl = (base: string, filename: string) => `${base}/${encodeURIComponent(filename)}`

/** A raw newsletter's Blob URL; the importer stored them under `legacy/<legacyPath>`. */
export const rawBlobUrl = (base: string, legacyPath: string) =>
  `${base}/legacy/${legacyPath.split('/').map(encodeURIComponent).join('/')}`

/**
 * True when sending a reader to MEDIA_ORIGIN would bring them straight back
 * here. Pre-cutover the origin (www.vh.ma) is another server; after DNS moves,
 * the same value names this site, and a fallback redirect would loop forever.
 */
export function originLoopsBack(origin: string, requestHost: string): boolean {
  const o = new URL(origin).hostname.toLowerCase()
  const r = requestHost.split(':')[0].toLowerCase()
  return o === r || (PRODUCTION_HOSTS.has(o) && PRODUCTION_HOSTS.has(r))
}
