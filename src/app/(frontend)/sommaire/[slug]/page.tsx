import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { formatDate, isoDate } from '@/lib/format'
import { getIssueBySlug } from '@/lib/queries'
import { STATIC_ROUTES, issueUrl } from '@/lib/routes'
import { buildMetadata, ogImageUrl } from '@/lib/seo'
import { typoFr } from '@/lib/typo-fr'
import type { Media } from '@/payload-types'

export const revalidate = 3600

/** Render each issue on its first request, then serve it from the ISR cache (see the article route). */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return []
}

type Props = { params: Promise<{ slug: string }> }

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const issue = await getIssueBySlug(slug)
  if (!issue) return { title: 'Numéro introuvable' }
  return buildMetadata({
    title: issue.title,
    description: issue.summary || `Sommaire du numéro ${issue.number} de VH Magazine.`,
    path: issueUrl(issue),
    image: ogImageUrl(asMedia(issue.cover)),
  })
}

export default async function SommairePage({ params }: Props) {
  const { slug } = await params
  const issue = await getIssueBySlug(slug)
  if (!issue) notFound()
  // An issue presented by an article (N°202 onwards) lives at that article's URL, as on vh.ma.
  const home = issueUrl(issue)
  if (home !== `/sommaire/${slug}/`) permanentRedirect(home)

  const cover = asMedia(issue.cover)

  const pdf = asMedia(issue.pdf)

  return (
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Les Unes de VH', href: STATIC_ROUTES.lesUnes },
          { label: issue.title, href: issueUrl(issue) },
        ]}
      />
      <article data-issue className="grid items-start gap-10 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
        {cover?.url ? (
          <div className="vh-cover vh-edge bg-canvas-2">
            <Image
              src={cover.url}
              alt={cover.alt || issue.title}
              width={cover.width || 720}
              height={cover.height || 960}
              sizes="(min-width: 768px) 340px, 100vw"
              priority
              fetchPriority="high"
              className="h-auto w-full"
            />
          </div>
        ) : null}
        <div className="max-w-[45rem]">
          <p className="type-kicker text-accent">VH N°{issue.number}</p>
          <h1 className="type-h1-page mt-3 text-ink">{issue.title}</h1>
          <time data-date dateTime={isoDate(issue.publishedAt)} className="type-meta mt-3 block text-meta">
            {formatDate(issue.publishedAt)}
          </time>
          {issue.summary ? <p className="type-lead mt-8 whitespace-pre-line">{typoFr(issue.summary)}</p> : null}
          <div className="mt-10 flex flex-wrap gap-3">
            {pdf?.url ? (
              <a data-button href={pdf.url} target="_blank" rel="noopener noreferrer" className="vh-button-solid type-button">
                Lire le numéro (PDF)
              </a>
            ) : null}
            <Link data-button href={STATIC_ROUTES.lesUnes} className="vh-button type-button">
              Toutes nos unes
            </Link>
          </div>
        </div>
      </article>
    </div>
  )
}
