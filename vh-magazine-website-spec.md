# VH Magazine (vh.ma) — Website Decomposition & Rebuild Spec

> Purpose: full structural breakdown of the current vh.ma (WordPress + WPBakery) homepage and site,
> to be recreated with a modern, faster, SEO-optimized stack. Replicate the layout and components
> faithfully, with only a slight modern touch (cleaner spacing, sharper typography, subtle hover
> states, better mobile behavior). Do NOT redesign the information architecture.

---

## 1. Project Context

- **Brand**: VH Magazine — Moroccan men's magazine ("Art de vivre | Lifestyle | People | Mode | Homme").
- **Publisher**: Les Éditions de la Gazette / NewPublicity group (sister brands: Challenge, Lalla Fatema, MFM Radio, Tomobile360).
- **Language**: French (fr_FR). All UI labels, dates, and content in French. `lang="fr"` on `<html>`.
- **Content type**: News/magazine articles with categories, magazine issue covers ("Les Unes"), videos, podcast, newsletter.
- **Current site**: WordPress, WPBakery page builder, heavy and slow. Goal: same look/feel, much faster.

## 2. Target Stack

- **Framework**: Next.js (App Router, React Server Components, ISR/SSG for articles).
- **Styling**: TailwindCSS.
- **Database**: Neon (Postgres) — articles, categories, tags, covers/issues, videos, newsletter subscribers.
- **Media**: Vercel Blob Store for all images/media. Serve via `next/image` for optimization.
- **Deployment**: Vercel.
- **SEO**: per-page metadata (title, description, OpenGraph, Twitter card `summary_large_image`), canonical URLs, JSON-LD (`NewsArticle`, `WebSite`, `Organization`, `BreadcrumbList`), sitemap.xml, RSS feed, robots.txt (`index, follow, max-image-preview:large`).
- Keep URL structure compatible with the current one where possible for SEO continuity:
  - Articles: `/{category-slug}/{article-slug}/`
  - Categories: `/category/{category-slug}/`
  - Covers/issues: `/sommaire/{issue-slug}/`
  - Static: `/contact/`, `/magazine-maroc/`, `/vh-tv/`, `/rafik-lahlou-team-vh/`, `/sondage/`

## 3. Brand & Visual Identity

- **Logo**: "VH" logomark + "magazine" wordmark. Two versions: dark-on-light (main header) and white version (used on dark strips/footer).
- **Color palette** (from current site):
  - Primary black: `#000000` / near-black `#111` (header bars, section title strips).
  - White backgrounds for content areas.
  - Accent red (VH signature red, used in logo/highlights/hover): approx `#e31e24` — verify against logo asset.
  - Grey text for dates/meta: `#888`–`#999`.
- **Typography**: Modern sans-serif for UI/headlines (current uses a Helvetica-like sans; use something like Inter or Archivo for the modern touch), uppercase for section titles and nav.
- **Section headers style**: horizontal band/bar with the category name in uppercase, often white text on black background or bold black text with a thin rule — each major homepage block starts with one, and the header itself links to the category page.
- **Article dates**: format `DD/MM/YYYY`, grey, small, under the title.

## 4. Global Layout

### 4.1 Top Bar (secondary utility nav)
A thin strip above/below the main header containing partner & utility links, separated by pipes:
- LES UNES DE VH → `/magazine-maroc/`
- CONTACT → `/contact/`
- TEAM VH → `/rafik-lahlou-team-vh/`
- KIT MEDIA → PDF media kit (store in Blob)
- CHALLENGE → external `https://challenge.ma`
- LALLAFATEMA → external
- MFM RADIO → external `https://mfmradio.ma`
- TOMOBILE360 → external / tag page
- SONDAGE – VH MAGAZINE → `/sondage/`
Plus social icons (Facebook, X/Twitter, Instagram, YouTube).

