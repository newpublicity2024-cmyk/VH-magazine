import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { formatDate, isoDate } from '@/lib/format'
import { getIssueBySlug } from '@/lib/queries'
import { STATIC_ROUTES, issueUrl } from '@/lib/routes'
import { buildMetadata, ogImageUrl } from '@/lib/seo'
import type { Media } from '@/payload-types'

export const revalidate = 3600

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

  const cover = asMedia(issue.cover)

  return (
    <div className="vh-container py-6">
      <Breadcrumbs
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Les Unes de VH', href: STATIC_ROUTES.lesUnes },
          { label: issue.title, href: issueUrl(issue) },
        ]}
      />
      <article data-issue className="grid gap-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {cover?.url ? (
          <Image
            src={cover.url}
            alt={cover.alt || issue.title}
            width={cover.width || 720}
            height={cover.height || 960}
            sizes="(min-width: 768px) 320px, 100vw"
            priority
            fetchPriority="high"
            className="h-auto w-full"
          />
        ) : null}
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight text-ink">{issue.title}</h1>
          <time data-date dateTime={isoDate(issue.publishedAt)} className="mt-2 block text-[12px] text-meta">
            {formatDate(issue.publishedAt)}
          </time>
          {issue.summary ? (
            <p className="mt-5 text-[15px] leading-relaxed text-ink-soft/90">{issue.summary}</p>
          ) : null}
        </div>
      </article>
    </div>
  )
}
