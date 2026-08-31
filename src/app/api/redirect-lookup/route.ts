import { NextResponse } from 'next/server'

import { query } from '@/lib/db'

/**
 * Resolve one legacy path to its redirect target.
 *
 * Exists because middleware cannot query Postgres directly. Amendment B5 routes
 * the high-cardinality legacy shapes (/tag/*, /?p=) here rather than inlining
 * tens of thousands of rows into the redirects map.
 *
 * Returns 404 with a null target when nothing matches, so middleware can fall
 * through to the normal 404 rather than guessing.
 */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path')
  if (!path || !path.startsWith('/')) {
    return NextResponse.json({ to: null }, { status: 400 })
  }

  try {
    const rows = await query<{ to: string; permanent: boolean }>(
      `select "to", permanent from redirects where "from" = $1 limit 1`,
      [path],
    )
    if (rows.length === 0) return NextResponse.json({ to: null }, { status: 404 })
    return NextResponse.json(
      { to: rows[0].to, permanent: rows[0].permanent !== false },
      { headers: { 'cache-control': 'public, s-maxage=3600' } },
    )
  } catch (error) {
    console.error('redirect lookup failed', error)
    return NextResponse.json({ to: null }, { status: 500 })
  }
}