### 4.2 Main Header
- Left: VH Magazine logo (links to `/`).
- Center/right: primary nav (uppercase):
  1. **Actu** → `/category/actualite-news-express-maroc/`
  2. **Lifestyle** → `/category/lifestyle-homme-maroc/`
  3. **Culture** → `/category/culture/`
  4. **Grand Angle** → `/vh-grand-angle-2/`
  5. **Moteur** → `/category/moteur/`
  6. **Sport** → `/category/sport/`
  7. **Vidéos** → `/vh-tv/`
  8. **Les Couv's** (dropdown):
     - Les Unes de VH → `/magazine-maroc/`
     - La Couv' → `/category/la-couv/`
     - "Découvrez en ligne et gratuitement le best of de VH magazine depuis 2002" → article page
- Right: search icon ("Chercher") opening a search overlay/input.
- **Sticky behavior**: header becomes sticky on scroll (current site has a sticky variant with white logo on dark background).
- **Mobile**: hamburger menu, slide-in drawer with same nav + socials.

### 4.3 Footer
- Dark/black background, white logo.
- Social icons row (Facebook, Twitter, Instagram, Youtube).
- Two link columns repeating the utility links (Les Unes, Contact, Team VH, Kit Media, Challenge, Lallafatema, MFM Radio, Tomobile360, Sondage) + keyword links (Art de vivre, Lifestyle, People, Mode, Homme, VH Magazine Maroc).
- Copyright line: `@20XX - Tous droits réservés magazine VH Maroc — Les Éditions de la Gazette`.
- "Back to top" floating button.

---

## 5. HOMEPAGE — Section-by-Section Decomposition (in exact order)

The homepage is a long vertical stack of category blocks and widgets. Main layout: a wide main column with a right sidebar for the middle portion, then full-width sections lower down.

### Section 1 — ACTU block (`category: actualite-news-express-maroc`)
- Section header band "ACTU" linking to the category.
- Grid of the **4 latest Actu articles**: card = image (16:9 thumbnail), title (truncated ~2 lines with ellipsis "..."), date `DD/MM/YYYY`.
- "Voir plus" link/button at the bottom → category page.
- Example current content: "Le ballon de la « Main de Dieu »…" (22/08/2026), "Le Wydad perd l'un de ses présidents…" (22/08/2026), "Le Maroc brille parmi les finalistes du Prix du design de l'IMA 2026" (20/08/2026), "Starlink prêt à embarquer avec Royal Air Maroc ?" (20/08/2026).

### Section 2 — LIFESTYLE block (`category: lifestyle-homme-maroc`)
- Same component as Section 1 (header band "LIFESTYLE" + 4 article cards + "Voir plus").
- Example content: Royal Mansour Tamuda Bay, Charles Leclerc yacht, Kimpton Marrakech, Four Seasons yacht.

### Section 3 — MOTEUR block (`category: moteur`)
- Same 4-card component, header "MOTEUR".
- Example content: "Porsche, l'icône sous pression", "Ford Territory", "40 millions de dollars pour une Ferrari électrique", "Jaguar Type 01".

### Section 4 — Right Sidebar (rendered alongside the blocks above on desktop)
The sidebar stacks these widgets, top to bottom:

1. **NUMÉRO COLLECTOR** — section title + single promo banner image linking to a featured collector article.
2. **THE SHIFT PODCAST** — section title + banner image linking to the YouTube playlist (external).
3. **VH Newsletter** — signup box:
   - Title: "VH Newsletter"
   - Text: "Chaque samedi, recevez l'actu culture, bien-être et lifestyle directement dans votre boite mail"
   - Email input + button "Je m'inscris"
   - States: loading ("Please wait..."), success ("Merci pour votre inscription!")
   - Backend: store subscriber in Neon table `newsletter_subscribers` (email, created_at, source) via a server action / API route. Add double opt-in later if needed.
4. **Instagram embed** — latest Instagram reel/post from `@vh.magazine` (embed or a static card linking out; prefer a lightweight custom card with image from Blob + link to Instagram for performance).
5. **Les plus lus** (Most read) — list of 5 items: small thumbnail + bold title + date. Driven by view counts (add `view_count` on articles; increment via lightweight endpoint or edge counter).
6. **Derniers articles** (Latest) — list of 5 most recent articles across all categories: thumbnail + title + date.

