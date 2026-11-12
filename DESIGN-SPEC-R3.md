# VH Magazine — Round 3: design finish ("VH clarity, Challenge finish")

Status: **approved with amendments C1–C4 (below)** · 2026-11-12 · Scope: the public front
end only. Built on branch `design/round-3` (from `migration/media-import`, which carries
the vendored fonts `main` cannot build without).

### Amendments (2026-11-12, after the spec was written)

- **C1 — the accent is VH blue, not red.** The spec inherited "VH signature red ~#e31e24"
  from `vh-magazine-website-spec.md` §3, which asked for it to be verified; it never was.
  Measured on vh.ma: the theme accent is `--pcaccent-cl: #026bb3`, the 2024 logo
  (`cropped-logo-vh-magazine-2024-1.png`) is `#166fc1`, `logo.jpeg` is white on blue, and
  `#e31e24` occurs nowhere on the site (every red there is a third-party icon colour).
  **Owner decision: `accent = #166fc1`, the logo's blue.** Wherever this spec says *red*,
  *VH red* or `vh-red`, read `accent`; the token table in §3.1 is corrected. A brand
  guide, if one turns up, overrides the value (one token).
- **C2 — D1–D8 accepted as recommended** (§11 records the answers).
- **C3 — logo SVGs pending from VH.** The placeholder stays (fixed so it no longer clips)
  and R3-G3 stays visibly unmet until the real files arrive; everything else proceeds.
- **C4 — contrast found while deriving C1:** `meta #757575` on `canvas-2 #f5f5f7` is
  4.23:1 (fails AA). Secondary text on a `canvas-2` surface uses `ink-2`, never `meta`.
  Accent text never sits on black at small sizes (4.08:1): on black it is
  `accent-on-dark`.

Audience: the owner (decisions in §11, assets in §12) and the session that builds it
(everything else). Read §0–§2 first, then work §9 in order.

---

## 0. The ask, and where each part is answered

> "Inspire from the Challenge website we developed locally and apply the same design feel
> to VH — that Apple and premium touch, the smoothness we have in Challenge — while keeping
> the VH identity and look, and the clarity: VH is about clarity and apparent things, just
> like the original website. Write the spec of front-end and design edits; change nothing yet."

| Part of the ask | Answered in | Proved by (round-3 gates, §10) |
|---|---|---|
| Challenge's premium / Apple finish | §1, §3 (tokens), §4–§5 | R3-G1, R3-G2, R3-G10 |
| Challenge's smoothness | §3.6 (motion system), §4 per component | R3-G4, R3-G5, R3-G6, R3-G7 |
| Keep VH identity and look | §1.1, §3.1–§3.2, §4.2, §5.1 | R3-G3, R3-G12 (owner review) |
| Clarity, "apparent things", like the original site | §1.2, §5.2 (reading), §6–§7 | R3-G8, R3-G9, R3-G11 |
| A spec, nothing changed yet | this file; §9 build order for the next session | — |

## 1. Direction

**Challenge is the reference for finish, not for identity.** We take its discipline —
tokens, precision, calm motion, materials, speed — and apply it inside VH's own look.

### 1.1 VH stays VH (non-negotiable identity)

Taken from the live vh.ma and `vh-magazine-website-spec.md` §3–§4:

- **Black and white with one accent.** Black bands (masthead, section headers, dark
  sections, footer), white content, VH red for meaning only (category labels, active
  states, the newsletter call to action, hover accents).
- **Uppercase labels.** Navigation, section bands, kickers, buttons and widget titles stay
  uppercase with generous letter-spacing. Headlines and body text are never uppercase.
- **Sans-serif.** Archivo (display, labels) + Inter (reading, interface), already vendored in
  `src/fonts/`. **No serif**: Challenge's Newsreader headlines are Challenge's identity.
- **Image-led.** Big photography, image first, title right under it, date always visible
  (DD/MM/YYYY, grey).
- **Same information architecture.** Section order (spec §5), URLs, nav, page types and
  content are untouched. This round changes how things look and move, not what or where.

### 1.2 Clarity rules ("apparent things")

1. Everything important is visible without interaction: title, category, date. Nothing
   essential appears only on hover, in a tooltip or behind a menu.
2. High contrast always (§3.1 table). One accent color.
3. Reading first: comfortable line length (≤ 68ch), real paragraph spacing, clear headings.
4. Motion explains, never decorates: it shows where something came from or went. No
   scroll-reveal of content, no parallax, no scroll-jacking, no autoplay without control.
5. Hierarchy is carried by type size, weight and space, not by boxes, gradients or color.

### 1.3 What we take from Challenge, and what we leave there

