import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { ArticleView } from '@/components/ArticleView'
import { getPayloadClient } from '@/lib/payload'
import { getRelatedArticles } from '@/lib/queries'
import { articleUrl } from '@/lib/routes'
import type { Article, Category } from '@/payload-types'

/**
 * « Aperçu » — the back office's draft preview (Articles `admin.preview`).
 *
 * Shows an article's LATEST version — the draft being written, or the unpublished edit of a
 * live article — through the same `ArticleView` the public route uses, so what a journalist
 * previews is what publishing will show.
 *
 * Access is the reader's own, not the page's: the visitor is authenticated with their admin
 * session cookie and the article is read with `overrideAccess: false`, so a journalist sees
 * their own drafts and published articles, an editor sees everything, and anyone else gets
 * the login (no session) or a 404 (someone else's draft). Never cached, never indexed, never
 * counted as a view (`preview` drops the counter and the structured data).
 *
 * A static segment, so it outranks the root catch-all; `apercu` is a reserved category slug
 * (fields/slug.ts) so no category can claim the path.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Aperçu',
  robots: { index: false, follow: false, nocache: true },
}

type Params = { params: Promise<{ id: string }> }

export default async function PreviewPage({ params }: Params) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()

  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect(`/admin/login/?redirect=${encodeURIComponent(`/apercu/${id}/`)}`)

  let article: Article | null = null
  try {
    article = (await payload.findByID({
      collection: 'articles',
      id: Number(id),
      draft: true,
      depth: 2,
      user,
      overrideAccess: false,
    })) as Article
  } catch {
    article = null
  }
  if (!article) notFound()

  // Is a version of it live? The main row says so (draft saves never write it).
  const live = await payload.find({
    collection: 'articles',
    where: { and: [{ id: { equals: article.id } }, { _status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
    user,
    overrideAccess: false,
  })
  const liveDoc = (live.docs[0] as Article | undefined) ?? null
  const liveUrl = liveDoc ? articleUrl(liveDoc as never) : null
  const draftUrl = articleUrl(article as never)
  const canonical = draftUrl === '/' ? `/apercu/${id}/` : draftUrl

  const category =
    article.category && typeof article.category === 'object' ? (article.category as Category) : null
  const related = category
    ? await getRelatedArticles(article.id as number, category.id as number, 3)
    : []

  const state =
    article._status === 'published'
      ? 'Version publiée'
      : liveDoc
        ? 'Modifications non publiées'
        : 'Brouillon — pas encore sur le site'

  return (
    <>
      <div data-preview-banner className="sticky top-0 z-50 bg-band text-night-ink">
        <div className="vh-container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <p className="type-copy-sm">
            <strong>Aperçu</strong> · {state}
          </p>
          <p className="type-copy-sm flex flex-wrap gap-x-6 gap-y-1">
            {liveUrl && liveUrl !== '/' ? (
              <a
                className="text-accent-on-dark underline"
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
              >
                Voir la page en ligne
              </a>
            ) : null}
            <a
              className="text-accent-on-dark underline"
              href={`/admin/collections/articles/${article.id}`}
            >
              Retour à l’éditeur
            </a>
          </p>
        </div>
      </div>
      <ArticleView
        article={{ ...article, title: article.title?.trim() || 'Sans titre' }}
        canonical={canonical}
        related={related}
        preview
      />
    </>
  )
}
