import Link from 'next/link'

import type { VhStrip } from '@/lib/vh-headings'

/**
 * The outline VH of VH's 2024 logo, as vh.ma draws it in its section headings: the V's left
 * stroke, its right stroke (which is also the H's left stroke) with the logo's shadow sliver,
 * and the H's right stroke with its crossbar. Traced from vh.ma's own high-resolution logo
 * (wp-content/uploads/2016/05/VH-TV.png, 1786×1104; the "TV" letters left out). A hairline
 * (0.6 px whatever the size): vh.ma's outline reads as a thin grey line, not a black one.
 */
function VhMark() {
  return (
    <svg
      className="vh-band__mark"
      viewBox="0 0 1628 1104"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.6}
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <polygon vectorEffect="non-scaling-stroke" points="0,0 266,0 622,1104 356,1104" />
      <polygon vectorEffect="non-scaling-stroke" points="741,0 1007,0 654,1104 520,691" />
      <polygon vectorEffect="non-scaling-stroke" points="1007,0 1042,0 687,1104 655,1104" />
      <polygon
        vectorEffect="non-scaling-stroke"
        points="1362,0 1628,0 1275,1104 1010,1104 1145,679 853,679 933,429 1225,429"
      />
    </svg>
  )
}

/**
 * A section heading as vh.ma draws it (user request 2026-11-25): no background, the outline VH
 * mark, the section's word in heavy capitals, then a strip in the section's colour running to
 * the column's edge. vh.ma's are images; this one is text, at our heading height (the black
 * band it replaces was 44 px), in vh.ma's proportions — the word's capitals are 0.36 of the
 * mark's height, the strip 0.44 and 0.45 away, the word, mark and strip sharing a bottom line.
 * On the black sections (`.vh-dark`) it is white and has no strip, as vh.ma's VH TV / VH PEOPLE.
 *
 * The accessible name is "VH <word>" (the mark is decorative). The title links to its category
 * when given an href — the block's own "Voir plus" button sits below, as on vh.ma.
 */
export function SectionHeader({
  word,
  href,
  strip,
  id,
  as: Heading = 'h2',
  suffix,
}: {
  word: string
  href?: string
  /** The strip's colour; none on a dark section. */
  strip?: VhStrip
  id?: string
  as?: 'h1' | 'h2'
  /** Plain text after the word (a listing's "— page 2"). */
  suffix?: string | null
}) {
  const inner = (
    <>
      <VhMark />
      <span className="sr-only">VH </span>
      <span className="type-band vh-band__word">{word}</span>
    </>
  )
  return (
    <div className="vh-band" data-strip={strip}>
      <Heading id={id} className="vh-band__title">
        {href ? (
          <Link href={href} className="vh-band__link">
            {inner}
          </Link>
        ) : (
          <span className="vh-band__link">{inner}</span>
        )}
        {suffix ? <span className="vh-band__suffix type-copy-sm text-meta"> {suffix}</span> : null}
      </Heading>
      {strip ? <span className="vh-band__strip" aria-hidden="true" /> : null}
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
