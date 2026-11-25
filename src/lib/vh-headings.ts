/**
 * vh.ma's "VH ___" section headings: the outline VH mark, the section's word, a strip in the
 * section's colour (the strip colours live in styles.css, `.vh-band[data-strip=…]`).
 *
 * Measured on vh.ma 2026-11-25 from its banner images (`vh-<section>-categorie-banniere-min.jpg`,
 * `grand-angle-grand-min.jpg`, `VH-people-vh-magazine-maroc-web.png`). The home page uses them for
 * VH EXPRESS, VH LIFESTYLE and VH MOTEUR (and, without a strip on black, VH TV and VH PEOPLE),
 * then VH GRAND ANGLE over the dossiers;
 * the top of these categories' own pages and of the Grand Angle page carries the same heading.
 * Sub-categories keep a plain title, as on vh.ma (/category/moteur/moto/ reads "MOTO").
 */
export type VhStrip =
  'express' | 'lifestyle' | 'moteur' | 'culture' | 'sport' | 'people' | 'grand-angle'

export type VhHeading = { word: string; strip: VhStrip }

/** By top-level category slug. */
const BY_CATEGORY: Record<string, VhHeading> = {
  'actualite-news-express-maroc': { word: 'Express', strip: 'express' },
  'lifestyle-homme-maroc': { word: 'Lifestyle', strip: 'lifestyle' },
  moteur: { word: 'Moteur', strip: 'moteur' },
  culture: { word: 'Culture', strip: 'culture' },
  sport: { word: 'Sport', strip: 'sport' },
  'people-celebrites': { word: 'People', strip: 'people' },
}

export const GRAND_ANGLE_HEADING: VhHeading = { word: 'Grand Angle', strip: 'grand-angle' }

/** The heading of a category page, or null for a category vh.ma titles in plain text. */
export function vhHeadingForCategory(category: {
  slug?: string | null
  parent?: unknown
}): VhHeading | null {
  if (category.parent || !category.slug) return null
  return BY_CATEGORY[category.slug] ?? null
}

/** The heading of a home-page block, by its category slug. */
export function vhHeading(slug: keyof typeof BY_CATEGORY): VhHeading {
  return BY_CATEGORY[slug]
}
