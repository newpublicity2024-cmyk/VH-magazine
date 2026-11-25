import Image from 'next/image'
import Link from 'next/link'

import { typoFr } from '@/lib/typo-fr'
import type { Banner, Media } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/**
 * "Cool Drives By Rafik Lahlou", as vh.ma's sidebar shows it (its "about" widget): the photo
 * linking out, then the heading, a short rule and the text, centred. Fed by the `cool-drives`
 * banner (title, image, link, body). Renders nothing without an image, like PromoBanner.
 */
export function AboutCard({ banner }: { banner: Banner | undefined }) {
  if (!banner) return null
  const image = asMedia(banner.image)
  if (!image?.url) return null
  const isExternal = /^https?:\/\//i.test(banner.linkUrl || '')
  return (
    <div className="text-center">
      <Link
        href={banner.linkUrl || '/'}
        className="vh-promo vh-edge block bg-canvas-2"
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        <Image
          src={image.url}
          alt={image.alt || banner.title}
          width={image.width || 850}
          height={image.height || 818}
          sizes="(min-width: 1024px) 300px, 100vw"
          loading="lazy"
          data-fade
          className="h-auto w-full"
        />
      </Link>
      <h2 className="type-title mt-6 text-ink">{typoFr(banner.title)}</h2>
      <span aria-hidden="true" className="vh-about__rule" />
      {banner.body ? <p className="type-copy-sm mt-4 text-ink-2">{typoFr(banner.body)}</p> : null}
    </div>
  )
}
