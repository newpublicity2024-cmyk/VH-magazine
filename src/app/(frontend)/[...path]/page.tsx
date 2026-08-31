import { notFound, permanentRedirect } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'

import { Breadcrumbs, type Crumb } from '@/components/Breadcrumbs'
import { JsonLd } from '@/components/JsonLd'
import { RelatedArticles } from '@/components/RelatedArticles'
import { RichTextBody } from '@/components/RichTextBody'
import { ShareButtons } from '@/components/ShareButtons'
import { VideoEmbed } from '@/components/VideoEmbed'
import { ViewCounter } from '@/components/ViewCounter'
import { formatDate, isoDate } from '@/lib/format'
import { getArticleBySlug, getRelatedArticles, getSiteSettings } from '@/lib/queries'
import { articleUrl, categoryPath, categoryUrl } from '@/lib/routes'
import { absoluteUrl, buildMetadata, ogImageUrl, SITE_URL } from '@/lib/seo'
import { SITE } from '@/lib/site'
import type { Article, Category, Media } from '@/payload-types'

/** Spec §9: articles are static with on-demand revalidation. */
export const revalidate = 3600

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
  const image = asMedia(article.featuredImage)

  const related = category
    ? await getRelatedArticles(article.id as number, category.id as number, 3)
    : []

  const crumbs: Crumb[] = [{ label: 'Accueil', href: '/' }]
  if (category) {
    // Walk the chain root-ward so a nested article gets Moteur › VH Moteur.
    const chain: Category[] = []
    let node: unknown = category
    while (node && typeof node === 'object' && 'slug' in (node as Category)) {
      chain.unshift(node as Category)
      node = (node as Category).parent
    }
    for (const c of chain) crumbs.push({ label: c.name, href: categoryUrl(c as never) })
  }
  crumbs.push({ label: article.title, href: canonical })

  const absolute = absoluteUrl(canonical)

  const newsArticle = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt || undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absolute },
    url: absolute,
    image: image?.url ? [absoluteUrl(image.url)] : undefined,
    articleSection: category?.name,
    inLanguage: 'fr',
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/vh-logo.svg` },
    },
  }

  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: absoluteUrl(c.href),
    })),
  }

  return (
    <article data-article className="vh-container py-6">
      <JsonLd data={newsArticle} />
      <JsonLd data={breadcrumbList} />
      <ViewCounter articleId={article.id as number} />

      <div className="mx-auto max-w-3xl">
        <Breadcrumbs items={crumbs} />

        <h1 className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
          {article.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
          {category ? (
            <span className="bg-vh-red px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
              {category.name}
            </span>
          ) : null}
          <time data-date dateTime={isoDate(article.publishedAt)} className="text-[12px] text-meta">
            {formatDate(article.publishedAt)}
          </time>
          <div className="ms-auto">
            <ShareButtons url={absolute} title={article.title} />
          </div>
        </div>

        {article.isVideo && article.videoUrl ? (
          <div className="mt-6">
            <VideoEmbed url={article.videoUrl} title={article.title} />
          </div>
        ) : image?.url ? (
          <Image
            src={image.url}
            alt={image.alt || article.title}
            width={image.width || 1280}
            height={image.height || 720}
            sizes="(min-width: 1024px) 768px, 100vw"
            priority
            fetchPriority="high"
            className="mt-6 h-auto w-full"
          />
        ) : null}

        {article.excerpt ? (
          <p className="mt-6 text-lg leading-relaxed text-ink-soft/90">{article.excerpt}</p>
        ) : null}

        <div className="mt-6">
          <RichTextBody data={article.body} />
        </div>
      </div>

      <RelatedArticles articles={related} />
    </article>
  )
}
