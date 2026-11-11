import { query } from '@/lib/db'
import {
  blobBaseUrl,
  blobFileUrl,
  candidatePaths,
  decodeLegacyPath,
  isOriginFallbackCandidate,
  isRawHtml,
  originLoopsBack,
  rawBlobUrl,
} from '@/lib/legacy-media'

/**
 * Legacy WordPress uploads: `/wp-content/uploads/*` (B1, round 2b phase P4).
 *
 * Middleware rewrites every such request here with `?path=<pathname as sent>`.
 * The media were bulk-imported into Payload Media + Blob (P3), so instead of
 * migrating on first request as round 2a planned, each URL resolves at once:
 *
 *   imported original, or a WP size variant of one  → 301 to its Blob URL
 *   old HTML newsletter                             → 200, served inline, sandboxed
 *   media-like but not imported                     → 302 to MEDIA_ORIGIN
 *   anything else, or the origin would loop back    → 404
 *
 * 301 only for a file that is really in Blob: a permanent redirect to the OLD
 * host would be cached by browsers and crawlers and outlive that server.
 */
export const dynamic = 'force-dynamic'

/** A legacy path's Blob target only changes if an editor deletes the file. */
const PERMANENT_CACHE = 'public, max-age=86400, s-maxage=2592000'
/** Misses can turn into hits when P6 syncs late uploads; keep them short. */
const MISS_CACHE = 'public, max-age=60, s-maxage=300'

/**
 * Newsletters are email HTML from the old site. Served from this origin, any
 * script in one would run as vh.ma — the reason they never became Media rows.
 * `sandbox` without allow-scripts / allow-same-origin gives the document an
 * opaque origin with scripts, forms and popups disabled; images and styles,
 * which is all an email layout needs, still load.
 */
const NEWSLETTER_CSP =
  "sandbox; default-src 'none'; img-src * data:; style-src * 'unsafe-inline'; font-src * data:; media-src *"

const redirect = (location: string, status: 301 | 302, cache: string) =>
  new Response(null, { status, headers: { location, 'cache-control': cache } })

async function findMedia(legacyPath: string) {
  const candidates = candidatePaths(legacyPath)
  const rows = await query<{ legacy_path: string; filename: string }>(
    `select legacy_path, filename from media
      where legacy_path = any($1::text[]) and filename is not null`,
    [candidates],
  )
  for (const c of candidates) {
    const row = rows.find((r) => r.legacy_path === c)
    if (row) return row
  }
  return null
}

/**
 * Blob serves these with `Content-Disposition: attachment` (it does so for all
 * HTML), so a redirect would download them where the old site displayed them.
 * Proxy instead: ~166 small files, rarely requested, cached at the edge.
 */
async function serveNewsletter(base: string, legacyPath: string): Promise<Response | null> {
  const upstream = await fetch(rawBlobUrl(base, legacyPath), { cache: 'no-store' })
  if (upstream.status !== 200 || !upstream.body) {
    await upstream.body?.cancel()
    return null
  }
  const headers = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': NEWSLETTER_CSP,
    'x-content-type-options': 'nosniff',
    'cache-control': PERMANENT_CACHE,
  })
  const length = upstream.headers.get('content-length')
  if (length) headers.set('content-length', length)
  return new Response(upstream.body, { status: 200, headers })
}

function fallback(request: Request, rawPath: string, legacyPath: string, cache: string): Response {
  const origin = process.env.MEDIA_ORIGIN
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  if (origin && isOriginFallbackCandidate(legacyPath) && !originLoopsBack(origin, host)) {
    // rawPath keeps the reader's own percent-encoding, so the old server
    // receives exactly the bytes it would have received directly.
    return redirect(new URL(rawPath, origin).toString(), 302, cache)
  }
  return new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': cache },
  })
}

/**
 * The legacy path, percent-encoded as the reader sent it.
 *
 * After middleware's rewrite, Next hands this handler the ORIGINAL request URL —
 * `request.url` and `nextUrl` both read `/wp-content/uploads/...`, and the
 * `?path=` the rewrite added is not there at all. Reading only `?path=` made
 * every legacy upload a 400 (found by G40). So the original pathname wins when
 * it is an uploads path; `?path=` remains for direct calls and for a platform
 * that does pass the rewritten URL through.
 */
function requestedPath(request: Request): string | null {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/wp-content/uploads/')) return url.pathname
  return url.searchParams.get('path')
}

export async function GET(request: Request) {
  const rawPath = requestedPath(request)
  const legacyPath = rawPath ? decodeLegacyPath(rawPath) : null
  if (!rawPath || !legacyPath) {
    return Response.json({ error: 'bad path' }, { status: 400 })
  }

  const base = blobBaseUrl()
  try {
    if (isRawHtml(legacyPath)) {
      const page = base ? await serveNewsletter(base, legacyPath) : null
      if (page) return page
    } else {
      const hit = await findMedia(legacyPath)
      if (hit && base) return redirect(blobFileUrl(base, hit.filename), 301, PERMANENT_CACHE)
      // No Blob configured (local dev on disk): Payload serves the file itself.
      // 302, since the target changes the moment Blob is configured.
      if (hit) return redirect(`/api/media/file/${encodeURIComponent(hit.filename)}`, 302, MISS_CACHE)
    }
  } catch (error) {
    // A database or Blob hiccup must not break every legacy image on the page:
    // degrade to the old origin, and keep the response out of every cache.
    console.error('legacy media lookup failed', error)
    return fallback(request, rawPath, legacyPath, 'no-store')
  }
  return fallback(request, rawPath, legacyPath, MISS_CACHE)
}
