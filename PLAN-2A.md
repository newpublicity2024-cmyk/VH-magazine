# VH Magazine — round 2a contract

Spec §11 step 5 (all remaining page types), step 6 (view counter, search) and
step 7 (the full SEO layer). **The migration scraper is round 2b**, by decision.

Round 1 (§11 steps 1–4) is complete and accepted: 19/19 gates. Its contract and
deferred register live in `PLAN.md`; standing harness policy in `CLAUDE.md`.

Contract revision: **r2a** (approved with amendments B1–B5 + three riders)

---

## Decisions taken before planning

| Question | Chosen |
|---|---|
| Scope | **2a = pages + SEO + search + counter; 2b = migration.** A complete, reviewable site before a multi-hour import starts |
| Media | **Lazy migration on first request** — see B1 for the cutover model |
| Tag archives | **Only tags with ≥1 published post** get a 301 to their most common category (2b) |
| Search | **Postgres `tsvector`** per spec §7 — French dictionary + `unaccent` + GIN index. No extra service |

## Measured facts about the live site

Probed via the open WordPress REST API (`/wp-json/wp/v2/`, needs a User-Agent):

| | count |
|---|---|
| posts | 8,170 |
| categories | 131 |
| tags | 28,628 |
| media | 27,817 |
| pages | 29 |

Throughput to vh.ma: **~22 KB/s**; average image **151 KB**. Featured images
alone would be ~1.2 GB ≈ 16 h — which is why media migrates lazily.

**A1 validated at scale.** 500 posts sampled across the archive: 429 two-segment
URLs, 71 three-segment, **zero outliers**. The 2-or-3 segment assumption holds,
and D2's "scraper must reject 4+ segments" is the correct guard.

Posts carry Yoast SEO fields, so migrated meta descriptions come from the source
rather than being regenerated.

---

## Approved amendments (B1–B5)

### B1 — Cutover model and lazy media

The site runs on a temporary Vercel domain for a validation period while the old
WordPress stays live at vh.ma; then DNS switches and the old site is retired.
Consequences:

- The lazy-media route reads its upstream from **`MEDIA_ORIGIN`** (initially
  `https://www.vh.ma`, switchable to an origin IP or `old.vh.ma` if the old
  server moves). **No hardcoded host anywhere in the media path.**
- **~27.8k indexed `/wp-content/uploads/*` URLs must keep working.** Middleware
  matches that prefix and routes to the lazy-media handler, which persists the
  file to Blob on first hit and **301s to the Blob URL** thereafter.
- The validation period doubles as the **warm-up window**. A warm script is a
  **2b deliverable**: given a URL list (most-visited articles + the ~200 most
  recent), it requests each page and its media so images persist to Blob before
  cutover.
- **Cutover prerequisite, recorded:** the old WordPress must stay reachable
  until the media sweep completes. Killing it early leaves cold images 404ing.

### B2 — Absolute-domain policy for every SEO surface

Canonicals, `sitemap.xml`, `news-sitemap.xml`, `rss.xml`, JSON-LD, OG/Twitter
URLs and the `Sitemap:` line in `robots.txt` **always** use `https://www.vh.ma`
via `NEXT_PUBLIC_SERVER_URL` — never the deployment host, never a relative URL
resolved against it. Nothing in the markup changes at cutover; only DNS does.

### B3 — Host-based staging noindex

Every response whose **request host is not `vh.ma` or `www.vh.ma`** carries
`X-Robots-Tag: noindex`. Host-based rather than flag-based, so the temp Vercel
domain stays out of the index during validation and the protection **self-
resolves at DNS switch with no flag to remember to flip**. Gate G39.

### B4 — Wrong-category article paths 301, they do not 404

The catch-all's mismatch branch **301s to `articleUrl(article)`**, matching
WordPress/Yoast canonical-redirect behaviour and recovering equity from
malformed legacy backlinks. Only a genuinely unknown slug 404s.

### B5 — Redirect map stays small by design

Tag redirects are **not** inlined. `/tag/*`, `/wp-content/uploads/*` and
`/?p={id}` are handled by middleware prefix/pattern match → a lookup route
handler that issues the 301 from a DB query. The JSON map carries **only
irregular one-off redirects**. G38's byte budget stays as a tripwire.

### Riders

- Paginated category pages **self-canonical to their own `?page=n`**, not to
  page 1 (asserted in G22).
- The contact form carries a **honeypot** field (G26).
- `news-sitemap.xml` includes **only articles from the last 48 h** (G31).

---

## Scope

**In:** article page, category page (paginated, nested), `/sommaire/{slug}/`,
`/magazine-maroc/`, `/vh-tv/`, `/contact/` (+ form), `/rafik-lahlou-team-vh/`,
`/sondage/`, `/recherche`, view counter, JSON-LD, `sitemap.xml`,
`news-sitemap.xml`, `rss.xml`, `robots.txt`, redirect middleware, the
`/wp-content/uploads/*` + `/tag/*` + `/?p=` lookup paths, host-based noindex,
and **D3** (the A→B→A rename gate).

**Out (round 2b):** the scraper, the 8,170-post import, tag-archive inventory
(**D1**), the scraper's segment assertion (**D2**), the media warm script, and
the bulk media sweep. **D4** (visual punch list) folds in when the list arrives.

---

## Architecture

### Routing — the one genuinely risky piece

The article route is a catch-all `src/app/(frontend)/[...path]/page.tsx` that
must not swallow the named routes. Next resolves static segments before a
catch-all, so `/category/…`, `/sommaire/…`, `/vh-tv/`, `/contact/` win — but
only if they exist as real route segments, which is why they are all built now.

