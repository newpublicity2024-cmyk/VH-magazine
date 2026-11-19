import { query } from '@/lib/db'
import { mediaFileUrl } from '@/lib/media-url'

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
  /**
   * For a hit without a hand-written excerpt (most of the migrated archive): the passage of the
   * body around the matched words, plain text, or its opening when the words are not found as
   * typed (the index folds accents; ts_headline matches the term as the reader spelled it).
   * Null when snippets were not asked for or the body has no text.
   */
  snippet: string | null
  published_at: string | null
  category_slug: string | null
  parent_slug: string | null
  category_name: string | null
  /** The 160 px square rendition when it exists, else the original. */
  thumb_url: string | null
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
  { snippets = true }: { snippets?: boolean } = {},
): Promise<SearchResult> {
  const trimmed = term.trim()
  if (!trimmed) return { hits: [], total: 0, page: 1, totalPages: 0 }

  const offset = (Math.max(1, page) - 1) * pageSize

  // The thumbnail is read as a FILENAME and turned into a URL here: SQL bypasses Payload's
  // afterRead hooks, and the stored `url` column is the proxy path written at import time,
  // not the direct Blob URL the site serves (media-url.ts, gate GATES-LAUNCH L6).
  const rows = await query<
    Omit<SearchHit, 'thumb_url' | 'snippet'> & { thumb_file: string | null; snippet: string | null; total: string }
  >(
    `
    with q as (
      select websearch_to_tsquery('french', unaccent($1)) as tsq
    ),
    hits as (
      select a.id,
             a.title,
             a.slug,
             a.excerpt,
             a.published_at,
             c.slug  as category_slug,
             pc.slug as parent_slug,
             c.name  as category_name,
             coalesce(m.sizes_thumb_filename, m.filename) as thumb_file,
             ts_rank(a.search_vector, q.tsq) as rank,
             count(*) over() as total
        from articles a
        cross join q
        left join categories c  on c.id  = a.category_id
        left join categories pc on pc.id = c.parent_id
        left join media m on m.id = a.featured_image_id
       where a._status = 'published'
         and a.search_vector @@ q.tsq
       order by rank desc, a.published_at desc
       limit $2 offset $3
    )
    -- The snippet is computed for this page's rows only, after the limit: ts_headline
    -- re-parses a whole body, which over every match would cost more than the search.
    select hits.*,
           case when $4::boolean and coalesce(hits.excerpt, '') = '' then
             nullif(ts_headline('french', vh_lexical_text(a.body), websearch_to_tsquery('french', $1),
                                'MaxWords=32, MinWords=16, MaxFragments=1, StartSel="", StopSel=""'), '')
           end as snippet
      from hits
      join articles a on a.id = hits.id
     order by hits.rank desc, hits.published_at desc
    `,
    [trimmed, pageSize, offset, snippets],
  )

  const total = rows.length > 0 ? Number(rows[0].total) : 0
  return {
    hits: rows.map(({ total: _t, thumb_file, ...hit }) => ({
      ...hit,
      thumb_url: thumb_file ? mediaFileUrl(thumb_file) : null,
    })),
    total,
    page: Math.max(1, page),
    totalPages: Math.ceil(total / pageSize),
  }
}
