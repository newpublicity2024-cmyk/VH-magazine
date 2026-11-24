import { STATIC_ROUTES } from '@/lib/routes'

/**
 * Navigation data, straight from spec §4.1–4.3.
 *
 * Kept as data rather than markup because three components render the same
 * links (top bar, footer, mobile drawer) and gate G12 asserts the sets match the
 * spec exactly — one source means they cannot drift apart.
 */

export type NavItem = {
  label: string
  href: string | null
  external?: boolean
  children?: NavItem[]
}

/** Spec §4.2 — primary nav, in order. */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Actu', href: '/category/actualite-news-express-maroc/' },
  { label: 'Lifestyle', href: '/category/lifestyle-homme-maroc/' },
  { label: 'Culture', href: '/category/culture/' },
  { label: 'Grand Angle', href: STATIC_ROUTES.grandAngle },
  { label: 'Moteur', href: '/category/moteur/' },
  { label: 'Sport', href: '/category/sport/' },
  { label: 'Vidéos', href: STATIC_ROUTES.vhTv },
  {
    label: 'Les Couv’s', // as vh.ma prints it
    href: null,
    children: [
      { label: 'Les Unes de VH', href: STATIC_ROUTES.lesUnes },
      // vh.ma prints the typographic apostrophe (WordPress curls menu titles).
      { label: 'La Couv’', href: '/category/la-couv/' },
      {
        // As on vh.ma: the menu item links to the post itself (its slug, typo included).
        label: 'Découvrez en ligne et gratuitement le best of de VH magazine depuis 2002',
        href: '/actualite-news-express-maroc/decouvrez-en-ligne-et-gratuitement-le-best-of-de-vh-magazinedepuis-2002/',
      },
    ],
  },
]

/** Spec §4.1 — top bar utility links. */
export const UTILITY_NAV: NavItem[] = [
  { label: 'LES UNES DE VH', href: STATIC_ROUTES.lesUnes },
  { label: 'CONTACT', href: STATIC_ROUTES.contact },
  { label: 'TEAM VH', href: STATIC_ROUTES.teamVh },
  { label: 'KIT MEDIA', href: STATIC_ROUTES.kitMedia, external: true },
  { label: 'CHALLENGE', href: 'https://challenge.ma', external: true },
  { label: 'LALLAFATEMA', href: 'https://lallafatema.ma', external: true },
  { label: 'MFM RADIO', href: 'https://mfmradio.ma', external: true },
  { label: 'TOMOBILE360', href: 'https://tomobile360.ma', external: true },
  { label: 'SONDAGE – VH MAGAZINE', href: STATIC_ROUTES.sondage },
]

/** Spec §4.3 — the keyword column in the footer. */
export const FOOTER_KEYWORDS: NavItem[] = [
  { label: 'Art de vivre', href: '/category/lifestyle-homme-maroc/' },
  { label: 'Lifestyle', href: '/category/lifestyle-homme-maroc/' },
  { label: 'People', href: '/category/people-celebrites/' },
  { label: 'Mode', href: '/category/lifestyle-homme-maroc/' },
  { label: 'Homme', href: '/category/lifestyle-homme-maroc/' },
  { label: 'VH Magazine Maroc', href: '/' },
]

/** Default social destinations; overridden by Site Settings when present. */
export const DEFAULT_SOCIAL = {
  facebook: 'https://www.facebook.com/VHMagazineMaroc',
  twitter: 'https://twitter.com/VH_Magazine',
  instagram: 'https://www.instagram.com/vh.magazine/',
  youtube: 'https://www.youtube.com/@VHMagazine',
}
