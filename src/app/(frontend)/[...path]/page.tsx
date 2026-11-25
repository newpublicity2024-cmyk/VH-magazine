import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'

import { ArticleView } from '@/components/ArticleView'
import { getArticleBySlug, getCategoryBySlug, getRelatedArticles, getSiteSettings } from '@/lib/queries'
import { articleUrl, categoryUrl } from '@/lib/routes'
import { buildMetadata, ogImageUrl } from '@/lib/seo'
import type { Article, Category, Media } from '@/payload-types'

/** Spec §9: articles are static with on-demand revalidation. */
export const revalidate = 3600

/**
 * Without generateStaticParams, Next renders a dynamic segment on EVERY request whatever
 * `revalidate` says: the build listed no ISR route, and Vercel answered each article
 * `private, no-store` in ~1 s (measured on the production deployment, 2026-11-19). An empty
 * list prebuilds nothing — 8k articles would slow every deploy — and lets each article render
 * on its first request, then be served from the ISR cache until `revalidate` or the publish
 * hook (`revalidatePath('/', 'layout')`, hooks/revalidate.ts) expires it. Redirects stay
 * correct: the proxy runs ahead of the page cache.
 */
export async function generateStaticParams(): Promise<{ path: string[] }[]> {
  return []
}

type Params = { params: Promise<{ path: string[] }> }

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

const asCategory = (v: unknown): Category | null =>
  v && typeof v === 'object' && 'slug' in (v as Category) ? (v as Category) : null

/**
 * Resolve the requested path to an article.
 *
 * The LAST segment is the slug; everything before it is the claimed category
 * path. Returning the article plus its true canonical URL lets the page decide
 * between rendering and redirecting — the check must not live in two places.
 */
async function resolve(segments: string[]) {
  // A bare /slug/ is not a valid article URL on this site: every article sits
  // under at least one category segment. Rejecting length < 2 here stops the
  // catch-all from answering for arbitrary single-segment paths that should 404.
  if (segments.length < 2 || segments.length > 3) return null

  const slug = segments[segments.length - 1]
  const article = await getArticleBySlug(slug)
  if (!article) return null

  return { article, canonical: articleUrl(article as never) }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { path } = await params
  const found = await resolve(path)
  if (!found) return { title: 'Page introuvable' }

  const { article, canonical } = found
  const settings = await getSiteSettings().catch(() => null)
  const seo = (article as Article & { seo?: { title?: string; description?: string; noIndex?: boolean } }).seo

  return buildMetadata({
    title: seo?.title || article.title,
    description: seo?.description || article.excerpt,
    // Always the canonical path, never the requested one — a wrong-category URL
    // that somehow reached rendering must still declare the real address.
    path: canonical,
    image: ogImageUrl(asMedia(article.featuredImage), asMedia(settings?.defaultOgImage)),
    type: 'article',
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    section: asCategory(article.category)?.name,
    noIndex: seo?.noIndex,
  })
}

export default async function ArticlePage({ params }: Params) {
  const { path } = await params
  // vh.ma serves every category archive at its bare slug (/le-luxe/ is the homepage Le Luxe
  // banner's link): send it to the category's address here. Any other single segment 404s below.
  if (path.length === 1) {
    const category = await getCategoryBySlug(path[0])
    if (category) permanentRedirect(categoryUrl(category as never))
  }
  const found = await resolve(path)
  if (!found) notFound()

  const { article, canonical } = found
  const requested = `/${path.join('/')}/`

  // Amendment B4: a wrong-category path permanently redirects to the canonical
  // URL, not a 404. Mirrors WordPress/Yoast canonical-redirect behaviour and
  // recovers equity from malformed legacy backlinks. Safe from looping because
  // `canonical` comes from the same helper the router matches against, so the
  // target compares equal on the next request.
  //
  // STATUS NOTE: this emits 308, not the 301 the amendment names. Next's
  // permanentRedirect() is 308 and a Server Component cannot set an arbitrary
  // status; a true 301 would mean moving this check into middleware, which
  // would cost a database lookup on every article view to catch a rare
  // malformed URL. Google and Bing both document 308 as equivalent to 301 for
  // canonicalisation, so the SEO outcome is the same. Flagged for the owner.

  if (requested !== canonical) permanentRedirect(canonical)

  const category = asCategory(article.category)
  const related = category
    ? await getRelatedArticles(article.id as number, category.id as number, 3)
    : []

  return <ArticleView article={article as Article} canonical={canonical} related={related} />
}
