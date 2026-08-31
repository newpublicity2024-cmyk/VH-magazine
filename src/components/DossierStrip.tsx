import Image from 'next/image'
import Link from 'next/link'

import type { Media } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/**
 * A full-width editorial promo: image + heading + paragraph + CTA (spec §5.12,
 * §6.7).
 *
 * Amendment A2: these are STACKED full-width sections, not a side-by-side pair.
 * The wireframe drew them paired purely to compact the sketch; the live site
 * stacks them and faithful replication is the goal.
 */
export function DossierStrip({
  title,
  body,
  linkUrl,
  linkLabel,
  image,
}: {
  title: string
  body: string
  linkUrl: string
  linkLabel?: string | null
  image: unknown
}) {
  const media = asMedia(image)

  return (
    <article className="grid gap-5 border border-rule md:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
      <Link href={linkUrl} className="vh-card-media block aspect-video md:aspect-auto md:h-full">
        {media?.url ? (
          <Image
            src={media.url}
            alt={media.alt || title}
            width={media.width || 1600}
            height={media.height || 500}
            sizes="(min-width: 768px) 42vw, 100vw"
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-wash" aria-hidden="true" />
        )}
      </Link>

      <div className="flex flex-col justify-center p-5 md:pe-8">
        <h3 className="font-display text-xl font-bold leading-tight text-ink">
          <Link href={linkUrl} className="transition-colors hover:text-vh-red">
            {title}
          </Link>
        </h3>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft/80">{body}</p>
        <Link
          href={linkUrl}
          className="mt-4 self-start border-b-2 border-vh-red pb-0.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:text-vh-red"
        >
          {linkLabel || 'Retrouvez ici l’intégralité du dossier'}
        </Link>
      </div>
    </article>
  )
}
