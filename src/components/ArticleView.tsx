import Image from 'next/image'
import Link from 'next/link'

import { Breadcrumbs, type Crumb } from '@/components/Breadcrumbs'
import { JsonLd } from '@/components/JsonLd'
import { ReadingProgress } from '@/components/ReadingProgress'
import { RelatedArticles } from '@/components/RelatedArticles'
import { RichTextBody } from '@/components/RichTextBody'
import { ShareButtons } from '@/components/ShareButtons'
import { VideoEmbed } from '@/components/VideoEmbed'
import { ViewCounter } from '@/components/ViewCounter'
import { WithSidebar } from '@/components/WithSidebar'
import { formatDate, isoDate } from '@/lib/format'
import { readingMinutes } from '@/lib/reading'
import { authorUrl, categoryUrl } from '@/lib/routes'
import { absoluteFileUrl, absoluteUrl, SITE_URL } from '@/lib/seo'
import { SITE } from '@/lib/site'
import { typoFr } from '@/lib/typo-fr'
import type { Article, Author, Category, Media, Tag } from '@/payload-types'

/**
 * The article page's body — shared by the public route (`[...path]`) and the back office's
 * draft preview (`/apercu/[id]/`), so « Aperçu » shows exactly what publishing will show.
 *
 * `preview` drops what must only exist on the public URL: the structured data (a draft is not
 * a NewsArticle anywhere) and the view counter (an editor reading a draft is not a reader).
 * Everything else — markup, classes, images, the body renderer, the side panel beside the
 * article (as on vh.ma, 2026-11-25) — is the one implementation.
 */

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

const asCategory = (v: unknown): Category | null =>
  v && typeof v === 'object' && 'slug' in (v as Category) ? (v as Category) : null

/**
 * The lede is shown only when it was written by hand (DESIGN-SPEC-R3 §5.2). Migrated
 * WordPress excerpts are the opening words of the body, so printing them above the body
 * would make the reader read the first sentence twice.
 */
function isHandwrittenLede(excerpt: string | null | undefined, body: unknown): boolean {
  if (!excerpt) return false
  const norm = (t: string) =>
    t
      .replace(/\s+/g, ' ')
      .replace(/(\[…\]|\[\.\.\.\]|…|\.\.\.)\s*$/, '')
      .trim()
      .toLowerCase()
  type N = { type?: string; text?: string; children?: N[] }
  const text = (n: N): string => (n.text ?? '') + (n.children ?? []).map(text).join('')
  const first = ((body as { root?: N } | null)?.root?.children ?? []).find(
    (n) => n.type === 'paragraph',
  )
  if (!first) return true
  const head = norm(excerpt).slice(0, 60)
  return !norm(text(first)).startsWith(head)
}

export function ArticleView({
  article,
  canonical,
  related,
  preview = false,
}: {
  article: Article
  canonical: string
  related: Parameters<typeof RelatedArticles>[0]['articles']
  preview?: boolean
}) {
  const category = asCategory(article.category)
  const image = asMedia(article.featuredImage)

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

  // vh.ma signs every post ("La Rédaction" or a journalist): the byline, linking to its archive.
  const signature =
    article.signature && typeof article.signature === 'object' ? (article.signature as Author) : null
  const newsArticle = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt || undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absolute },
    url: absolute,
    image: image?.url ? [absoluteFileUrl(image.url)] : undefined,
    articleSection: category?.name,
    inLanguage: 'fr',
    author: signature
      ? {
          // vh.ma's house byline "La Rédaction" (slug vh) is the newsroom, not a person.
          '@type': signature.slug === 'vh' ? 'Organization' : 'Person',
          name: signature.name,
          url: absoluteUrl(authorUrl(signature)),
        }
      : { '@type': 'Organization', name: SITE.name },
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
    <div className="vh-container pt-8 lg:pt-12">
      <WithSidebar place="article">
        <article data-article data-source={absolute}>
          {preview ? null : (
            <>
              <JsonLd data={newsArticle} />
              <JsonLd data={breadcrumbList} />
              <ViewCounter articleId={article.id as number} />
            </>
          )}
          <ReadingProgress />

          <div>
            <header className="mx-auto max-w-[45rem]">
              <Breadcrumbs items={crumbs} />

              <h1 className="type-h1 text-ink">{typoFr(article.title)}</h1>

              <div className="type-meta mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-meta">
                {category ? (
                  <Link
                    data-kicker
                    href={categoryUrl(category as never)}
                    className="vh-kicker-pill type-kicker"
                  >
                    {category.name}
                  </Link>
                ) : null}
                <time data-date dateTime={isoDate(article.publishedAt)}>
                  {formatDate(article.publishedAt)}
                </time>
                {signature ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span data-byline>
                      Par{' '}
                      <Link href={authorUrl(signature)} className="vh-text-link" rel="author">
                        {typoFr(signature.name)}
                      </Link>
                    </span>
                  </>
                ) : null}
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
                    // The main column beside the side panel: the container's 1176 px less 348 px at full
                    // width, the viewport less 412 px between 1024 and 1240, the viewport below.
                    sizes="(min-width: 1240px) 828px, (min-width: 1024px) calc(100vw - 412px), 100vw"
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
      </WithSidebar>
    </div>
  )
}
