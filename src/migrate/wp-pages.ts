/**
 * What the new site does with each WordPress *page* (not post) the REST survey recorded
 * (migration workspace, manifests/wprest/pages.jsonl — 29 published pages on 2026-11-12).
 *
 *   serve     the app has its own route at the same URL
 *   redirect  301 to the app page that does the same job (imported as a Redirects row by
 *             src/migrate/import-page-redirects.ts, so editors can change it in the admin)
 *   gone      404: the theme's demo pages (lorem ipsum, never VH content) and two empty shells
 *
 * Measured before deciding: no article body links to any page here except /magazine-maroc/
 * (one link). Backlinks from other sites are unknown; a redirect costs nothing to keep, so
 * every page with a real counterpart gets one. Gate GATES-LAUNCH L7 fails on any surveyed page
 * without a decision here — a page WordPress publishes before the final sync (P6) must be
 * decided, not silently 404.
 *
 * Plain TypeScript (no enums), so `node` can load it with type stripping from the verifier.
 */
export type WpPageDecision =
  | { id: number; path: string; action: 'serve'; why: string }
  | { id: number; path: string; action: 'redirect'; to: string; why: string }
  | { id: number; path: string; action: 'gone'; kind: 'theme-demo' | 'empty'; why: string }

export const WP_PAGE_DECISIONS: WpPageDecision[] = [
  // ── The app's own routes ────────────────────────────────────────────────────────────────
  { id: 46114, path: '/', action: 'serve', why: 'front page' },
  { id: 839, path: '/rafik-lahlou-team-vh/', action: 'serve', why: 'Team VH page' },
  { id: 1605, path: '/contact/', action: 'serve', why: 'contact form' },
  { id: 2688, path: '/vh-tv/', action: 'serve', why: 'VH TV' },
  { id: 3975, path: '/vh-grand-angle-2/', action: 'serve', why: 'Grand Angle listing (G41)' },
  { id: 7084, path: '/magazine-maroc/', action: 'serve', why: 'Les Unes de VH' },

  // ── Pages whose job an app page now does ────────────────────────────────────────────────
  { id: 46021, path: '/homepage/', action: 'redirect', to: '/', why: 'a copy of the front page' },
  {
    id: 240,
    path: '/art-de-vivre-lifestyle-people-mode-homme-vh-magazine-maroc/',
    action: 'redirect',
    to: '/',
    why: 'an earlier WPBakery front page',
  },
  {
    id: 29364,
    path: '/art-de-vivre-lifestyle-people-mode-homme-vh-magazine-maroc-2/',
    action: 'redirect',
    to: '/',
    why: 'a second copy of the earlier front page',
  },
  {
    id: 46151,
    path: '/articles-magazine-vh-magazine/',
    action: 'redirect',
    to: '/',
    why: 'a feed of the latest articles of every rubric — the front page',
  },
  {
    id: 3412,
    path: '/who-s-who-les-interviews-de-vh/',
    action: 'redirect',
    to: '/category/la-couv/portraits/',
    why: "Who's who lists the La Couv' portrait interviews",
  },
  {
    id: 11418,
    path: '/visages-de-vh/',
    action: 'redirect',
    to: '/category/les-visages-de-vh/',
    why: 'lists the articles of the category Les visages de VH',
  },
  {
    id: 33221,
    path: '/chroniques/',
    action: 'redirect',
    to: '/category/chronique/',
    why: 'Chroniques, an empty page titled after the category chronique',
  },
  {
    id: 26802,
    path: '/lisez-gratuitement-vh-magazine/',
    action: 'redirect',
    to: '/magazine-maroc/',
    why: 'lists the printed issues (sommaires) — Les Unes de VH',
  },

  // ── Gone: the theme's demo pages ────────────────────────────────────────────────────────
  { id: 74, path: '/contact-information/', action: 'gone', kind: 'theme-demo', why: 'lorem ipsum contact demo' },
  { id: 207, path: '/typography/', action: 'gone', kind: 'theme-demo', why: 'typography demo' },
  { id: 411, path: '/page-full-width/', action: 'gone', kind: 'theme-demo', why: 'layout demo' },
  { id: 600, path: '/portfolio-3-columns/', action: 'gone', kind: 'theme-demo', why: 'empty portfolio demo' },
  { id: 602, path: '/portfolio-2-columns/', action: 'gone', kind: 'theme-demo', why: 'empty portfolio demo' },
  { id: 632, path: '/grid-3-columns/', action: 'gone', kind: 'theme-demo', why: 'empty grid demo' },
  { id: 644, path: '/gallery/', action: 'gone', kind: 'theme-demo', why: 'gallery demo with stock photos' },
  { id: 1476, path: '/masonry-2-columns/', action: 'gone', kind: 'theme-demo', why: 'empty masonry demo' },
  { id: 1478, path: '/masonry-with-sidebar/', action: 'gone', kind: 'theme-demo', why: 'empty masonry demo' },
  { id: 45959, path: '/about/', action: 'gone', kind: 'theme-demo', why: 'lorem ipsum about demo' },
  { id: 45972, path: '/portfolio-with-sidebar/', action: 'gone', kind: 'theme-demo', why: 'empty portfolio demo' },
  { id: 45973, path: '/grid-2-columns/', action: 'gone', kind: 'theme-demo', why: 'empty grid demo' },
  { id: 45974, path: '/grid-with-sidebar/', action: 'gone', kind: 'theme-demo', why: 'empty grid demo' },

  // ── Gone: empty shells ──────────────────────────────────────────────────────────────────
  { id: 10435, path: '/plan-du-site/', action: 'gone', kind: 'empty', why: 'HTML site map with no text; /sitemap.xml replaces it' },
  { id: 56186, path: '/bilan-2024/', action: 'gone', kind: 'empty', why: 'published with no content' },
]
