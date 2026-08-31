import Link from 'next/link'

/**
 * The black uppercase category band that opens each homepage block (spec §3).
 *
 * The whole band is the link to the category page, as on the live site. The
 * heading level is h2 because the page's single h1 is the site title (spec §9)
 * — passing a level would let a caller break the document outline, so it is
 * deliberately not configurable.
 */
export function SectionHeader({
  title,
  href,
  moreLabel = 'Voir plus',
}: {
  title: string
  href: string
  /** Set to null to omit the inline "voir plus" affordance. */
  moreLabel?: string | null
}) {
  return (
    <div className="vh-band">
      <h2 className="vh-band-title">
        <Link href={href} className="hover:text-vh-red transition-colors">
          {title}
        </Link>
      </h2>
      {moreLabel ? (
        <Link
          href={href}
          className="text-[11px] uppercase tracking-widest text-white/70 hover:text-white transition-colors"
        >
          {moreLabel}
        </Link>
      ) : null}
    </div>
  )
}

/** The lighter heading used by full-width editorial sections that are not categories. */
export function SectionTitle({ title, href }: { title: string; href?: string }) {
  const heading = (
    <h2 className="font-display text-lg font-bold uppercase tracking-[0.08em] text-ink">{title}</h2>
  )
  return (
    <div className="mb-4 border-b-2 border-ink pb-2">
      {href ? (
        <Link href={href} className="hover:text-vh-red transition-colors">
          {heading}
        </Link>
      ) : (
        heading
      )}
    </div>
  )
}
