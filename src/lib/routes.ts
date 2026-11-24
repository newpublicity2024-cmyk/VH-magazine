/**
 * URL construction for VH Magazine.
 *
 * The scheme mirrors the live WordPress site one-for-one, because SEO continuity
 * with 24 years of indexed URLs is the point of the rebuild:
 *
 *   category  →  /category/moteur/            /category/moteur/vh-moteur/
 *   article   →  /{categoryPath}/{slug}/      2 OR 3 segments, per the category depth
 *   issue     →  /sommaire/{slug}/
 *
 * Article paths carry the FULL category hierarchy, so
 *   /moteur/vh-moteur/porsche-licone-sous-pression/
 * and
 *   /actualite-news-express-maroc/{slug}/
 * are both valid shapes. Every helper emits exactly one leading and one trailing
 * slash, matching `trailingSlash: true` in next.config.ts — canonical tags are
 * built from these same helpers so the served URL and the canonical cannot drift.
 *
 * Structurally typed rather than importing payload-types: these are pure string
 * functions, they must be unit-testable without a generated schema, and they are
 * needed by hooks that run before the frontend exists.
 */

export type CategoryLike = {
  slug?: string | null
  parent?: CategoryLike | number | string | null
}

export type ArticleLike = {
  slug?: string | null
  category?: CategoryLike | number | string | null
}

/** Deepest sane category nesting. Also the cycle guard: a category that is its own
 *  ancestor would otherwise spin forever here. */
const MAX_DEPTH = 8

/**
 * Walk the parent chain root-ward and join the slugs: `moteur/vh-moteur`.
 *
 * Only traverses parents that are POPULATED objects — an unresolved relationship
 * (a bare id) terminates the walk. Callers must query with `depth: 2` or deeper;
 * `resolveCategoryPath` in hooks/redirects.ts is the async equivalent for code
 * that only holds ids.
 */
export function categoryPath(category: CategoryLike | number | string | null | undefined): string {
  const segments: string[] = []
  let node: CategoryLike | number | string | null | undefined = category
  let depth = 0

  while (node && typeof node === 'object' && depth < MAX_DEPTH) {
    if (node.slug) segments.unshift(node.slug)
    node = node.parent ?? null
    depth += 1
  }

  return segments.join('/')
}

/** `/category/moteur/vh-moteur/` — nested, matching WordPress's own category archives. */
export function categoryUrl(category: CategoryLike | number | string | null | undefined): string {
  const path = categoryPath(category)
  return path ? `/category/${path}/` : '/'
}

/**
 * Join an already-resolved category path and a slug.
 *
 * Split out from `articleUrl` so the redirect hook — which resolves the parent
 * chain asynchronously through the Local API rather than from a populated doc —
 * builds URLs through exactly the same code path. Two implementations of this
 * join would be two chances to emit a redirect that points at a URL the frontend
 * never renders.
 */
export function articleUrlFromPath(path: string, slug: string | null | undefined): string {
  if (!slug) return '/'
  return path ? `/${path}/${slug}/` : `/${slug}/`
}

/** `/moteur/vh-moteur/porsche-licone-sous-pression/` */
export function articleUrl(article: ArticleLike): string {
  return articleUrlFromPath(categoryPath(article.category), article.slug)
}

/**
 * `/sommaire/vh-201/` — an issue's page. Since N°202 vh.ma presents an issue as an Actu article (categories sommaire +
 * actualite); such an issue carries `article`, and its page is that article's URL. Needs the
 * article populated with its category chain (query issues at depth 3); a bare id falls back to
 * /sommaire/<slug>/, which 301s to the article.
 */
export function issueUrl(issue: { slug?: string | null; article?: ArticleLike | number | null }): string {
  if (issue.article && typeof issue.article === 'object' && issue.article.slug) {
    const url = articleUrl(issue.article)
    if (url.split('/').filter(Boolean).length >= 2) return url
  }
  return issue.slug ? `/sommaire/${issue.slug}/` : '/magazine-maroc/'
}

/** Normalise any path to exactly one leading and one trailing slash. */
export function withTrailingSlash(path: string): string {
  if (!path) return '/'
  if (/^https?:\/\//i.test(path)) return path.endsWith('/') ? path : `${path}/`
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed ? `/${trimmed}/` : '/'
}

/** Static routes referenced from nav, footer and top bar (spec §4). */
export const STATIC_ROUTES = {
  home: '/',
  lesUnes: '/magazine-maroc/',
  contact: '/contact/',
  teamVh: '/rafik-lahlou-team-vh/',
  sondage: '/sondage/',
  vhTv: '/vh-tv/',
  grandAngle: '/vh-grand-angle-2/',
  whosWho: '/who-s-who-les-interviews-de-vh/',
  leLuxe: '/le-luxe/',
  recherche: '/recherche/',
  /**
   * The live site's media-kit link, kept byte-identical. It is a legacy upload
   * URL, so /api/legacy-media resolves it: the imported PDF in Blob, or the old
   * origin while the migrated media are not yet in the database.
   */
  kitMedia: '/wp-content/uploads/2018/02/vh-kit.pdf',
} as const

/** A listing URL with its page: page 1 has no query, so it never duplicates the bare URL. */
export function pagedUrl(base: string, page: number): string {
  return page > 1 ? `${base}?page=${page}` : base
}

/**
 * Articles per page on category listings. Shared by the page and G22. 14, as vh.ma (measured
 * 2026-11-24: every category page lists 14 posts — the spec's 12 was a guess), so a WordPress
 * /category/x/page/N/ link, which the proxy 301s to ?page=N, lands on the same posts.
 */
export const PAGE_SIZE = 14

/**
 * `/category/moteur/?page=2` — page 1 is the bare URL, never `?page=1`.
 *
 * Two URLs for the same page would be duplicate content on a site whose whole
 * purpose is SEO continuity, so page 1 has exactly one address. Paginated pages
 * canonicalise to themselves (not to page 1) so deep pages stay indexable.
 */
export function categoryPageUrl(
  category: CategoryLike | number | string | null | undefined,
  page: number,
): string {
  const base = categoryUrl(category)
  return page > 1 ? `${base}?page=${page}` : base
}

/** `/recherche/?q=porsche` */
export function searchUrl(query: string, page = 1): string {
  const q = `${STATIC_ROUTES.recherche}?q=${encodeURIComponent(query)}`
  return page > 1 ? `${q}&page=${page}` : q
}

/**
 * Legacy URL shapes the middleware must intercept (amendment B5).
 *
 * These are matched by pattern, not carried in the redirects map: at 2b scale
 * there are ~27.8k upload URLs and ~28.6k tag archives, and inlining either
 * would push the map into the megabytes for no benefit.
 */
export const LEGACY_PATTERNS = {
  /** WordPress media, e.g. /wp-content/uploads/2024/03/foo.jpg */
  uploads: /^\/wp-content\/uploads\//,
  /** Tag archives, e.g. /tag/vh-moteur/ */
  tag: /^\/tag\/([^/]+)\/?$/,
} as const

/** True when `?p=123` is the WordPress numeric permalink shape. */
export function legacyPostId(searchParams: URLSearchParams): string | null {
  const p = searchParams.get('p')
  return p && /^\d+$/.test(p) ? p : null
}

/** `/tag/vh-moteur/` → `vh-moteur`, else null. */
export function tagSlugFromPath(pathname: string): string | null {
  const m = LEGACY_PATTERNS.tag.exec(pathname)
  return m ? m[1] : null
}
