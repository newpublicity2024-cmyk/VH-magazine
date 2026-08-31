import Image from 'next/image'
import Link from 'next/link'

import { formatDate, isoDate } from '@/lib/format'
import { articleUrl } from '@/lib/routes'
import type { Article, Media } from '@/payload-types'

/**
 * The one card component behind every article on the homepage (spec §6.4).
 *
 * Variants:
 *   default    16:9 grid card — Actu, Lifestyle, Moteur, People
 *   video      as default, with a play affordance — the Vidéos block
 *   horizontal small thumb + title, for the sidebar lists
 *   compact    small grid card — Chroniques cigare
 *
 * Every variant emits `data-card` on its <article>, which is what the count gate
 * measures, and a <time data-date> in DD/MM/YYYY with an ISO `dateTime`.
 */

type Variant = 'default' | 'video' | 'horizontal' | 'compact'

/** `sizes` per variant so the optimizer serves an appropriately-sized file. */
const SIZES: Record<Variant, string> = {
  default: '(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw',
  video: '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw',
  horizontal: '96px',
  compact: '(min-width: 1024px) 220px, (min-width: 640px) 33vw, 50vw',
}

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null

export function ArticleCard({
  article,
  variant = 'default',
  priority = false,
}: {
  article: Article
  variant?: Variant
  /** Only the first Actu card sets this — it is the LCP element (spec §9). */
  priority?: boolean
}) {
  const image = asMedia(article.featuredImage)
  const href = articleUrl(article as Parameters<typeof articleUrl>[0])
  const date = formatDate(article.publishedAt)

  const media = image?.url ? (
    <Image
      src={image.url}
      alt={image.alt || article.title}
      width={image.width || 1280}
      height={image.height || 720}
      sizes={SIZES[variant]}
      priority={priority}
      // Next 16's `priority` drops loading="lazy" but does not by itself emit
      // fetchpriority="high" on the <img>. That attribute is the actual signal
      // the browser uses to prioritise the LCP image, so set it explicitly
      // rather than relying on the framework's implicit behaviour (spec §9).
      fetchPriority={priority ? 'high' : undefined}
      // `priority` already implies eager; setting loading="lazy" alongside it
      // would contradict the preload hint.
      loading={priority ? undefined : 'lazy'}
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="h-full w-full bg-wash" aria-hidden="true" />
  )

  if (variant === 'horizontal') {
    return (
      <article data-card className="vh-card group flex gap-3">
        <Link href={href} className="vh-card-media relative block h-[64px] w-[96px] shrink-0">
          {media}
        </Link>
        <div className="min-w-0">
          <h3 className="vh-card-title vh-clamp-3 text-[13px] font-semibold leading-snug text-ink transition-colors">
            <Link href={href}>{article.title}</Link>
          </h3>
          <time data-date dateTime={isoDate(article.publishedAt)} className="mt-1 block text-[11px] text-meta">
            {date}
          </time>
        </div>
      </article>
    )
  }

  const aspect = variant === 'compact' ? 'aspect-[4/3]' : 'aspect-video'

  return (
    <article data-card className="vh-card group flex flex-col">
      <Link href={href} className={`vh-card-media relative block ${aspect}`}>
        {media}
        {variant === 'video' ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 transition-colors group-hover:bg-vh-red">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        ) : null}
      </Link>

      <div className="pt-2.5">
        <h3
          className={`vh-card-title vh-clamp-2 font-semibold leading-snug text-ink transition-colors ${
            variant === 'compact' ? 'text-[13px]' : 'text-[15px]'
          }`}
        >
          <Link href={href}>{article.title}</Link>
        </h3>
        <time data-date dateTime={isoDate(article.publishedAt)} className="mt-1.5 block text-[11px] text-meta">
          {date}
        </time>
      </div>
    </article>
  )
}