### Section 5 — WHO'S WHO banner
- Full/large banner image linking to `/who-s-who-les-interviews-de-vh/` (interviews hub).

### Section 6 — Chroniques cigare
- Section title "Chroniques cigare".
- Row/carousel of 5 small cards (image + title): "La theorie du complot", multiple "Vitoles & Volutes" entries. Links to the `vitoles-volutes` articles.

### Section 7 — "Un collector à ne pas manquer !"
- Section title + single promo banner linking to `/sport/collector-a-ne-pas-manquer/`.

### Section 8 — Cool Drives By Rafik Lahlou
- Banner image linking to Instagram `@cooldrives` (external).
- Heading: "Cool Drives By Rafik Lahlou".
- Short bio text: "Rafik Lahlou, grand passionné de l'automobile, lanceur de projets et d'idées, fondateur de VH et de RM Automobiles, co-fondateur de MajicCasa."

### Section 9 — VIDÉOS block (VH TV)
- Section header band linking to `/category/video/` / `/vh-tv/`.
- Grid of **6 video article cards** (thumbnail with play affordance + title + date).
- Example content: "Asif El Mal quand le football rallume les rêves des enfants" (15/01/2026), "Virgine Efira parle cinéma, liberté et passion", "Carmen Maura", "FIFM – Jour 2", "22e édition du Festival de Marrakech", "Rallye de la Marche Verte".
- "VOIR PLUS" button → `/vh-tv/`.

### Section 10 — Magazine banner ("Les Unes")
- Full-width banner linking to `/magazine-maroc/` (archive of all magazine covers).

### Section 11 — PEOPLE block (`category: people-celebrites`)
- Section header band + grid of **5 article cards** (image + full title + date) + "Voir plus".
- Example content: Musée de la Mémoire de Casablanca, Arsène Wenger Challenge Leadership Show, "Élévations Silencieuses" Mandarin Oriental, Mohamed Mourabiti, Mahi Binebine.

### Section 12 — Editorial feature strips (2 stacked "dossier" promos)
Each is a wide banner/split block: image + title + paragraph + link "Retrouvez ici l'intégralité du dossier".
1. **"Un Maroc épatant, dans un mondial éclatant"** — paragraph about the Lions de l'Atlas at the World Cup → links to `/sport/un-maroc-epatant-dans-un-mondial-eclatant/`.
2. **"Ce que pensent les hommes…"** — paragraph about men/love/psychology → links to the Grand Angle psy article.
(These also carry a "Le Luxe" banner image linking to `/le-luxe/` — keep as clickable banner above/beside each strip.)

### Section 13 — Toutes nos unes (magazine covers)
- Section title "Toutes nos unes".
- Grid/carousel of **4 latest magazine issue covers** (portrait cover image + issue title + date) + "Voir plus" → `/magazine-maroc/`.
- Example: VH N°201 (Marche Verte collector), VH N°200, VH N°199 (Salon du Cheval), VH N°198.

### Section 14 — Footer (see 4.3)

---

## 6. Reusable Components (build these once)

1. `<TopBar />` — utility links + socials.
2. `<Header />` — logo, nav with dropdown, search, sticky variant, mobile drawer.
3. `<SectionHeader title href />` — the black band/uppercase category header.
4. `<ArticleCard />` — image, title (2-line clamp), date. Variants: `default` (grid), `horizontal` (sidebar list with small thumb), `video` (play icon overlay), `cover` (portrait ratio for magazine covers).
5. `<CategoryBlock category count layout />` — SectionHeader + grid of ArticleCards + "Voir plus". Powers Actu/Lifestyle/Moteur/People/Vidéos blocks.
6. `<SidebarWidget title>` wrapper + specific widgets: `<PromoBanner />`, `<NewsletterForm />`, `<InstagramCard />`, `<MostRead />`, `<LatestArticles />`.
7. `<DossierStrip />` — image + heading + paragraph + CTA link (Section 12).
8. `<CoverGrid />` — magazine issues grid.
9. `<Footer />`, `<BackToTop />`, `<SearchOverlay />`.
10. `<Breadcrumbs />` (article/category pages) + `<ShareButtons />` (article pages).

