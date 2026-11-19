import Link from 'next/link'

/**
 * The black uppercase category band that opens each block (spec §3, DESIGN-SPEC-R3 §4.5).
 *
 * The title links to the category, as on the live site; "Voir tout ›" on the right says
 * so in words. The heading is h2 — the page's single h1 is elsewhere (spec §9).
 */
export function SectionHeader({
  title,
  href,
  moreLabel = 'Voir tout',
  id,
}: {
  title: string
  href: string
  /** Set to null to omit "Voir tout". */
  moreLabel?: string | null
  id?: string
}) {
  return (
    <div className="vh-band">
      <h2 id={id} className="type-band">
        <Link href={href} className="vh-hover-line">
          {title}
        </Link>
      </h2>
      {moreLabel ? (
        <Link href={href} aria-label={`${moreLabel} — ${title}`} className="vh-more type-micro">
          {moreLabel}
          <span aria-hidden="true" className="vh-more-arrow">
            ›
          </span>
        </Link>
      ) : null}
    </div>
  )
}

/**
 * The light section heading (DESIGN-SPEC-R3 §4.5): uppercase label over a heavy 2 px rule
 * — VH's clarity marker — with an optional accent "Voir tout ›".
 */
export function SectionTitle({
  title,
  href,
  moreLabel = 'Voir tout',
  id,
  tone = 'light',
}: {
  title: string
  href?: string
  moreLabel?: string | null
  id?: string
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  return (
    <div className={`mb-6 flex items-end justify-between gap-4 ${dark ? 'pb-2 hairline-dark-b' : 'vh-label-rule'}`}>
      <h2 id={id} className={`type-label ${dark ? 'text-white' : 'text-ink'}`}>
        {href ? (
          <Link href={href} className="vh-hover-line">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>
      {href && moreLabel ? (
        <Link
          href={href}
          aria-label={`${moreLabel} — ${title}`}
          className={`type-micro vh-hover-line inline-flex items-center gap-1 ${dark ? 'text-accent-on-dark' : 'text-accent'}`}
        >
          {moreLabel}
          <span aria-hidden="true">›</span>
        </Link>
      ) : null}
    </div>
  )
}
