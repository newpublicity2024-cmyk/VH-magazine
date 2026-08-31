import { query } from '@/lib/db'

/**
 * Full-text search over articles (spec §7).
 *
 * Postgres rather than a hosted index: 8,170 articles is well inside what a GIN
 * index handles, and it avoids a second service, second set of credentials and a
 * sync path that can silently drift from the database.
 *
 * `unaccent` matters more than usual here. The content is French and readers
 * type without accents — "electrique" must find "électrique", "cafe" must find
 * "café". Without unaccent the search looks broken to most of its users.
 *
 * Every value is bound as a parameter. `websearch_to_tsquery` also means a
 * reader can type quotes and minus signs without producing a syntax error, which
 * `to_tsquery` would.
 */

export type SearchHit = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  published_at: string | null
  category_slug: string | null
  parent_slug: string | null
  rank: number
}

export type SearchResult = {
  hits: SearchHit[]
  total: number
  page: number
  totalPages: number
}

export async function searchArticles(
  term: string,
  page = 1,
  pageSize = 12,
): Promise<SearchResult> {
  const trimmed = term.trim()
  if (!trimmed) return { hits: [], total: 0, page: 1, totalPages: 0 }

  const offset = (Math.max(1, page) - 1) * pageSize

  const rows = await query<SearchHit & { total: string }>(
    `
    with q as (
      select websearch_to_tsquery('french', unaccent($1)) as tsq
    )
    select a.id,
           a.title,
           a.slug,
           a.excerpt,
           a.published_at,
           c.slug  as category_slug,
           pc.slug as parent_slug,
           ts_rank(a.search_vector, q.tsq) as rank,
           count(*) over() as total
      from articles a
      cross join q
      left join categories c  on c.id  = a.category_id
      left join categories pc on pc.id = c.parent_id
     where a._status = 'published'
       and a.search_vector @@ q.tsq
     order by rank desc, a.published_at desc
     limit $2 offset $3
    `,
    [trimmed, pageSize, offset],
  )

  const total = rows.length > 0 ? Number(rows[0].total) : 0
  return {
    hits: rows.map(({ total: _t, ...hit }) => hit),
    total,
    page: Math.max(1, page),
    totalPages: Math.ceil(total / pageSize),
  }
}