The catch-all **validates the whole path**: it resolves the article by slug,
rebuilds the canonical path via `articleUrl()`, and on mismatch **301s** to the
canonical (B4). Without that, `/sport/porsche-licone-sous-pression/` would
render an article that lives at `/moteur/vh-moteur/…` — duplicate content on a
rebuild whose entire purpose is SEO continuity.

### Redirect and legacy-URL handling

| Pattern | Handled by |
|---|---|
| `/wp-content/uploads/*` | middleware → lazy-media handler → persist → 301 to Blob |
| `/tag/*` | middleware → lookup route → 301 from DB (2b populates) |
| `/?p={id}` | middleware → lookup route → 301 from DB |
| irregular one-offs | `/redirects-map.json`, fetched once per runtime, module-cached |

Middleware runs on the edge and cannot use the Payload Local API, hence the
lookup route rather than a direct query.

### View counter

`POST /api/view` increments `viewCount`, called after mount. Deduped per reader
per article via `sessionStorage` so a re-render or back-navigation cannot
inflate it, and rate-limited server-side per IP+article.

### Search

A generated `tsvector` over title + excerpt with the `french` config and
`unaccent`, plus a GIN index, added by a Payload migration. Queried with
**parameterised** SQL through the existing pool — never interpolation (G28
includes an injection probe).

### Components to add

`Breadcrumbs`, `ShareButtons`, `Pagination`, `RelatedArticles`, `RichTextBody`
(Lexical → HTML), `ArticleView`, `SearchForm`/`SearchResults`, `ContactForm`,
`JsonLd`, `VideoEmbed` (lite YouTube facade per spec §9).

---

## Requirement inventory

| id | Requirement | Source | Gate |
|---|---|---|---|
| R26 | Article page renders with H1, breadcrumb, date, body, share buttons | §7 | G20 |
| R27 | Catch-all resolves 2- and 3-segment URLs; wrong parent path 301s to canonical; unknown slug 404s | A1, B4 | G21 |
| R28 | Category page paginates; correct per-page count; rel prev/next; page N self-canonicals | §7, rider | G22 |
| R29 | Nested category resolves and lists only its own posts | A1 | G23 |
| R30 | `/magazine-maroc/` and `/sommaire/{slug}/` render | §7 | G24 |
| R31 | `/vh-tv/` lists video articles | §7 | G25 |
| R32 | Contact form stores a row; invalid email rejected; honeypot blocks bots | §7, rider | G26 |
| R33 | Team VH and Sondage pages render | §4.1, §7 | G27 |
| R34 | Search finds an accented French term; injection-safe; empty query handled | §7 | G28 |
| R35 | View counter increments once per reader, not per render | §5.4.5 | G29 |
| R36 | JSON-LD valid: NewsArticle, BreadcrumbList, WebSite, Organization | §2 | G30 |
| R37 | sitemap covers published content, absolute vh.ma URLs, no drafts; news-sitemap is last-48h only | §9, B2, rider | G31 |
| R38 | RSS is valid XML with absolute vh.ma links | §9, B2 | G32 |
| R39 | robots.txt correct; Sitemap line is absolute vh.ma | §2, B2 | G33 |
| R40 | Middleware 301s an old URL; never redirects a live one | A3 | G34 |
| R41 | A→B→A rename leaves the reused URL resolving | D3 | G35 |
| R42 | Every page type: exactly one h1 and a self-referencing absolute canonical | §9, B2 | G36 |
| R43 | Unknown paths return a real 404 status | §9 | G37 |
| R44 | Redirect map stays under its size budget | B5 | G38 |
| R45 | Foreign host gets X-Robots-Tag noindex; vh.ma does not | B3 | G39 |
| R46 | Round 1's 19 gates still pass (regression) | — | G1–G19 |

---

## Gates

`GATES.md` gains **G20–G39**; G1–G19 stay and re-run every pass, so round 1 is
regression-checked for free. **Ledger total: 39.**

Negative controls, per standing policy — each run against a broken fixture and
recorded before the gate is trusted:

| Gate | Control | Must observe |
|---|---|---|
| G21 | canonical path requested directly | 200, not a redirect loop |
| G21 | genuinely unknown slug | 404, proving the 301 branch is not blanket |
| G26 | honeypot field filled | silently rejected, no row written |
| G28 | `'; drop table articles; --` as query | no error, no damage, empty result |
| G31 | a draft article | absent from sitemap |
| G34 | a URL that is live, not redirected | 200, not 301 |
| G37 | a path that exists | 200, proving the 404 check is not blanket |
| G39 | `Host: www.vh.ma` | noindex header ABSENT, proving it is host-conditional |

## Standing harness policy (from CLAUDE.md)

1. `RUN` line count must equal the gate count before any result is reported.
2. Reset every gate to `EVIDENCE: pending` after any verifier/harness/build
   change, so nothing inherits stale green.
3. No gate is reported met without a current RUN line for it.

## Verification

```
pnpm generate:types && pnpm build
node <skill>/scripts/gate-check.mjs --status GATES.md
node <skill>/scripts/gate-check.mjs --approve GATES.md
grep -c '^  RUN  GATES:' <log>      # must equal 39
```

## Open risks

- **Redirect-map size.** B5 keeps tag redirects out of the map, so the ceiling
  should hold; G38 remains the tripwire.
- **`unaccent` extension** must exist in the local Postgres; creating it needs
  superuser on some hosts. Neon supports it. Verified within G28.
- **8,170 articles do not exist yet.** Every page gate runs against the 33
  seeded articles; pagination and sitemap behaviour at real scale is proven only
  in 2b. Stated, not assumed away.
- **Cutover depends on the old host** staying reachable until the media sweep
  completes (B1).
