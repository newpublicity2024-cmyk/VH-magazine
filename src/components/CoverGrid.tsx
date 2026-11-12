import Image from 'next/image'
import Link from 'next/link'

import { formatDate, isoDate } from '@/lib/format'
import { issueUrl } from '@/lib/routes'
import { typoFr } from '@/lib/typo-fr'
import type { Media, MagazineIssue } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/**
 * Magazine covers as physical objects (spec §5.13, DESIGN-SPEC-R3 §4.6 `cover`): 3:4,
 * a deep shadow, and on hover the cover lifts 4 px while its shadow grows.
 */
export function CoverGrid({ issues, columns = 4 }: { issues: MagazineIssue[]; columns?: 4 | 5 }) {
  const grid = columns === 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
  return (
    <div className={`grid gap-x-6 gap-y-10 ${grid}`}>
      {issues.map((issue) => {
        const cover = asMedia(issue.cover)
        return (
          <article data-card data-variant="cover" key={issue.id} className="vh-card vh-cover-card flex flex-col">
            <div data-card-media className="vh-card-media vh-cover aspect-[3/4]">
              {cover?.url ? (
                <Image
                  src={cover.url}
                  alt={cover.alt || issue.title}
                  width={cover.width || 720}
                  height={cover.height || 960}
                  sizes="(min-width: 1024px) 220px, (min-width: 640px) 25vw, 50vw"
                  loading="lazy"
                  data-fade
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="pt-4">
              <h3 data-card-title className="type-title-sm vh-clamp-3 text-ink">
                <Link href={issueUrl(issue)} className="vh-card-link">
                  {typoFr(issue.title)}
                </Link>
              </h3>
              <time data-date dateTime={isoDate(issue.publishedAt)} className="type-meta mt-1 block text-meta">
                {formatDate(issue.publishedAt)}
              </time>
            </div>
          </article>
        )
      })}
    </div>
  )
}
