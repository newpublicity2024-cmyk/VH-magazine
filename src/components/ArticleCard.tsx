import Image from 'next/image'
import Link from 'next/link'

import { PlayIcon } from '@/components/icons'
import { formatDate, isoDate } from '@/lib/format'
import { articleUrl } from '@/lib/routes'
import { typoFr } from '@/lib/typo-fr'
import type { Article, Category, Media } from '@/payload-types'

/**
 * The card behind every article list (spec §6.4, DESIGN-SPEC-R3 §4.6).
 *
 * Variants:
 *   default     3:2 grid card — Lifestyle, Moteur, People, related, 404
 *   lead        16:10, larger title + excerpt — first item of Actu, of listings
 *   video       16:9 with a dark-material play circle — Vidéos
 *   compact     4:3 small grid card — Chroniques cigare
 *   horizontal  thumbnail left, text right — "Derniers articles" (sm) and listing rows (lg)
 *   rank        rank numeral, title, 72 px thumbnail right — "Les plus lus" (D8)
 *
 * One link per card: the title, stretched over the card with ::after, so a reader (and a
 * screen reader) meets one destination, not an image link and a title link. Title and
 * date are always visible — nothing depends on hover (spec R3 §1.2). Every variant keeps
 * `<article data-card>` and `<time data-date>` in DD/MM/YYYY, which gates G9–G11 and G41
 * measure.
 */

export type CardVariant = 'default' | 'lead' | 'video' | 'compact' | 'horizontal' | 'rank'
type Tone = 'light' | 'dark'

const SIZES: Record<CardVariant, string> = {
  default: '(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw',
  lead: '(min-width: 1024px) 830px, 100vw',
  video: '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw',
  compact: '(min-width: 1024px) 220px, (min-width: 640px) 33vw, 50vw',
  horizontal: '(min-width: 640px) 240px, 112px',
  rank: '72px',
}

const asMedia = (v: unknown): Media | null =>
  v && typeof v === 'object' && 'url' in (v as Media) ? (v as Media) : null
const asCategory = (v: unknown): Category | null =>
  v && typeof v === 'object' && 'name' in (v as Category) ? (v as Category) : null

export function ArticleCard({
  article,
  variant = 'default',
  priority = false,
  tone = 'light',
  rank,
  size = 'sm',
  kicker = false,
  excerpt = false,
}: {
  article: Article
  variant?: CardVariant
  /** Only the LCP card sets this (spec §9): eager, fetchpriority high, no fade. */
  priority?: boolean
  tone?: Tone
  /** The 1-based position for the `rank` variant. */
  rank?: number
  /** `horizontal` only: sm = 88 px square (sidebar), lg = 4:3 240 px (listing rows). */
  size?: 'sm' | 'lg'
  /** Show the category above the title — for blocks that mix categories. */
  kicker?: boolean
  /** Show the excerpt (lead always does; horizontal lg when asked). */
  excerpt?: boolean
}) {
  const image = asMedia(article.featuredImage)
  const href = articleUrl(article as Parameters<typeof articleUrl>[0])
  const title = typoFr(article.title)
  const category = asCategory(article.category)
  const dark = tone === 'dark'
  const titleColor = dark ? 'text-night-ink' : 'text-ink'
  const metaColor = dark ? 'text-night-ink-2' : 'text-meta'
  const sizes = variant === 'horizontal' && size === 'sm' ? '88px' : SIZES[variant]

  const media = image?.url ? (
    <Image
      src={image.url}
      alt={image.alt || article.title}
      width={image.width || 1280}
      height={image.height || 720}
      sizes={sizes}
      priority={priority}
      // Next 16's `priority` does not emit fetchpriority="high" on the <img>; that
      // attribute is the browser's actual LCP signal (spec §9), so set it explicitly.
      fetchPriority={priority ? 'high' : undefined}
      loading={priority ? undefined : 'lazy'}
      data-fade={priority ? undefined : true}
      className="h-full w-full object-cover"
    />
  ) : null

  const kickerEl =
    kicker && category ? (
      <p data-kicker className={`type-kicker mb-2 ${dark ? 'text-accent-on-dark' : 'text-accent'}`}>
        {category.name}
      </p>
    ) : null

  const titleEl = (cls: string) => (
    <h3 data-card-title className={`${cls} ${titleColor}`}>
      <Link href={href} className="vh-card-link">
        {title}
      </Link>
    </h3>
  )

  const dateEl = (cls = 'mt-2') => (
    <time data-date dateTime={isoDate(article.publishedAt)} className={`type-meta block ${cls} ${metaColor}`}>
      {formatDate(article.publishedAt)}
    </time>
  )

  const excerptEl = (cls: string) =>
    article.excerpt ? (
      <p className={`type-copy vh-clamp-3 ${cls} ${dark ? 'text-night-ink-2' : 'text-ink-2'}`}>{typoFr(article.excerpt)}</p>
    ) : null

  if (variant === 'rank') {
    return (
      <article data-card data-variant="rank" className="vh-card flex items-start gap-3">
        <span data-rank aria-hidden="true" className="type-rank w-8 shrink-0 text-ink-4">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          {titleEl('type-title-sm vh-clamp-3')}
          {dateEl('mt-1')}
        </div>
        <div data-card-media className="vh-card-media size-18 shrink-0">
          {media}
        </div>
      </article>
    )
  }

  if (variant === 'horizontal') {
    const lg = size === 'lg'
    return (
      <article data-card data-variant="horizontal" className={`vh-card flex ${lg ? 'gap-4 sm:gap-6' : 'gap-3'}`}>
        <div
          data-card-media
          className={`vh-card-media shrink-0 ${lg ? 'aspect-[4/3] w-28 sm:w-60' : 'size-22'}`}
        >
          {media}
        </div>
        <div className="min-w-0 flex-1">
          {kickerEl}
          {titleEl(lg ? 'type-title vh-clamp-3' : 'type-title-sm vh-clamp-3')}
          {lg && excerpt ? excerptEl('mt-2 hidden sm:block') : null}
          {dateEl(lg ? 'mt-3' : 'mt-1')}
        </div>
      </article>
    )
  }

  const aspect = { default: 'aspect-[3/2]', lead: 'aspect-[16/10]', video: 'aspect-video', compact: 'aspect-[4/3]' }[
    variant
  ]
  const titleCls = {
    default: 'type-title vh-clamp-3',
    lead: 'type-title-lg vh-clamp-3',
    video: 'type-title vh-clamp-3',
    compact: 'type-title-sm vh-clamp-3',
  }[variant]

  return (
    <article data-card data-variant={variant} className="vh-card flex flex-col">
      <div data-card-media className={`vh-card-media ${aspect}`}>
        {media}
        {variant === 'video' ? (
          <span aria-hidden="true" className="vh-play">
            <PlayIcon className="ml-1 h-5 w-5" />
          </span>
        ) : null}
      </div>
      <div className={variant === 'lead' ? 'pt-4' : 'pt-3'}>
        {kickerEl}
        {titleEl(titleCls)}
        {variant === 'lead' ? excerptEl('mt-2') : null}
        {dateEl()}
      </div>
    </article>
  )
}