| Take (Challenge `docs/FRONTEND-SPEC.md` §, `src/app/(frontend)/styles.css`) | Leave in Challenge |
|---|---|
| Token discipline: Tailwind defaults cleared, only spec tokens compile (§2.8) | Newsreader serif headlines |
| 8-pt spacing scale and vertical rhythm (§2.3) | Sentence case everywhere |
| Neutral scale with a soft near-black and `#f5f5f7` washes (§2.1) | Large squircle cards on everything (see D2) |
| Hairlines as inset shadows; image-edge outline (§2.5) | Section icon tiles and per-section colors |
| Materials (blurred translucency) only for floating UI (§2.5) | Market ticker, alerts ticker, ads, mega menu |
| Motion tokens: durations 120/200/320/450/600 ms, `ease-standard`, `ease-out-soft` (§2.6) | Hero autoplay slider |
| Press feedback, card hover, menu/sheet transitions, staggered sheet items (§2.6) | Segmented-control tabs (VH has no tabbed blocks) |
| Spotlight-style search panel (§3.4), reading progress bar (§4.2) | |
| Focus halo, skeletons, toasts (§3.6, §3.8) | |
| French typesetting: `typoFr()` narrow no-break spaces (§2.2, `src/lib/typo-fr.ts`) | |
| Performance as a feature: zero layout shift, CSS-first motion (§1.5, §7) | |

## 2. Where VH stands today (measured 2026-11-12, migrated content on `vh_migration`)

Screenshots (local only, gitignored): `.playwright-mcp/vh-home-1440.jpeg`, `vh-home-390.jpeg`, `vh-article-1440.jpeg`
(rebuild); `live-vh-top-1440.jpeg`, `live-vh-home-1440.jpeg` (live vh.ma). Challenge
references: `/Users/mc/work/challenge.ma/screenshots/phase-3/cartes-1440.png`,
`phase-4/top-1440.png`, `phase-5/article-showcase-1440.png`.

**Defects this round must fix (not taste — measurable):**

1. **The logo is a placeholder** (`public/vh-logo.svg`, `vh-logo-white.svg`: "PLACEHOLDER
   wordmark"). Its text overflows the 200-unit viewBox, so header and footer read
   "VH | MAGAZI". The live site's slanted VH mark is the real identity.
2. **Article paragraphs run together.** `RichTextBody` and the Team page use the class
   `vh-prose`, which is defined nowhere; Tailwind's reset removes paragraph margins.
3. **Article line length ≈ 100 characters** (`max-w-3xl` = 768 px column at 16 px).
4. **Overlays appear and vanish instantly.** `MobileDrawer` and `SearchOverlay` mount only
   while open (`{open ? … : null}`), so they cannot animate in or out.
5. **Motion is untokenised.** 35 `transition-colors` at Tailwind's default timing, card zoom
   1.04 / 400 ms `ease`, and a global reduced-motion override that zeroes everything.
6. **Tailwind's default palette, radii, shadows and easings still compile** (VH defines only
   8 color tokens), so off-system values can creep in unnoticed.
