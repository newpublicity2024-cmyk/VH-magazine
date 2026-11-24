/**
 * G12 — the top bar, primary nav and footer expose exactly the labels and hrefs
 * spec §4.1–4.3 list.
 *
 * Checked as a set, both directions: every required link must be present, AND
 * the primary nav must contain nothing beyond what the spec lists. A nav that
 * silently grew an extra item is as much a fidelity failure as one that lost an
 * item, and only the two-directional check catches the former.
 */
import { homepageHtml, assert, ok, sectionHtml, elementHtml } from './lib/harness.mjs'

/** Spec §4.2 — primary nav, in order. Les Couv's is a dropdown parent. */
const PRIMARY_NAV = [
  { label: 'Actu', href: '/category/actualite-news-express-maroc/' },
  { label: 'Lifestyle', href: '/category/lifestyle-homme-maroc/' },
  { label: 'Culture', href: '/category/culture/' },
  { label: 'Grand Angle', href: '/vh-grand-angle-2/' },
  { label: 'Moteur', href: '/category/moteur/' },
  { label: 'Sport', href: '/category/sport/' },
  { label: 'Vidéos', href: '/vh-tv/' },
  { label: 'Les Couv’s', href: null }, // dropdown parent, no destination of its own (vh.ma's curly apostrophe)
]

/** Spec §4.2 — the Les Couv's dropdown. */
const COUVS_DROPDOWN = [
  { label: 'Les Unes de VH', href: '/magazine-maroc/' },
  // Spec §4.2 writes La Couv'; vh.ma prints La Couv’ (WordPress curls menu titles) — parity pass 2026-11-24.
  { label: 'La Couv’', href: '/category/la-couv/' },
]

/** Spec §4.1 — top bar utility links. */
const TOP_BAR = [
  { label: 'LES UNES DE VH', href: '/magazine-maroc/' },
  { label: 'CONTACT', href: '/contact/' },
  { label: 'TEAM VH', href: '/rafik-lahlou-team-vh/' },
  { label: 'CHALLENGE', href: 'https://challenge.ma' },
  { label: 'MFM RADIO', href: 'https://mfmradio.ma' },
  { label: 'SONDAGE – VH MAGAZINE', href: '/sondage/' },
]

/** Spec §4.1/§4.3 — socials appear in both the top bar and the footer. */
const SOCIAL_HOSTS = ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com']

const html = await homepageHtml()

/** Strip tags and collapse whitespace, so label matching is not defeated by markup. */
const textOf = (fragment) =>
  fragment
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

function assertLinks(scopeHtml, scopeName, expected) {
  assert(scopeHtml !== null, `${scopeName} not found in the homepage HTML`)
  const text = textOf(scopeHtml)
  const hrefs = new Set(
    [...scopeHtml.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')),
  )

  for (const { label, href } of expected) {
    assert(
      text.toLowerCase().includes(label.toLowerCase()),
      `${scopeName} is missing the label "${label}" — measured text: ${text.slice(0, 300)}`,
    )
    if (href) {
      const found = [...hrefs].some((h) => h === href || h.replace(/\/$/, '') === href.replace(/\/$/, ''))
      assert(found, `${scopeName} is missing href "${href}" (label "${label}"). Present: ${[...hrefs].join(', ')}`)
    }
  }
}

// Top bar (spec §4.1).
const topBar = elementHtml(html, 'data-nav', 'topbar')
assertLinks(topBar, 'top bar', TOP_BAR)
for (const host of SOCIAL_HOSTS) {
  assert(topBar.includes(host), `top bar has no ${host} social link`)
}

// Primary nav (spec §4.2).
const primary = elementHtml(html, 'data-nav', 'primary')
assertLinks(primary, 'primary nav', PRIMARY_NAV)
assertLinks(primary, "Les Couv's dropdown", COUVS_DROPDOWN)

// Nothing beyond the spec: count the top-level nav items.
const topLevelItems = [...primary.matchAll(/data-nav-item="([^"]*)"/g)].map((m) => m[1])
assert(
  topLevelItems.length === PRIMARY_NAV.length,
  `primary nav has ${topLevelItems.length} top-level items, spec §4.2 lists ${PRIMARY_NAV.length}: ${JSON.stringify(topLevelItems)}`,
)

// A search affordance (spec §4.2 "Chercher").
assert(
  /data-search-trigger/.test(html),
  'no search trigger on the homepage (spec §4.2 requires a search icon)',
)

// Footer (spec §4.3).
const footer = sectionHtml(html, 'footer')
assertLinks(footer, 'footer', TOP_BAR)
for (const host of SOCIAL_HOSTS) {
  assert(footer.includes(host), `footer has no ${host} social link`)
}
assert(
  /tous droits r[ée]serv[ée]s/i.test(textOf(footer)),
  'footer has no copyright line (spec §4.3)',
)
assert(
  /Les [ÉE]ditions de la Gazette/i.test(textOf(footer)),
  'footer copyright does not name Les Éditions de la Gazette (spec §4.3)',
)

ok('NAVLINKS_OK')
