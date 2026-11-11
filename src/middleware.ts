import { NextResponse, type NextRequest } from 'next/server'

/**
 * Edge middleware: legacy-URL handling (A3, B5) and staging noindex (B3).
 *
 * Everything here runs on every request, so it is ordered cheapest-first and
 * does no network work at all for the overwhelmingly common case of a normal
 * page view on the production host.
 */

/** Hosts that are the real site. Anything else is staging or a preview (B3). */
const PRODUCTION_HOSTS = new Set(['vh.ma', 'www.vh.ma'])

/** Module-scope cache of the irregular-redirect map, fetched at most once per runtime. */
let redirectMap: Record<string, { to: string; permanent: boolean }> | null = null
let redirectMapFetchedAt = 0
const MAP_TTL_MS = 300_000

async function getRedirectMap(origin: string) {
  const now = Date.now()
  if (redirectMap && now - redirectMapFetchedAt < MAP_TTL_MS) return redirectMap
  try {
    const res = await fetch(`${origin}/redirects-map.json`, { next: { revalidate: 300 } })
    if (!res.ok) return redirectMap ?? {}
    redirectMap = (await res.json()) as Record<string, { to: string; permanent: boolean }>
    redirectMapFetchedAt = now
    return redirectMap
  } catch {
    // A failed map fetch must never take the site down — fall through to a
    // normal response and let the path 404 as it would have anyway.
    return redirectMap ?? {}
  }
}

async function lookupRedirect(origin: string, path: string) {
  try {
    const res = await fetch(`${origin}/api/redirect-lookup?path=${encodeURIComponent(path)}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { to: string | null; permanent?: boolean }
    return data.to ? { to: data.to, permanent: data.permanent !== false } : null
  } catch {
    return null
  }
}

/**
 * B3: anything not served from the real domain is marked noindex.
 *
 * Host-based rather than an env flag, so the temporary Vercel domain is
 * protected during validation and the protection disappears by itself at DNS
 * cutover — there is no flag anyone has to remember to flip.
 */
function applyNoindex(response: NextResponse, host: string): NextResponse {
  const hostname = host.split(':')[0].toLowerCase()
  if (!PRODUCTION_HOSTS.has(hostname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const host = request.headers.get('host') || ''
  const origin = request.nextUrl.origin

  // ── WordPress numeric permalinks: /?p=123 ────────────────────────────────
  const legacyId = searchParams.get('p')
  if (pathname === '/' && legacyId && /^\d+$/.test(legacyId)) {
    const hit = await lookupRedirect(origin, `/?p=${legacyId}`)
    if (hit) {
      return applyNoindex(
        NextResponse.redirect(new URL(hit.to, origin), hit.permanent ? 301 : 302),
        host,
      )
    }
  }

  // ── Legacy WordPress media: /wp-content/uploads/... (B1) ─────────────────
  if (pathname.startsWith('/wp-content/uploads/')) {
    // The handler reads the ORIGINAL pathname: Next delivers a rewritten request
    // to it with the original URL and without this `?path=` (see requestedPath()
    // in the route). The param stays for platforms that do pass it through.
    const url = request.nextUrl.clone()
    url.pathname = '/api/legacy-media'
    url.searchParams.set('path', pathname)
    return applyNoindex(NextResponse.rewrite(url), host)
  }

  // ── Tag archives: /tag/{slug}/ (B5, populated in 2b) ─────────────────────
  if (pathname.startsWith('/tag/')) {
    const hit = await lookupRedirect(origin, pathname)
    if (hit) {
      return applyNoindex(
        NextResponse.redirect(new URL(hit.to, origin), hit.permanent ? 301 : 302),
        host,
      )
    }
  }

  // ── Irregular one-off redirects ──────────────────────────────────────────
  const map = await getRedirectMap(origin)
  const entry = map[pathname]
  if (entry) {
    return applyNoindex(
      NextResponse.redirect(new URL(entry.to, origin), entry.permanent ? 301 : 302),
      host,
    )
  }

  return applyNoindex(NextResponse.next(), host)
}

export const config = {
  /*
   * Skip Next's internals, the Payload admin, and — critically — the endpoints
   * this middleware itself calls.
   *
   * `/redirects-map.json` MUST be excluded. Without it, a page request enters
   * middleware, which fetches the map, and that fetch re-enters middleware,
   * which fetches the map again: unbounded recursion that exhausts the
   * connection pool and returns EAGAIN on the very first page view. Found by
   * smoke test; the failure is total, not gradual.
   *
   * The SEO surfaces are excluded too — they are never redirect targets and
   * never legacy URLs, so running the redirect logic for them is pure waste.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|admin|api/|redirects-map\\.json|sitemap\\.xml|news-sitemap\\.xml|rss\\.xml|robots\\.txt).*)',
  ],
}
