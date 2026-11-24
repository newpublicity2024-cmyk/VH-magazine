import { cache } from 'react'
import type { Where } from 'payload'

import { getPayloadClient } from '@/lib/payload'
import { categoryPath, issueUrl } from '@/lib/routes'
import type { Article, Author, Banner, Category, Homepage, MagazineIssue, SiteSetting } from '@/payload-types'

/**
 * Read layer for the frontend. Everything goes through the Payload Local API
 * (never REST), wrapped in React `cache` so a page that asks for the same data
 * twice in one render costs one query.
 *
 * `depth: 2` is not incidental: article URLs carry the full category hierarchy,
 * so `article.category.parent` must arrive populated or `categoryPath()` stops
 * at the child and silently emits a 2-segment URL where a 3-segment one is
 * correct. Depth 2 covers category → parent; the MAX_DEPTH walk in routes.ts
 * tolerates deeper trees by terminating at the first unpopulated ancestor.
 */

/**
 * Newest first; equal dates (17 publication times are shared by several articles) in import
 * order, which follows WordPress's ids — as vh.ma lists them (2023-11-05 15:06 Essai DS4 pair).
 */
const BY_DATE = ['-publishedAt', 'id']

/** Fields the card components actually read. Keeps the body out of list queries. */
const CARD_SELECT = {
  title: true,
  slug: true,
  excerpt: true,
  featuredImage: true,
  category: true,
  publishedAt: true,
  viewCount: true,
  isVideo: true,
  videoUrl: true,
} as const

/**
 * A category and all its descendants, at every depth — WordPress's category archive includes
 * posts filed in any subcategory, so the listings here do too.
 */
async function categoryTreeIds(slug: string): Promise<number[]> {
  const payload = await getPayloadClient()

  const root = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  if (root.docs.length === 0) return []

  const all = await payload.find({ collection: 'categories', limit: 1000, depth: 0, pagination: false })
  const children = new Map<number, number[]>()
  for (const c of all.docs) {
    const parent = typeof c.parent === 'object' && c.parent ? c.parent.id : c.parent
    if (typeof parent === 'number') children.set(parent, [...(children.get(parent) ?? []), c.id as number])
  }
  const ids = [root.docs[0].id as number]
  for (let i = 0; i < ids.length; i++) ids.push(...(children.get(ids[i]) ?? []))
  return ids
}

/**
 * Articles that present a magazine issue (N°202 onwards, linked from the issue). vh.ma's homepage
 * category blocks leave them out — N°203 is in Actu's category page but not in the homepage's Actu
 * block (measured 2026-11-24) — and show them in "En kiosque" and "Toutes nos unes" instead.
 */
const getIssueArticleIds = cache(async (): Promise<number[]> => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'magazine-issues',
    where: { article: { exists: true } },
    limit: 500,
    depth: 0,
    select: { article: true },
  })
  return res.docs
    .map((d) => (typeof d.article === 'object' && d.article ? d.article.id : d.article))
    .filter((id): id is number => typeof id === 'number')
})

/**
 * Membership in a category tree, as WordPress counts it: the article's own category (the one
 * its URL uses) OR any of its other categories (`secondaryCategories`).
 */
function inCategories(ids: number[]): Where {
  return { or: [{ category: { in: ids } }, { secondaryCategories: { in: ids } }] }
}

/**
 * Latest N published articles in a category AND its subcategories.
 *
 * The subcategory rollup is why the Moteur block still shows the Porsche piece
 * even though it is filed under moteur/vh-moteur — which is how the live site
 * behaves, and what makes the nested URL visible on the homepage at all.
 */
export const getArticlesByCategory = cache(
  async (slug: string, limit: number, withoutIssueArticles = false): Promise<Article[]> => {
    const ids = await categoryTreeIds(slug)
    if (ids.length === 0) return []

    const payload = await getPayloadClient()
    const skip = withoutIssueArticles ? await getIssueArticleIds() : []
    const result = await payload.find({
      collection: 'articles',
      where: {
        and: [
          inCategories(ids),
          { _status: { equals: 'published' } },
          ...(skip.length ? [{ id: { not_in: skip } }] : []),
        ],
      },
      sort: BY_DATE,
      limit,
      depth: 2,
      select: CARD_SELECT,
    })
    return result.docs as Article[]
  },
)

/** A card in a sidebar list; `href` set when it is not an article (an issue among the most read). */
export type RankedArticle = Article & { href?: string }

