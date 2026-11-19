import Image from 'next/image'
import Link from 'next/link'

import type { Banner, Media } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/**
 * A keyed promo image that links somewhere (spec §6.6, DESIGN-SPEC-R3 §4.7): image edge,
 * and on hover a 2 px lift with a soft shadow. Renders nothing when the banner is absent —
 * an unfilled slot should look like no slot, not like a bug.
 */
export function PromoBanner({
  banner,
  className = '',
  sizes = '(min-width: 1024px) 300px, 100vw',
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
      className={`vh-promo vh-edge bg-canvas-2 ${className}`}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <Image
        src={image.url}
        alt={image.alt || banner.title}
        width={image.width || 1600}
        height={image.height || 500}
        sizes={sizes}
        loading="lazy"
        data-fade
        className="h-auto w-full object-cover"
      />
    </Link>
  )
}
