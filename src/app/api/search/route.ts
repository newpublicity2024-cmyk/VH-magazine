import { NextResponse, type NextRequest } from 'next/server'

import { formatDate } from '@/lib/format'
import { articleUrlFromPath } from '@/lib/routes'
import { searchArticles } from '@/lib/search'
import { typoFr } from '@/lib/typo-fr'

/** Live results for the search panel (DESIGN-SPEC-R3 §4.4, decision D3). */
const LIMIT = 6
const MIN_CHARS = 2
const MAX_CHARS = 100

/**
 * GET /api/search?q= — at most six hits, shaped for the panel: title (French-set), the
 * article URL from the same helper the router matches, DD/MM/YYYY date, category name and
 * a thumbnail. Under two characters it answers an empty list without touching the
 * database. The term is bound as a parameter in lib/search (websearch_to_tsquery), so
 * operators and quotes in it cannot break or inject into the query.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, MAX_CHARS)
  if (q.length < MIN_CHARS) return NextResponse.json({ hits: [] })

  const result = await searchArticles(q, 1, LIMIT)
  const hits = result.hits.map((h) => ({
    id: h.id,
    title: typoFr(h.title),
    url: articleUrlFromPath([h.parent_slug, h.category_slug].filter(Boolean).join('/'), h.slug),
    date: formatDate(h.published_at),
    category: h.category_name,
    thumb: h.thumb_url,
  }))

  return NextResponse.json(
    { hits },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
