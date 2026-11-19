import Image from 'next/image'
import Link from 'next/link'

import { typoFr } from '@/lib/typo-fr'
import type { Media } from '@/payload-types'

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

/**
 * A full-width editorial promo (spec §5.12, §6.7; DESIGN-SPEC-R3 §5.1): a 16:10 image
 * beside a large title, the paragraph and an accent text link. Stacked full width, never
 * paired (amendment A2).
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
    <article className="vh-card grid items-center gap-6 md:grid-cols-2 md:gap-12">
      <div data-media className="vh-card-media aspect-[16/10]">
        {media?.url ? (
          <Image
            src={media.url}
            alt={media.alt || title}
            width={media.width || 1600}
            height={media.height || 1000}
            sizes="(min-width: 768px) 50vw, 100vw"
            loading="lazy"
            data-fade
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div>
        <h3 className="type-title-lg text-ink">
          <Link href={linkUrl} className="vh-card-link">
            {typoFr(title)}
          </Link>
        </h3>
        <p className="type-copy mt-4 text-ink-2">{typoFr(body)}</p>
        <span className="type-button mt-6 inline-flex items-center gap-2 text-accent">
          {linkLabel || 'Retrouvez ici l’intégralité du dossier'}
          <span aria-hidden="true">›</span>
        </span>
      </div>
    </article>
  )
}
