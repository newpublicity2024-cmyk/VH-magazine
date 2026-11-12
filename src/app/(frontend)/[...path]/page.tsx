import { notFound, permanentRedirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

import { Breadcrumbs, type Crumb } from '@/components/Breadcrumbs'
import { JsonLd } from '@/components/JsonLd'
import { ReadingProgress } from '@/components/ReadingProgress'
import { RelatedArticles } from '@/components/RelatedArticles'
import { RichTextBody } from '@/components/RichTextBody'
import { ShareButtons } from '@/components/ShareButtons'
import { VideoEmbed } from '@/components/VideoEmbed'
import { ViewCounter } from '@/components/ViewCounter'
import { formatDate, isoDate } from '@/lib/format'
import { readingMinutes } from '@/lib/reading'
import { getArticleBySlug, getRelatedArticles, getSiteSettings } from '@/lib/queries'
import { articleUrl, categoryPath, categoryUrl } from '@/lib/routes'
import { absoluteUrl, buildMetadata, ogImageUrl, SITE_URL } from '@/lib/seo'
import { SITE } from '@/lib/site'
import { typoFr } from '@/lib/typo-fr'
import type { Article, Category, Media, Tag } from '@/payload-types'

/**
 * The lede is shown only when it was written by hand (DESIGN-SPEC-R3 §5.2). Migrated
 * WordPress excerpts are the opening words of the body, so printing them above the body
 * would make the reader read the first sentence twice.
 */
function isHandwrittenLede(excerpt: string | null | undefined, body: unknown): boolean {
  if (!excerpt) return false
  const norm = (t: string) => t.replace(/\s+/g, ' ').replace(/(\[…\]|\[\.\.\.\]|…|\.\.\.)\s*$/, '').trim().toLowerCase()
  type N = { type?: string; text?: string; children?: N[] }
  const text = (n: N): string => (n.text ?? '') + (n.children ?? []).map(text).join('')
  const first = ((body as { root?: N } | null)?.root?.children ?? []).find((n) => n.type === 'paragraph')
  if (!first) return true
  const head = norm(excerpt).slice(0, 60)
  return !norm(text(first)).startsWith(head)
}

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

  const minutes = readingMinutes(article.body, article.excerpt || '')
  const tags = (article.tags ?? []).filter((t): t is Tag => typeof t === 'object' && t !== null)
  const lede = isHandwrittenLede(article.excerpt, article.body) ? article.excerpt : null

  return (
    <article data-article data-source={absolute} className="pt-8 lg:pt-12">
      <JsonLd data={newsArticle} />
      <JsonLd data={breadcrumbList} />
      <ViewCounter articleId={article.id as number} />
      <ReadingProgress />

      <div className="vh-container">
        <header className="mx-auto max-w-[45rem]">
          <Breadcrumbs items={crumbs} />

          <h1 className="type-h1 text-ink">{typoFr(article.title)}</h1>

          <div className="type-meta mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-meta">
            {category ? (
              <Link data-kicker href={categoryUrl(category as never)} className="vh-kicker-pill type-kicker">
                {category.name}
              </Link>
            ) : null}
            <time data-date dateTime={isoDate(article.publishedAt)}>
              {formatDate(article.publishedAt)}
            </time>
            <span aria-hidden="true">·</span>
            <span data-reading-time>{typoFr(`${minutes} min de lecture`)}</span>
          </div>

          <div className="mt-6 pb-6 hairline-b">
            <ShareButtons url={absolute} title={article.title} />
          </div>
        </header>

        <figure className="mx-auto mt-8 max-w-[60rem]">
          {article.isVideo && article.videoUrl ? (
            <VideoEmbed url={article.videoUrl} title={article.title} />
          ) : image?.url ? (
            <div className="vh-edge bg-canvas-2">
              <Image
                src={image.url}
                alt={image.alt || article.title}
                width={image.width || 1280}
                height={image.height || 720}
                sizes="(min-width: 1024px) 960px, 100vw"
                priority
                fetchPriority="high"
                className="h-auto w-full"
              />
            </div>
          ) : null}
        </figure>

        <div className="mx-auto max-w-[45rem]">
          {lede ? <p className="type-lead mt-8">{typoFr(lede)}</p> : null}

          <div className="mt-8">
            <RichTextBody data={article.body} />
          </div>

          {tags.length > 0 ? (
            <ul aria-label="Mots-clés" className="mt-10 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag.id} className="vh-tag type-copy-sm">
                  {tag.name}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-10 pt-6 hairline-t">
            <ShareButtons url={absolute} title={article.title} />
          </div>
        </div>

        <RelatedArticles articles={related} />
      </div>
    </article>
  )
}