7. **No designed 404** (Next's default page).
8. The **brand red is an unverified approximation** (`#e31e24`, flagged in `styles.css`).

**What already works and stays:** structure and section order, black bands, uppercase
nav, Archivo + Inter, white canvas, red category pill on articles, DD/MM/YYYY dates in
`#757575` (approved deviation), sticky header with blur, click-to-load video facade,
vendored fonts, image optimizer with AVIF/WebP.

## 3. Design tokens

All tokens live in `src/app/(frontend)/styles.css` `@theme`. Clear Tailwind's defaults first
(`--color-*: initial;` and the same for radius, shadow, ease, as Challenge does) so only
these compile.

### 3.1 Color

| Token | Value | Use | Contrast on white |
|---|---|---|---|
| `band` | `#000000` | masthead, section bands, dark sections, footer | — |
| `ink` | `#111111` | headlines, body text | 18.9:1 |
| `ink-2` | `#3a3a3c` | lede (chapô), secondary copy, excerpts | 11.4:1 |
| `meta` | `#757575` | dates, captions, meta — **approved deviation, keep** | 4.61:1 ✓ AA |
| `ink-4` | `#8e8e93` | decorative only (icons, disabled); never text < 18 px | 3.3:1 |
| `canvas` | `#ffffff` | page | — |
| `canvas-2` | `#f5f5f7` | image placeholders, inputs, icon buttons, light washes | — |
| `canvas-3` | `#e8e8ed` | hover on `canvas-2`, skeletons | — |
| `hairline` | `#d2d2d7` | dividers between rows, input borders on focus | — |
| `night-2` | `#1c1c1e` | surfaces on black bands (cards, inputs, menus on dark) | — |
| `night-ink` / `night-ink-2` | `#f5f5f7` / `#a1a1a6` | text on black | 8.2:1 for `-2` on black ✓ |
| `accent` | `#166fc1` (C1: logo blue) | kickers, active states, newsletter CTA, hover accent, focus ring | 5.15:1 ✓ (white on accent 5.15:1 ✓; on black 4.08:1 — non-text only) |
| `accent-600` | `#135ea4` | hover / pressed accent | white on it 6.64:1 ✓ |
| `accent-50` | `#e8f1f9` | text selection tint, focus halo tint | — |
| `accent-on-dark` | `#5c9ad4` | accent text on black bands and dark sections | 7.03:1 on black ✓, 5.69:1 on `night-2` ✓ |

Selection: `::selection { background: rgb(22 111 193 / .18); }`.
The current `ink #000`, `ink-soft #111`, `wash #f5f5f5`, `rule #e5e5e5`, `surface` map to
`band`, `ink`, `canvas-2`, `hairline`, `canvas` — rename in one pass (§9 step 1).

### 3.2 Typography

Fonts unchanged (`next/font/local`, `src/fonts/`). Roles become `type-*` utilities
(Challenge pattern: full class names in source, never built from template strings).

| Role | Font | Desktop size/line | Mobile | Weight | Tracking | Case |
|---|---|---|---|---|---|---|
| `type-h1` (article title) | Archivo | 40/44 | 30/36 | 700 | −0.02em | sentence (as written) |
| `type-h1-page` (listing/page title) | Archivo | 32/36 | 26/32 | 700 | −0.015em | as written |
| `type-title-lg` (lead cards, dossiers) | Archivo | 24/30 | 20/26 | 700 | −0.01em | as written |
| `type-title` (grid cards) | Inter | 17/23 | 16/22 | 600 | −0.01em | as written |
| `type-title-sm` (sidebar rows, related) | Inter | 15/20 | 15/20 | 600 | −0.005em | as written |
| `type-band` (black section band) | Archivo | 15/16 | 14/16 | 700 | +0.10em | UPPERCASE |
| `type-label` (widget titles, light headers) | Archivo | 13/16 | 13/16 | 700 | +0.08em | UPPERCASE |
| `type-nav` | Archivo | 13/16 | 22/28 (drawer) | 600 | +0.08em | UPPERCASE |
| `type-kicker` (category pill/label) | Inter | 11/14 | 11/14 | 600 | +0.10em | UPPERCASE |
| `type-button` | Archivo | 12/16 | 12/16 | 600 | +0.12em | UPPERCASE |
| `type-lead` (chapô, when hand-written) | Inter | 20/31 | 18/28 | 400, `ink-2` | −0.01em | — |
| `type-body` (article) | Inter | 18/30 | 17/28 | 400 | −0.011em | — |
| `type-meta` (dates, counts) | Inter | 13/18 | 13/18 | 400, `meta`, tabular figures | 0 | — |
| `type-caption` | Inter | 13/18 | 13/18 | 400, `meta` | 0 | — |
| `type-micro` (top bar) | Inter | 11/16 | — | 500 | +0.08em | UPPERCASE |

Typesetting rules:
- Titles `text-wrap: balance`; paragraphs `text-wrap: pretty`.
- Reading column ≤ 68ch (720 px at 18 px). `hyphens: auto` below 640 px only (`lang="fr"` is set).
- Tabular figures on dates, counts, ranks.
- **French spacing:** port Challenge's `typoFr()` (`/Users/mc/work/challenge.ma/src/lib/typo-fr.ts`):
  narrow no-break space before `; : ! ?` and inside `« »`, no-break space between a number
  and its unit. Apply to titles, excerpts and rich-text text nodes at render; never to URLs
  or times. Check it against the migrated titles before enabling (they already contain
  hand-typed spaces in places).
- Uppercase only through `type-band`, `type-label`, `type-nav`, `type-kicker`, `type-button`,
  `type-micro` — never `uppercase` on headlines or body (a source rule enforces it, §10).

### 3.3 Spacing and layout

- **8-pt scale only:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 (padding, margin, gap).
- **Container:** 1240 px (unchanged); gutters 16 (< 640), 24 (≥ 640), 32 (≥ 1024).
- **Main + sidebar** (≥ 1024): `minmax(0,1fr) 300px`, gap 48. Widgets 40 apart, no boxes.
- **Grid:** column gap 24 desktop / 16 mobile; 32 between card rows.
- **Vertical rhythm:** 64 px between homepage sections (48 mobile); 24 px band → content.
- **Article:** title block and body share a 720 px column; the hero image may run to the
  full main column (up to 960 px) for impact, centred.

### 3.4 Corners

VH's look is crisp; the live site is square. **D2** decides between two scales.

| Token | **A — Crisp (recommended)** | B — Soft (closer to Challenge) |
|---|---|---|
| card & article images | 0 | 10 px |
| lead images, video player | 0 | 14 px |
| menus, search panel, drawer edge, toasts | 12 px | 20 px |
| inputs | 2 px | 10 px |
| buttons (`Voir plus`, newsletter) | 2 px, rectangular | 2 px, rectangular |
| icon buttons (share, search, back-to-top), play button | full circle | full circle |
| category pill (kicker) | 0 (VH red block, as today) | 4 px |

Either way: squircle progressive enhancement on rounded surfaces
(`@supports (corner-shape: squircle)`), and the nested-radius rule (inner = outer − padding).

### 3.5 Elevation, materials, hairlines

- Shadows (Challenge values): `shadow-1` `0 1px 2px rgb(0 0 0/.04), 0 2px 8px rgb(0 0 0/.04)`;
  `shadow-2` `0 8px 24px rgb(0 0 0/.08)`; `shadow-3` `0 20px 48px rgb(0 0 0/.14)`.
  Shadows only signal elevation (menus, search panel, covers, sticky header once scrolled).
- **Dark material** (VH's floating chrome is black): `rgb(0 0 0 / .78)` +
  `backdrop-filter: saturate(180%) blur(20px)`; fallback `rgb(0 0 0 / .96)`.
- **Light material** (search panel, dropdown on white pages): `rgb(255 255 255 / .72)` + same
  blur; fallback `.96`.
- Paint the material on a `::before` layer for any bar that contains popovers (Challenge's
  finding: an element with `backdrop-filter` becomes the backdrop root of its children, so a
  menu opening from it could only blur the bar).
- **Hairlines** are inset box-shadows, not borders (Chromium paints a 0.5 px border as 1 CSS px);
  0.5 px on ≥ 2dppx screens.
- **Image edge:** every image wrapper gets an `::after` `inset 0 0 0 1px rgb(0 0 0/.06)` so
  white-background photos don't bleed into the canvas.

### 3.6 Motion (the "smoothness")

Tokens (Challenge `styles.css` values):

| Token | Value | Use |
|---|---|---|
| `--duration-press` | 120 ms | button / card press |
| `--duration-hover` | 200 ms | color, underline, icon nudge |
| `--duration-menu` | 320 ms | dropdowns, search panel, header compact swap |
| `--duration-sheet` | 450 ms | mobile drawer |
| `--duration-zoom` | 600 ms | card image zoom |
| `--duration-image-fade` | 300 ms | image fade-in on load |
| `--ease-standard` | `cubic-bezier(.25,.1,.25,1)` | almost everything |
| `--ease-out-soft` | `cubic-bezier(.32,.72,0,1)` | drawer, panels entering |

Patterns:
- **Card hover** (only `@media (hover: hover)`): image `scale(1.03)` over 600 ms; title gets a
  1 px **red** underline at 4 px offset fading in over 200 ms (spec §10's "red accent on hover
  for titles"). The title text stays `ink` — legibility first.
- **Press:** `scale(.98)` over 120 ms on buttons, icon buttons and cards (`pressable`).
- **Dropdown "Les Couv's":** 120 ms hover intent; fade + 4 px rise over 200 ms; Esc closes.
- **Mobile drawer:** slides in from the left over 450 ms `ease-out-soft`; scrim fades over
  320 ms; nav items stagger 30 ms (max 8). Exit reverses at 320 ms.
- **Search panel:** scrim fades to `rgb(0 0 0/.35)` over 200 ms; panel rises 8 px and fades
  over 320 ms `ease-out-soft`.
- **Header compact mode** (§4.2): logo swap cross-fades over 320 ms; the bar's height never
  changes, so nothing below jumps.
- **Images:** fade in from `canvas-2` over 300 ms on load (no blur data exists in Media; a
  dominant-color placeholder is a later option).
- **Reading progress** (articles): 2 px red bar under the sticky header, CSS
  `animation-timeline: scroll()` with a small JS fallback (Challenge `styles.css` ~l.3807).
- **"Voir tout ›" arrows** nudge 2 px right on hover. **Back-to-top** fades/rises in after
  600 px of scroll.
- **Skeletons** (client widgets only): `canvas-3` with a 1.2 s shimmer.
- **Toasts** ("Lien copié"): dark material pill, bottom centre, 2.5 s, `role="status"`.
- Smooth in-page anchor scrolling (`scroll-behavior: smooth` under no-preference only).

Never: scroll-reveal of content, parallax, scroll-jacking, autoplay carousels, animated
gradients, bouncing.

**Reduced motion:** replace today's global 0.01 ms override with opt-in motion — every
transform/slide/zoom lives inside `@media (prefers-reduced-motion: no-preference)`; under
`reduce`, only opacity fades ≤ 150 ms remain, the progress bar stays (it is information,
not decoration) and smooth scrolling is off.

Only `transform` and `opacity` animate (compositor-only); no layout properties.

## 4. Global components (file by file)

### 4.1 Top bar — `src/components/TopBar.tsx`
Keep content and order. `type-micro`, `meta` color on white (or `night-ink-2` if D1 makes
the masthead black), 32 px tall, hairline dividers 12 px tall instead of text pipes, links
underline on hover (200 ms). Social icons 16 px, `ink-4` → `ink` on hover. Not sticky.

### 4.2 Header — `Header.tsx`, `MainNav.tsx`
- **D1 (recommended): black masthead, as on the live site.** Black band, real white VH logo
  centred or left (owner's call within D1), uppercase nav in `night-ink` with the active
  section in white + a 16×2 px red bar under it.
  Alternative: keep today's white header and apply only the refinements below.
- **Sticky compact bar:** once the masthead scrolls away, a 56 px bar (dark material if D1,
  light otherwise) holds the small VH mark (left), the nav (centre) and search (right). The
  mark cross-fades in over 320 ms; the bar height is fixed from the start, so no reflow.
  Hairline bottom + `shadow-1` appear only after scrolling.
- **Nav hover:** a red 2 px underline grows from the centre (`scaleX` 0 → 1, 200 ms).
- **"Les Couv's" dropdown:** material panel, 12 px radius (D2-A), `shadow-3`, 8 px padding,
  40 px items; disclosure pattern (`aria-expanded`), arrow keys, Esc.
- Keep `MainNav` rendered always (crawler landmine in `CLAUDE.md`).

### 4.3 Mobile drawer — `MobileDrawer.tsx`
Render always, toggled with `inert` + `data-state="open|closed"` so it can animate both
ways. Full-height sheet from the left (max 420 px, full width < 420), dark material if D1.
Items `type-nav` at 22/28, 56 px rows with hairlines; "Les Couv's" as an accordion (chevron
rotates 180° over 320 ms); socials at the bottom. Keep: scroll lock, focus trap, focus
return, Esc, scrim click.

### 4.4 Search — `SearchOverlay.tsx` (+ optional `/api/search`)
Spotlight-style: 640 px panel centred 15 vh from the top, light material, `shadow-3`, 12 px
radius; 56 px input at 20 px; `Esc` hint. Shortcuts `/` and ⌘K / Ctrl-K.
**D3 (recommended): live results** — from 2 characters, debounce 150 ms, up to 6 results
(48 px thumbnail, `type-title-sm`, category · date), last row "Voir tous les résultats pour
« q »" → `/recherche/?q=`. Needs a small route handler over the existing `lib/search.ts`.
Without D3: the panel only submits to `/recherche/`. Mobile: full-screen sheet.

### 4.5 Section header — `SectionHeader.tsx`
- **Black band (kept):** 44 px, `type-band` white, 16 px inline padding; the band links to the
  category. Right side "Voir tout ›" in `night-ink-2` → white on hover, arrow nudge.
- **Light variant** (sidebar, secondary sections): `type-label` `ink` + a 2 px `band` rule
  8 px below (kept heavy on purpose: it is VH's clarity marker), "Voir tout ›" in red.

### 4.6 Cards — `ArticleCard.tsx` (variants `default | video | horizontal | compact`), `CoverGrid.tsx`
Shared: stretched-link card; image wrapper with image edge, `canvas-2` placeholder and
300 ms fade-in; hover per §3.6; focus ring (§7) following the card shape; `type-meta` date
under the title, always visible; category label as `type-kicker` red text above the title
where the block mixes categories.

| Variant | Image | Text |
|---|---|---|
| `default` (grid) | 3:2 (today mixes `aspect-video`; settle on 3:2 for photos, 16:9 only for video) | `type-title` 3-line clamp, date |
| `lead` (new: first item of a block, dossier) | 16:10 | `type-title-lg`, optional excerpt 3 lines `ink-2`, date |
| `horizontal` (lists, sidebar) | 1:1 88 px, left | `type-title-sm`, date; hairline between rows |
| `compact` (sidebar "Les plus lus") | 1:1 72 px, right | **rank numeral** (Archivo 32, `hairline` color, tabular) + `type-title-sm` + date (D8) |
| `video` | 16:9 | 44 px dark-material play circle bottom-left; scale 1.06 on hover |
| `cover` (Les Unes) | 3:4 | a physical object: `shadow-3`, hover rises 4 px and the shadow grows |

"Voir plus" (`CategoryBlock.tsx`): rectangular outline button, `type-button`, 40 px tall,
1 px `ink` inset hairline; hover fills `ink` with white text (200 ms); press `.98`.

### 4.7 Sidebar — `SidebarWidget.tsx`, `NewsletterForm.tsx`, `PromoBanner.tsx`, `InstagramCard.tsx`
Widget titles light-variant §4.5. Newsletter: input 48 px `canvas-2`, no border, focus →
white + hairline + red halo; button `vh-red` full width, `type-button`; states idle /
loading (inline spinner) / success / error, announced. Promos: image with image edge, hover
lift −2 px + `shadow-2`. Instagram card: `canvas-2` surface, 12 px radius (D2-A).

### 4.8 Footer — `Footer.tsx`, `BackToTop.tsx`
Black band (kept), real white logo, columns as today; titles `type-label` `night-ink-2`,
links `night-ink` underline on hover; bottom bar behind a `rgb(255 255 255/.12)` hairline.
Back-to-top: 44 px dark-material circle bottom-right, appears after 600 px, `pressable`.
Mobile: columns become accordions.

### 4.9 Shared controls
- **Icon buttons** (share, search, menu): 40 px circles on `canvas-2` (44 px touch), hover
  `canvas-3`, `pressable`.
- **Share** (`ShareButtons.tsx`): Facebook, X, WhatsApp, LinkedIn, Email, **Copy link** (toast);
  on mobile a native-share button (`navigator.share`) first.
- **Text links in body:** `ink` with a 1 px red underline at 3 px offset; hover → red text.
- **Pagination** (`Pagination.tsx`): 40 px squares (D2-A) / circles (D2-B), current page
  `ink` filled; "Précédent" / "Suivant" with arrows.
- **Breadcrumbs:** `type-meta` with chevrons; current page not linked.
- **Video facade** (`VideoEmbed.tsx`): poster fade-in; 64 px dark-material play circle,
  hover scale 1.06; keyboard and screen-reader label unchanged.

## 5. Pages

### 5.1 Home — `src/app/(frontend)/page.tsx`
Section order unchanged (spec §5). Edits:
- Rhythm 64/48 px; bands per §4.5; first block's first item may use `lead` (stays inside the
  existing count gates, G9).
- **D5 (recommended): dark sections as on the live site** — VIDÉOS and PEOPLE on full-bleed
  black bands (cards on black: titles `night-ink`, dates `night-ink-2`), as vh.ma does today.
- Dossier strips (`DossierStrip.tsx`): image 16:10 + `type-title-lg` + body + red text link.
- "Toutes nos unes": cover row as physical objects (§4.6). Empty until the magazine-issue
  import decision (migration PLAN, Open) — design an empty-state that hides the section.

### 5.2 Article — `src/app/(frontend)/[...path]/page.tsx`, `RichTextBody.tsx`
The reading experience is where clarity matters most.
- **Define `vh-prose`** (today undefined): `type-body`; 1.1 em between paragraphs; h2 Archivo
  24/30 700 with 40 px top margin; h3 Inter 20/28 600 with 32 px; lists with 6 px round
  `meta` bullets and tabular ordered numerals; blockquote Archivo 24/32 `ink` with a 3 px red
  left rule and 32 px vertical margins; `hr` as a centred 48 px hairline; images and video
  uploads full column width with a caption slot; embed-link paragraphs as a `canvas-2` card
  ("Voir la publication ›") instead of a bare URL line.
- **Column:** 720 px (`max-w-[45rem]`) for title block and body; hero image may widen to 960 px.
- **Header order kept:** breadcrumbs → title (`type-h1`, balanced) → red category pill + date
  + "· N min de lecture" (words ÷ 230) → share row → hero (or video facade) → lede (only when
  hand-written; `type-lead`) → body → tags (pills, `canvas-2`) → share → "Articles similaires".
- Reading progress bar (§3.6). Print stylesheet: no chrome, 12 pt body, source URL footer.

### 5.3 Listings — `category/[...path]`, `vh-grand-angle-2`, `recherche`
Header: breadcrumbs, `type-h1-page`, description when present. Page 1 opens with a `lead`
card, then `horizontal` rows with 4:3 240 px thumbnails (112 px mobile), hairline separated.
Search: large input prefilled, "N résultats pour « q »", empty state with latest articles.

### 5.4 VH TV — `vh-tv`
Full black page band; featured player (16:9) on top, grid of `video` cards on black; playing
swaps the featured player in place (no navigation).

### 5.5 Magazine — `magazine-maroc`, `sommaire/[slug]`
Cover grid (5 columns desktop, 2 mobile) of physical-object covers, grouped by year with
sticky year labels. Issue page: cover left (`shadow-3`), sommaire right, CTAs.

### 5.6 Static pages — `contact`, `rafik-lahlou-team-vh`, `sondage`
720 px prose column (`vh-prose`), `type-h1-page`; contact as three `canvas-2` cards.

### 5.7 404 — new `src/app/(frontend)/not-found.tsx`
"Page introuvable" (`type-h1-page`), one line of copy, the search field, the 6 latest
articles. Status 404 (existing G-gate must stay green).

## 6. Responsive summary

| Element | < 640 | 640–1023 | ≥ 1024 |
|---|---|---|---|
| Header | 56 px bar: menu · logo · search; drawer | same | masthead + sticky compact bar |
| Grids | 1 column (2 for People/covers) | 2 columns | 2–5 per block, as today |
| Sidebar | after main content | after main content | 300 px column |
| Article | full width, 16 px gutters, body 17/28 | 720 px centred | 720 px in main |
| Footer | accordions | 2 columns | 3 columns |

Touch targets ≥ 44×44 px on touch devices; ≥ 24×24 px desktop (WCAG 2.5.8).

## 7. Accessibility (WCAG 2.2 AA — G16 stays green)

- Contrast pairs in §3.1 hold; `ink-4` never carries text < 18 px.
- Focus everywhere: 2 px `vh-red` ring + 4 px `rgb(227 30 36/.25)` halo, following the shape.
- Overlays (drawer, search, dropdown): Esc closes, focus trapped and returned, `inert` when
  closed, scroll lock while open.
- Reduced motion per §3.6. Layout holds at 200 % zoom and 320 px width.
- One `h1` per page; landmarks; skip link "Aller au contenu" first.

## 8. Performance (stays inside today's gates)

- **No new runtime dependency** for motion — CSS transitions/animations and small client
  islands only (no framer-motion, no Lenis smooth-scroll).
- Animate `transform`/`opacity` only; `will-change` only during an active transition.
- CLS ≤ 0.02 (header compact mode, image fade and fonts must not shift layout).
- First-party JS on home and article may grow by at most 15 KB gzipped over the pre-round-3
  build (live search and drawer are the only new interactive code).
- LCP image keeps `fetchPriority="high"` (landmine in `CLAUDE.md`).

## 9. Build order (next session)

1. **Tokens and source rules.** Clear Tailwind defaults, add §3 tokens and `type-*`
   utilities, rename the old tokens, add motion utilities (`pressable`, material, hairline,
   image-edge, skeleton). Port `typoFr()`. Write the round-3 gates (§10) first.
2. **Assets:** real logo SVGs and the verified red (§12). Without them, stop and ask.
3. Header, top bar, dropdown, drawer, search panel, footer, back-to-top.
4. Card family, section headers, sidebar widgets, buttons, share, pagination, video facade.
5. Article (`vh-prose`, column, progress bar, print).
6. Home (rhythm, dark sections), listings, VH TV, magazine, static pages, 404.
7. Full regression: G1–G42 plus round-3 gates; owner visual review (R3-G12).

Work on a new branch from `main` after the migration branch merges, or from
`migration/media-import` if it has not — decide at session start. Every route keeps its
URL; no data-model change is needed (live search reads existing columns).

## 10. Acceptance gates for round 3 (to add to `GATES.md` before implementing)

Each is runnable unless marked manual. Scripts go in `scripts/verify-*.mjs`, using the
existing harness (`withServer`, `withPage`, fresh ports, `stripScripts`).

| Id | Outcome | How it is measured |
|---|---|---|
| R3-G1 | Only spec tokens compile | Build CSS contains no Tailwind default palette/radius/shadow/ease variables; a source-rules script rejects raw hex outside `styles.css`, off-scale spacing, `uppercase` outside the label roles, and literal transition durations |
| R3-G2 | Contrast holds | Computed colors of meta, kicker, band text, links, buttons ≥ 4.5:1 at 1440 and 390 |
| R3-G3 | The real logo ships unclipped | No "PLACEHOLDER" in `public/*.svg`; the logo's rendered bounding box lies inside its viewBox in header and footer |
| R3-G4 | Card hover is the tokenised motion | Under `no-preference`, a hovered card image computes `scale(1.03)` with a 600 ms `--ease-standard` transition; under `reduce` it computes no transform |
| R3-G5 | Overlays animate both ways and stay accessible | Drawer and search are present while closed (`inert`), transition with their tokens on open and close, trap and return focus, close on Esc |
| R3-G6 | Header compact mode causes no shift | Header height identical at scroll 0 and 800 px; compact mark visible after scroll; CLS ≤ 0.02 over a scripted scroll |
| R3-G7 | Reduced motion is honoured site-wide | With `reduce` emulated, no element has a transform transition or animation other than opacity ≤ 150 ms (progress bar excepted) |
| R3-G8 | Article reads clearly | `vh-prose` paragraphs have ≥ 16 px spacing; body font ≥ 17 px; column ≤ 720 px at 1440; h1 balanced; every migrated-article sample (20 across eras) renders with no run-together paragraphs |
| R3-G9 | Dates, categories and titles are always visible | On home, category and article, every card shows title + date without hover (computed visibility/opacity) |
| R3-G10 | Performance budget kept | Lighthouse mobile perf ≥ 90 on home/article/category; first-party JS growth ≤ 15 KB gz vs the recorded pre-R3 baseline |
| R3-G11 | Accessibility kept | axe: 0 serious/critical on home, article, category, search, 404 at 1440 and 390 (extends G16) |
| R3-G12 | Owner approves the look (**manual**) | Screenshots at 1440 and 390 of home, article, category, VH TV, search panel open, drawer open, 404; the owner's written approval (this is the long-pending D4 punch list) |
| R3-G13 | The decisions render as decided (C1, D1, D2, D4–D8) | Accent computes `#166fc1` and no red token remains; black masthead; image corners 0 and floating panels 12 px; no View Transitions; Vidéos and People on black; titles below images; logo centred in the masthead and left in the compact bar; rank numerals 1–5 in "Les plus lus" |
| R3-G14 | Live search works (D3) | `/api/search` returns ≤ 6 hits for a seeded term, nothing under 2 characters, survives an injection payload; typing in the panel shows the results and a "Voir tous les résultats" link to `/recherche/?q=` |
| R3-G15 | French typesetting is applied and safe | `typoFr` is idempotent and never leaves a space beside a narrow no-break space across every migrated title in `vh_migration`; a rendered title shows U+202F before `?` / `:`; URLs and times untouched |
| R3-G16 | A designed 404 | Status 404, h1 "Page introuvable", a search field and the 6 latest articles |
| R3-G17 | The rest of the spec inventory is present | Reading progress bar and "min de lecture" on articles; share row with WhatsApp, LinkedIn and Copy link (toast `role=status`); listings open with a `lead` card then `horizontal` rows; VH TV featured player swaps in place; magazine covers grouped by year; footer accordions at 390; back-to-top only after 600 px; a print stylesheet |

Plus: G1–G42 re-run green on the round-3 build (standing harness policy: reset evidence first).

## 11. Decisions for the owner

Answered 2026-11-12: **every recommendation accepted** (amendment C2). Proved by R3-G13
(D1, D2, D4–D8 as rendered) and R3-G14 (D3).

| # | Question | Recommendation | Decision |
|---|---|---|---|
| D1 | Masthead: **black band like the live site** or keep the rebuild's white header? | Black — it is the most recognisable piece of VH | Black |
| D2 | Corners: **A Crisp** (square images, rounded only floating UI) or **B Soft** (Challenge-like rounded images)? | A — VH is a crisp, print-like magazine | A — Crisp |
| D3 | Search: **live results as you type** (small new API) or submit-only? | Live results — the biggest "premium" gain for little code | Live results |
| D4 | Page transitions (View Transitions cross-fade between pages)? | Not in round 3 — still experimental in Next 16; revisit later | Not in round 3 |
| D5 | VIDÉOS and PEOPLE on **black bands** as on the live site? | Yes | Yes |
| D6 | Titles on **white plates over images** (live top block) or **below images** everywhere? | Below everywhere — clearer, and consistent | Below everywhere |
| D7 | Logo position in the masthead: centred (live) or left (rebuild)? | Centred on the black masthead, left in the compact bar | Centred; left in compact bar |
| D8 | "Les plus lus" with **rank numerals**? | Yes — note view counts are 0 until the WordPress counts are migrated | Yes |

## 12. Assets needed from VH

- **Still needed:** official logo SVGs — blue-on-white, white-on-black, and the compact
  "VH" mark. None exist in the repo, the FTP mirror or on vh.ma (which serves only
  `logo-blanc.png` 134×100 and `cropped-logo-vh-magazine-2024-1.png` 210×150).
- ~~The exact brand red~~ — resolved by C1: the brand colour is blue `#166fc1` (sampled
  from the 2024 logo PNG). A brand-guide value, if VH has one, replaces it.
- Optional: favicon / app icon set from the same source.

## 13. Out of scope — do not change

URLs and redirects; section order and contents (spec §5); data model and migration code;
SEO metadata and JSON-LD; the approved deviations (`meta #757575`, Payload, stacked
Collector/Cool Drives/Dossiers); vendored fonts; the image optimizer setup.
