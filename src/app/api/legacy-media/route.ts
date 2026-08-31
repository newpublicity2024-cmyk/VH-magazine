import { NextResponse } from 'next/server'

/**
 * Legacy WordPress media handler (amendment B1).
 *
 * ~27.8k `/wp-content/uploads/*` URLs are indexed and linked from elsewhere on
 * the web. They must keep resolving after cutover, but bulk-downloading 4 GB at
 * ~22 KB/s is not a cutover step anyone can wait for. So the file migrates on
 * first request instead, and the validation window doubles as the warm-up.
 *
 * The upstream host comes from MEDIA_ORIGIN and is never hardcoded, so it can
 * be repointed at an origin IP or old.vh.ma if the old server moves.
 *
 * Redirect status is deliberate:
 *   - persisted to Blob  → 301, the new URL is now permanent
 *   - not yet persisted  → 302, because a 301 to the OLD host would be cached
 *     by browsers and crawlers and would outlive the old server entirely.
 * Getting that backwards would pin readers to a host that is about to be
 * switched off, which is unrecoverable without waiting out their caches.
 *
 * Persistence itself lands with the 2b media work (it needs a Blob token); this
 * round guarantees the URLs resolve.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path')

  if (!path || !path.startsWith('/wp-content/uploads/') || path.includes('..')) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 })
  }

  const origin = process.env.MEDIA_ORIGIN
  if (!origin) {
    return NextResponse.json({ error: 'MEDIA_ORIGIN not configured' }, { status: 503 })
  }

  // TODO(2b): look the path up in Blob first and 301 when it is already stored;
  // otherwise fetch, persist, then 301. Until then, point at the live origin.
  const upstream = new URL(path, origin).toString()
  return NextResponse.redirect(upstream, 302)
}
