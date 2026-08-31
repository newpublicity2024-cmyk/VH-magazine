import Image from 'next/image'
import Link from 'next/link'

import type { Banner, Media } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/**
 * A keyed promo image that links somewhere (spec §6.6).
 *
 * Renders nothing when the banner is absent rather than showing a broken frame:
 * an unfilled slot should look like no slot, not like a bug.
 * External destinations get rel="noopener" via next/link's default plus the
 * explicit target below.
 */
export function PromoBanner({
  banner,
  className = '',
  sizes = '(min-width: 1024px) 320px, 100vw',
}: {
  banner: Banner | undefined
  className?: string
  sizes?: string
}) {
  if (!banner) return null
  const image = asMedia(banner.image)
  if (!image?.url) return null

  const isExternal = /^https?:\/\//i.test(banner.linkUrl || '')

  return (
    <Link
      href={banner.linkUrl || '/'}
      className={`vh-card vh-card-media group block ${className}`}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <Image
        src={image.url}
        alt={image.alt || banner.title}
        width={image.width || 1600}
        height={image.height || 500}
        sizes={sizes}
        loading="lazy"
        className="h-auto w-full object-cover"
      />
    </Link>
  )
}
