import Image from 'next/image'
import Link from 'next/link'

import { issueUrl } from '@/lib/routes'
import type { MagazineIssue, Media } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/**
 * The sidebar's "En kiosque" panel, as on vh.ma: the cover of the latest issue, linking to its
 * page (an article for N°202 onwards — see issueUrl). Deliberately not a `data-card`: the homepage
 * gates count cards in the editorial blocks.
 */
export function KiosqueCover({ issue }: { issue: MagazineIssue | undefined }) {
  if (!issue) return null
  const cover = asMedia(issue.cover)
  if (!cover?.url) return null
  return (
    <Link href={issueUrl(issue)} className="block" aria-label={issue.title}>
      <Image
        src={cover.url}
        alt={cover.alt || issue.title}
        width={cover.width || 768}
        height={cover.height || 979}
        sizes="300px"
        loading="lazy"
        className="h-auto w-full"
      />
    </Link>
  )
}
