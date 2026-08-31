import { getPayloadClient } from '@/lib/payload'

/**
 * The irregular-redirect map, consumed by middleware.
 *
 * Middleware runs on the edge and cannot use Payload's Local API, so the map is
 * served here and fetched once per runtime.
 *
 * Amendment B5: this carries ONLY one-off redirects. Tag archives, WordPress
 * upload paths and `?p=` permalinks are matched by pattern in middleware and
 * resolved through /api/redirect-lookup instead — inlining ~28k tag rows would
 * push this response into the megabytes and it would be re-fetched on every
 * cold start.
 */
/*
 * Dynamic, not prerendered. A build-time snapshot could never contain a redirect
 * created after deploy — i.e. every redirect the rename hook writes — so the map
 * would silently 404 exactly the URLs it exists to rescue.
 *
 * The database cost is bounded regardless: middleware caches the map in module
 * scope for 5 minutes, so this is hit about once per runtime, not per request.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'redirects',
    limit: 5000,
    depth: 0,
    select: { from: true, to: true, permanent: true },
  })

  const map: Record<string, { to: string; permanent: boolean }> = {}
  for (const row of result.docs as Array<{ from?: string; to?: string; permanent?: boolean }>) {
    // Tag redirects are served by lookup, never inlined (B5).
    if (!row.from || !row.to || row.from.startsWith('/tag/')) continue
    map[row.from] = { to: row.to, permanent: row.permanent !== false }
  }

  return Response.json(map, {
    headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
