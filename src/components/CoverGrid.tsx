import Image from 'next/image'
import Link from 'next/link'

import { formatDate, isoDate } from '@/lib/format'
import { issueUrl } from '@/lib/routes'
import type { Media, MagazineIssue } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/** "Toutes nos unes" — portrait covers (spec §5.13, §6.8). */
export function CoverGrid({ issues }: { issues: MagazineIssue[] }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
      {issues.map((issue) => {
        const cover = asMedia(issue.cover)
        const href = issueUrl(issue)
        return (
          <article data-card key={issue.id} className="vh-card group flex flex-col">
            <Link href={href} className="vh-card-media block aspect-[3/4]">
              {cover?.url ? (
                <Image
                  src={cover.url}
                  alt={cover.alt || issue.title}
                  width={cover.width || 720}
                  height={cover.height || 960}
                  sizes="(min-width: 640px) 280px, 50vw"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-wash" aria-hidden="true" />
              )}
            </Link>
            <div className="pt-2.5">
              <h3 className="vh-card-title vh-clamp-2 text-[13px] font-semibold leading-snug text-ink transition-colors">
                <Link href={href}>{issue.title}</Link>
              </h3>
              <time data-date dateTime={isoDate(issue.publishedAt)} className="mt-1 block text-[11px] text-meta">
                {formatDate(issue.publishedAt)}
              </time>
            </div>
          </article>
        )
      })}
    </div>
  )
}
