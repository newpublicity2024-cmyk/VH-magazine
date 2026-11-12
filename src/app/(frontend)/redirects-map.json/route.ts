import { query } from '@/lib/db'

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
  // Filtered in SQL, never fetch-then-filter: at migration scale the table holds ~36k rows
  // (8k `/?p=` + 28k `/tag/`), so a capped fetch would silently cut one-off redirects and
  // inline `?p=` rows that can never match — middleware keys this map by pathname, and a
  // `?p=` lives in the query string (it is served by /api/redirect-lookup).
  const rows = await query<{ from: string; to: string; permanent: boolean | null }>(
    `select "from", "to", permanent from redirects
      where "from" not like '/tag/%' and "from" not like '/?p=%'`,
  )
  const map: Record<string, { to: string; permanent: boolean }> = {}
  for (const row of rows) {
    if (!row.from || !row.to) continue
    map[row.from] = { to: row.to, permanent: row.permanent !== false }
  }
  return Response.json(map, {
    headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