/**
 * Most-read across all categories (spec §5.4.5). As on vh.ma, magazine issues rank too (its
 * "Les plus lus" lists N°198): both counters are vh.ma's own, imported by the migration.
 */
export const getMostRead = cache(async (limit: number): Promise<RankedArticle[]> => {
  const payload = await getPayloadClient()
  const [articles, issues] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { _status: { equals: 'published' } },
      // Ties (vh.ma shows views rounded to 0.1K) go to the newer article, deterministically.
      sort: ['-viewCount', '-publishedAt'],
      limit,
      depth: 2,
      select: CARD_SELECT,
    }),
    payload.find({
      collection: 'magazine-issues',
      where: { viewCount: { greater_than: 0 } },
      sort: ['-viewCount', '-publishedAt'],
      limit,
      depth: ISSUE_DEPTH,
    }),
  ])
  const ranked: { views: number; date: string; card: RankedArticle }[] = [
    ...(articles.docs as Article[]).map((a) => ({ views: a.viewCount ?? 0, date: a.publishedAt ?? '', card: a })),
    ...(issues.docs as MagazineIssue[]).map((i) => ({
      views: i.viewCount ?? 0,
      date: i.publishedAt,
      card: {
        id: -i.id,
        title: i.title,
        slug: i.slug,
        featuredImage: i.cover,
        publishedAt: i.publishedAt,
        category: null,
        viewCount: i.viewCount,
        href: issueUrl(i),
      } as unknown as RankedArticle,
    })),
  ]
  ranked.sort((a, b) => b.views - a.views || b.date.localeCompare(a.date))
  return ranked.slice(0, limit).map((r) => r.card)
})

/** Latest across all categories (spec §5.4.6). */
export const getLatestArticles = cache(async (limit: number): Promise<Article[]> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: { _status: { equals: 'published' } },
    sort: BY_DATE,
    limit,
    depth: 2,
    select: CARD_SELECT,
  })
  return result.docs as Article[]
})

/**
 * Issues load at depth 3: an issue presented by an article (N°202 onwards) links to that
 * article's URL, which needs article → category → parent populated (issueUrl in routes.ts).
 */
const ISSUE_DEPTH = 3

/** Latest magazine issues (spec §5.13; the sidebar's "En kiosque" is the first). */
export const getIssues = cache(async (limit: number): Promise<MagazineIssue[]> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'magazine-issues',
    sort: '-number',
    limit,
    depth: ISSUE_DEPTH,
  })
  return result.docs as MagazineIssue[]
})

/**
 * Every active banner, keyed by slot.
 *
 * One query rather than seven: the homepage needs all of them, and a per-slot
 * lookup would mean seven round trips for what is a handful of rows.
 */
export const getBanners = cache(async (): Promise<Record<string, Banner>> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'banners',
    where: { active: { equals: true } },
    limit: 50,
    depth: 1,
  })
  const byKey: Record<string, Banner> = {}
  for (const doc of result.docs as Banner[]) {
    if (doc.key) byKey[doc.key] = doc
  }
  return byKey
})

/** Curated homepage slots: chroniques cigare picks and the dossier strips. */
export const getHomepageGlobal = cache(async (): Promise<Homepage> => {
  const payload = await getPayloadClient()
  return (await payload.findGlobal({ slug: 'homepage', depth: 2 })) as Homepage
})

/**
 * The Grand Angle page's curated dossiers, in order (vh.ma's page is hand-arranged). Depth 3:
 * global → article → category → parent, for the article URLs. Empty when not curated.
 */
export const getGrandAngleDossiers = cache(async (): Promise<Article[]> => {
  const payload = await getPayloadClient()
  const g = await payload.findGlobal({ slug: 'grand-angle', depth: 3 })
  return ((g.dossiers ?? []) as (Article | number)[]).filter(
    (a): a is Article => typeof a === 'object' && a !== null && a._status === 'published',
  )
})

export const getSiteSettings = cache(async (): Promise<SiteSetting> => {
  const payload = await getPayloadClient()
  return (await payload.findGlobal({ slug: 'site-settings', depth: 1 })) as SiteSetting
})

/** The nav categories (spec §4.2), resolved once for the header. */
export const getNavCategories = cache(async (): Promise<Record<string, Category>> => {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'categories', limit: 100, depth: 1 })
  const bySlug: Record<string, Category> = {}
  for (const doc of result.docs as Category[]) {
    if (doc.slug) bySlug[doc.slug] = doc
  }
  return bySlug
})