## 7. Other Pages to Replicate

- **Category page** (`/category/{slug}/`): category title header, paginated grid of ArticleCards (image, title, excerpt, date), sidebar with Most Read/Newsletter. Server-side pagination (`?page=n`) with proper `rel=prev/next` and canonical.
- **Article page** (`/{category}/{slug}/`): breadcrumb, H1 title, date + category badge, featured image, rich text body (support embedded images, YouTube embeds, Instagram embeds, blockquotes), share buttons, "Articles similaires" (related by category/tags), sidebar widgets. JSON-LD `NewsArticle`.
- **Les Unes / magazine-maroc**: grid of all magazine covers (portrait cards), each linking to a `/sommaire/{slug}/` page with the cover + issue summary.
- **VH TV** (`/vh-tv/`): grid of video articles.
- **Contact**: contact info + form (store submissions in Neon or send email).
- **Team VH**: static page with team presentation.
- **Search results** (`/?s=` equivalent → `/recherche?q=`): full-text search over titles/excerpts (Postgres `tsvector` on Neon).

## 8. Data Model (Neon / Postgres)

```sql
categories(id, name, slug, description, parent_id, created_at)
articles(id, title, slug, excerpt, body_richtext/json, featured_image_url,
         category_id, status, published_at, view_count, is_video, video_url,
         seo_title, seo_description, created_at, updated_at)
article_tags(article_id, tag_id) / tags(id, name, slug)
magazine_issues(id, number, title, slug, cover_image_url, summary, published_at)
newsletter_subscribers(id, email, created_at, confirmed)
banners(id, key, image_url, link_url, title, active)   -- collector, podcast, who's who, cool drives, le luxe, unes banner
contact_messages(id, name, email, subject, message, created_at)
```

- Add a simple admin (or use Claude Code to scaffold a minimal protected `/admin` CRUD, or plug a headless CMS later) — but v1 can seed from scraped content.
- Images: upload to Vercel Blob, store the blob URL in DB, render with `next/image` (with `sizes` per card variant).

## 9. Performance & SEO Requirements

- Lighthouse targets: 90+ performance mobile, 100 SEO.
- SSG/ISR: homepage revalidate ~5 min; articles static with on-demand revalidation.
- `next/image` with AVIF/WebP, explicit width/height to kill CLS, lazy-load below the fold, priority on the first Actu card images.
- Font: self-hosted via `next/font`, `display: swap`.
- Replace Instagram/YouTube heavy embeds with lite facades (thumbnail + click-to-load).
- Semantic HTML: one `<h1>` per page (homepage: visually-hidden brand h1 or the top section), `<h2>` for section headers, `<article>` for cards.
- Metadata parity with current site: title pattern `"{Page} | VH Magazine Maroc | VH Magazine"`, OG image fallback banner, twitter `@VH_Magazine`.
- Sitemap + RSS auto-generated. 301 redirect map from any changed old URLs.

## 10. Modernization Touches (allowed, subtle)

- Consistent spacing scale, slightly larger card imagery, soft image zoom on hover, red underline/accent on hover for titles.
- Sticky header with backdrop blur.
- Skeleton loaders for client-fetched widgets (Most Read).
- Dark section bands kept, but with refined typography (letter-spacing on uppercase labels).
- Fully responsive: 1 column mobile, 2 columns tablet, 3–4 columns desktop for card grids; sidebar drops below main content on mobile.

## 11. Build Order Suggestion (for Claude Code)

1. Scaffold Next.js + Tailwind + Neon (Drizzle or Prisma) + Blob setup.
2. Global layout: TopBar, Header (+mobile drawer, dropdown, search), Footer.
3. Core components: SectionHeader, ArticleCard variants, CategoryBlock.
4. Homepage assembly in the exact section order of §5, with seed/mock data.
5. Article + Category pages, then Les Unes/sommaire, VH TV, Contact, Team, Search.
6. Newsletter form + API, view counter, Most Read.
7. SEO layer: metadata, JSON-LD, sitemap, RSS, redirects.
8. Content migration script (scrape/import from vh.ma into Neon + Blob).
