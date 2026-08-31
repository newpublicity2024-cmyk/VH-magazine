import { NextResponse } from 'next/server'

import { query } from '@/lib/db'

/**
 * Increment an article's view count.
 *
 * Not a Server Action because it is called with `keepalive` from an effect and
 * must survive the reader navigating away mid-flight.
 *
 * The increment is a single atomic SQL statement rather than a
 * read-modify-write through the Local API: two concurrent readers would
 * otherwise both read N and both write N+1, losing a view. It also bypasses
 * Payload's hooks, which matters because the revalidate hook would bust the
 * entire site's cache on every single page view.
 */

// Per-IP+article throttle. In-memory is adequate here: the client already
// dedupes via sessionStorage, this is only the backstop against one abusive
// source, and on serverless each instance holding its own window is a fine
// approximation for a vanity metric.
const WINDOW_MS = 60_000
const recent = new Map<string, number>()

function throttled(key: string): boolean {
  const now = Date.now()
  const last = recent.get(key)
  if (last && now - last < WINDOW_MS) return true
  recent.set(key, now)
  // Opportunistic sweep so the map cannot grow without bound.
  if (recent.size > 5000) {
    for (const [k, t] of recent) if (now - t > WINDOW_MS) recent.delete(k)
  }
  return false
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const id = Number((body as { articleId?: unknown })?.articleId)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  if (throttled(`${ip}:${id}`)) {
    // Deliberately 200: a throttled view is not an error worth retrying, and
    // telling a caller which views were counted invites probing.
    return NextResponse.json({ ok: true, counted: false })
  }

  try {
    const rows = await query<{ view_count: number }>(
      `update articles
          set view_count = coalesce(view_count, 0) + 1
        where id = $1 and _status = 'published'
        returning view_count`,
      [id],
    )
    if (rows.length === 0) return NextResponse.json({ ok: false }, { status: 404 })
    return NextResponse.json({ ok: true, counted: true, viewCount: rows[0].view_count })
  } catch (error) {
    console.error('view increment failed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