/**
 * Resolve one published article by slug, with its category chain populated.
 *
 * `depth: 2` is load-bearing: the catch-all route rebuilds the canonical path
 * from `article.category.parent` to decide whether the requested URL matches.
 * At depth 1 the parent arrives as a bare id, `categoryPath` stops at the child,
 * and every 3-segment URL would 301 to a 2-segment one that does not exist.
 */
export const getArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
  })
  return (result.docs[0] as Article) ?? null
})

/** Resolve a category from its full nested path segments, e.g. ['moteur','vh-moteur']. */
export const getCategoryByPath = cache(async (segments: string[]): Promise<Category | null> => {
  if (segments.length === 0) return null
  const payload = await getPayloadClient()

  // Match on the LAST segment, then verify the ancestry rebuilds to the same
  // path. Two categories may share a leaf slug under different parents, so the
  // slug alone is not an identifier — the full path is.
  const result = await payload.find({
    collection: 'categories',
    where: { slug: { equals: segments[segments.length - 1] } },
    limit: 10,
    depth: 3,
  })

  const wanted = segments.join('/')
  for (const doc of result.docs as Category[]) {
    if (categoryPath(doc as never) === wanted) return doc
  }
  return null
})

/** One page of published articles in a category and its descendants. */
export const getCategoryPage = cache(
  async (slug: string, page: number, pageSize: number): Promise<PagedArticles> => {
    const ids = await categoryTreeIds(slug)
    if (ids.length === 0) return { docs: [], totalDocs: 0, totalPages: 0, page }

    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'articles',
      where: { and: [inCategories(ids), { _status: { equals: 'published' } }] },
      sort: BY_DATE,
      limit: pageSize,
      page,
      depth: 2,
      select: CARD_SELECT,
    })
    return {
      docs: result.docs as Article[],
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
      page: result.page ?? page,
    }
  },
)

/** A byline by its slug (vh.ma's /author/<slug>/). */
export const getAuthorBySlug = cache(async (slug: string): Promise<Author | null> => {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'authors', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  return (res.docs[0] as Author) ?? null
})

/** One page of a byline's published articles, newest first — vh.ma's author archive. */
export const getAuthorPage = cache(
  async (authorId: number, page: number, pageSize: number): Promise<PagedArticles> => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'articles',
      where: { and: [{ signature: { equals: authorId } }, { _status: { equals: 'published' } }] },
      sort: BY_DATE,
      limit: pageSize,
      page,
      depth: 2,
      select: CARD_SELECT,
    })
    return { docs: result.docs as Article[], totalDocs: result.totalDocs, totalPages: result.totalPages, page: result.page ?? page }
  },
)

export type PagedArticles = {
  docs: Article[]
  totalDocs: number
  totalPages: number
  page: number
}

/** Articles related to `article`, same category, excluding itself (spec §7). */
export const getRelatedArticles = cache(
  async (articleId: number, categoryId: number, limit: number): Promise<Article[]> => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'articles',
      where: {
        and: [
          { category: { equals: categoryId } },
          { id: { not_equals: articleId } },
          { _status: { equals: 'published' } },
        ],
      },
      sort: BY_DATE,
      limit,
      depth: 2,
      select: CARD_SELECT,
    })
    return result.docs as Article[]
  },
)

/** Every published article, for sitemap and RSS. Paged internally — 8k rows in 2b. */
export async function getAllPublishedArticles(): Promise<Article[]> {
  const payload = await getPayloadClient()
  const out: Article[] = []
  let page = 1
  for (;;) {
    const res = await payload.find({
      collection: 'articles',
      where: { _status: { equals: 'published' } },
      sort: BY_DATE,
      limit: 500,
      page,
      depth: 2,
      select: { slug: true, title: true, category: true, publishedAt: true, updatedAt: true, excerpt: true },
    })
    out.push(...(res.docs as Article[]))
    if (!res.hasNextPage) break
    page += 1
  }
  return out
}

/** Every category, for the sitemap. */
export const getAllCategories = cache(async (): Promise<Category[]> => {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'categories', limit: 500, depth: 3 })
  return res.docs as Category[]
})

/** One magazine issue by slug. */
export const getIssueBySlug = cache(async (slug: string): Promise<MagazineIssue | null> => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'magazine-issues',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: ISSUE_DEPTH,
  })
  return (res.docs[0] as MagazineIssue) ?? null
})

/** All issues, newest first, for the Les Unes archive. */
export const getAllIssues = cache(async (): Promise<MagazineIssue[]> => {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'magazine-issues', sort: '-number', limit: 500, depth: ISSUE_DEPTH })
  return res.docs as MagazineIssue[]
})
