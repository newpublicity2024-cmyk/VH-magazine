# VH Magazine (vh.ma)

Next.js 16 (App Router) + Payload CMS 3.85 + Postgres. French LTR magazine,
rebuilt from WordPress + WPBakery. Sister sites: `MFM-sport`, `lallafatema`.

Source of truth for scope: `vh-magazine-website-spec.md`, `vh_homepage_wireframe.svg`,
and the amendments + inventory in `PLAN.md`. Acceptance lives in `GATES.md`.

## Session state (2026-11-17)

- **Round 1 — accepted** (2026-08-30). Spec §11 steps 1–4, gates G1–G19.
- **Round 2a — built, pushed, deployed; no recorded user acceptance.** Steps 5–7
  (all page types, search, view counter, SEO layer, redirects), gates G20–G39,
  contract `PLAN-2A.md`. Live as a prototype on Vercel (project `vh-magazine`,
  team `newpublicitys-projects`) serving the seeded demo content.
- **Round 2b — in progress**, step 8 (migrate the real vh.ma). Driven from
  `/Users/mc/work/hostinger-ftp/migration/` — its own `PLAN.md` and per-phase
  ledgers `GATES-P*.md`; read that PLAN first. Code lives on branch
  `migration/media-import` (not pushed). P1–P4 done: 31,131 media originals in
  Blob + the local `vh_migration` DB, and `/api/legacy-media` resolves every
  legacy upload URL. P5 runs over the live site's **public REST API** (Remote
  MySQL stays closed — the Mac's IP rotates daily): 8,121 of 8,128 articles,
  130 categories, 27,946 tags and 36,177 redirects are in `vh_migration`
  (`src/migrate/import-articles.ts`); 7 wait for P6, the 202 magazine-issue
  posts wait on an owner decision. Nothing is in Neon yet. 2026-11-17: the one
  article WordPress dates 1970-01-01 (post 47196) is dated by its modified date;
  the importer's re-runs now converge dates and reproduce their reports; the WP DB
  tools' mysql2 is 3.24.6 (they still cannot reach the live DB — IP allowlist).
  These fixes are committed on `design/round-3` only, not on `migration/media-import`.
- `GATES.md` = G1–G44 + R3-G0–R3-G17 (62 gates, 61 runnable). G40–G41 (2026-11-11)
  cover two nav links G12 checked by text but never requested — Grand Angle and KIT MEDIA
  both 404'd. G42 opens an article in the admin (the editor had never rendered).
  G43–G44 (2026-11-17): the writer gates (G19, G34, G35) clean up on every path, and
  vh_magazine holds no gate debris (one stray G35 article and 100 test versions were removed).
- Still open from round 1: the D4 visual punch list never arrived (R3-G12 now carries it).
- **Round 3 (design finish) — built 2026-11-12 on branch `design/round-3`** (from
  `migration/media-import`; not pushed, not merged). `DESIGN-SPEC-R3.md` with amendments
  C1–C5; D1–D8 all accepted as recommended. Full ledger from reset: **60/62 met**
  (2026-11-17, 61 RUN lines for 61 runnable gates). Open,
  both owner inputs: **R3-G3** (VH's logo SVGs — `public/vh-logo*.svg` and
  `vh-mark-white.svg` are fixed-but-placeholder) and **R3-G12** (written approval of the
  `.playwright-mcp/r3-after-*` screenshots; `r3-before-*` for comparison). C5 (no global
  smooth scroll) is a deviation of mine the owner has not yet seen.
  `scripts/r3-baseline.json` is the pre-R3 perf baseline (commit 3ab214b) — never re-record.

## Standing harness policy

These are permanent, and they exist because each was learned from a checker that
reported something other than what it measured.

1. **RUN count must equal gate count.** Before characterising any ledger result,
   confirm `grep -c '^  RUN  GATES:'` equals the number of gates. A run once
   printed `ALL MET (19 met)` having executed only two — the other 17 were
   counted from evidence stored before a harness fix. A summary line agreeing
   with itself is not evidence.
2. **Fresh-evidence reset.** Deleting `~/.unlazy/approved` clears approvals but
   NOT the ledger's checked boxes. After any change to a verifier, the harness,
   or the build, reset every gate to `- [ ]` with `EVIDENCE: pending` before
   re-running, so nothing can inherit stale green.
3. **Never report a gate as met without a current RUN line for it.**

## Landmines

- **Never use a fixed port for a test server.** A leaked `next start` holds the
  port and later gates silently test a stale bundle. `withServer` takes a fresh
  OS-assigned port per call and fails loudly if a response arrives while its own
  child is dead.
- **Never `lsof -ti :PORT | xargs kill -9`.** `lsof` lists the *client* side too,
  so the verifier kills itself after its assertions pass and the checker records
  a SIGKILL as a failure. Filter to `-sTCP:LISTEN` and exclude the self PID.
- **Strip `<script>` before counting anything in the HTML.** Next embeds the RSC
  flight payload as a serialised copy of the tree, so every attribute appears
  twice (card counts measured 84 instead of 42).
- **`spawn(detached: true)` holds the parent's event loop.** `unref()` the child;
  `ok()` flushes stdout then exits explicitly.
- **Next 16's `priority` does not emit `fetchpriority="high"`.** Set it explicitly
  on the LCP image.
- **A client component that mounts content only while open is invisible to
  crawlers.** Render it always and toggle visibility (see `MainNav`).
- **A gate that checks a link's text has not checked the link.** G12 passed for
  months over two 404s. G40 requests every internal nav link; extend it, don't
  trust labels.
- **Two local databases.** `vh_magazine` is dev + seed (every gate in this repo);
  `vh_migration` is the import target — never seed it. A server started against
  `vh_migration` can ISR-regenerate cached pages from it into `.next`, so rebuild
  (G6) before running this repo's HTML gates after any P-phase gate.
- **`next/link` prefetches internal hrefs.** An internal link to a file (the
  KIT MEDIA PDF) must carry `prefetch={false}`, or every desktop page view
  downloads it.
- **Fonts are vendored (`src/fonts`, `next/font/local`), never `next/font/google`.** Since
  2026-11-11 Google answers plain HTTP/1.1 font requests with `/l/font?kit=…&skey=…` URLs;
  Turbopack's font fetch makes exactly that request and cannot carry a `&` in its font-file
  query ("next/font/google queries have exactly one entry") — builds fail, and one build
  shipped Archivo as a dead internal URL without failing. Check shipped CSS, not exit codes.
- **Regenerate the admin import map after any editor or admin-component change**
  (`pnpm generate:importmap`). It was committed as `{}`, so the Articles body
  editor never rendered (`getFromImportMap: PayloadComponent not found`) and no
  gate noticed; G42 now opens an article in a browser.
- **Harness `fail()`/`ok()` call `process.exit`**, which skips `finally`. `withServer`
  now kills its server from an `exit` listener; before that every failing gate left a
  `next start` running. Inside a browser callback, throw rather than `assert`, so
  chromium closes too.
- **Filter redirects in SQL, never fetch-then-filter.** At migration scale the
  table holds ~36k rows; the map route's old `limit: 5000` + filter would have cut
  one-off redirects at random and inlined 8k `?p=` rows (query strings never match
  the map's pathname keys).
- **Vercel Blob serves HTML as `Content-Disposition: attachment`.** The legacy
  newsletters are proxied inline under a `sandbox` CSP instead of redirected.
- **No attribute may start with `data-card` except `data-card` itself.** G9, G24 and G25
  count the substring; `data-card-media` / `-title` tripled every count. Card parts are
  `data-media` and `data-headline`.
- **Unlayered CSS beats every `@layer` rule regardless of specificity.** The opt-in motion
  block in `styles.css` is unlayered, so a rule there overrides the layered open *and*
  closed states: restate both (the drawer stayed `visibility: hidden` 320 ms after opening,
  and `focus()` on it silently did nothing).
- **Never add layout-changing UI after hydration.** The native-share button appended from JS
  wrapped the share row: CLS 0.05 on mobile articles. Decide with CSS media queries
  (`pointer-coarse:`); R3-G10 now asserts Lighthouse CLS ≤ 0.02.
- **A `notFound()` response has no server-rendered body** — not even the layout; React draws
  it from the flight payload (two root layouts; pre-dates round 3). Test 404s in a browser.
- **The harness `ok()` exits only after stdout flushes**: code after it keeps running. Never
  call it mid-script; branch instead.
- **Chromium reports layout boxes inside a closed `<details>`** (`content-visibility`): use
  `el.checkVisibility()`, not `getBoundingClientRect()`, to ask "can a reader see this".
- **Delete an article's versions before the article.** `_articles_v.parent_id` is
  `ON DELETE SET NULL`: delete the article first and its versions survive with a null parent,
  where `delete … where parent_id = $1` can no longer find them (97 orphans had piled up from
  G19/G35 by 2026-11-17). Use `deleteGateRows` in `scripts/lib/harness.mjs`.
- **A gate that writes to the database runs its checks inside `withCleanup`, with `check()` /
  `checkEqual()`** — `assert()` exits and skips the cleanup (G35 once left an article in
  "Derniers articles"). Stamp every throwaway slug `g<NN>-…-<ms>` and sweep stale rows at
  start. G43 makes each writer fail on purpose and counts what it left; G44 measures the DB.
- **WordPress answers a zeroed post date with the Unix epoch** (post 47196: `date` and
  `date_gmt` both 1970-01-01). The converter dates such a post by its modified date and says
  so in `publishedFrom`; the importer converges existing articles' `publishedAt` through
  `payload.update` — never SQL alone, since the admin editor opens the latest *version*.

## Conventions

- Frontend reads Payload through the **Local API** (`getPayloadClient`), never
  REST/GraphQL. Article queries need `depth: 2` so the category parent chain is
  populated — without it nested URLs silently collapse to two segments.
- **URL scheme is load-bearing for SEO** and mirrors WordPress exactly:
  articles `/{categoryPath}/{slug}/` (2 **or** 3 segments), categories
  `/category/{path}/`, `trailingSlash: true`. Build every URL through
  `lib/routes.ts`; canonicals come from the same helpers so served URL and
  canonical cannot drift.
- `slugify` folds diacritics and **drops** apostrophes, reproducing the live
  URLs (`Porsche, l'icône sous pression` → `porsche-licone-sous-pression`).
  Changing it breaks SEO continuity on every migrated URL.
- Renaming a published article auto-creates a redirect and **repoints** rather
  than chaining (`hooks/redirects.ts`). Pass `context: { skipRedirects: true }`
  from seeds and scripts.
- Images use Next's own optimizer (unlike the sister sites) — spec §9 wants
  AVIF/WebP and there is no CDN in front. Revisit at deploy time for Vercel quota.
- **Legacy uploads** (`/wp-content/uploads/*`): middleware rewrites to
  `/api/legacy-media`, which resolves through `Media.legacyPath` with the rules in
  `lib/legacy-media.ts` (exact → `-WxH` folded → `-scaled` folded; NFC and NFD
  forms of each). Hit → 301 to the Blob URL, derived exactly as Payload's
  Blob adapter derives it. Miss on a media extension → 302 to `MEDIA_ORIGIN`,
  except when that origin is this site (post-cutover loop guard) → 404.
  Non-media paths always 404. Nav links to old uploads keep the live URL
  (`STATIC_ROUTES.kitMedia`).

- **Migrated article bodies** are Lexical built from WordPress HTML in the migration
  workspace (`tools/wp-lexical.mjs`); in-text YouTube is the `videoEmbed` block
  (`blocks/VideoEmbed.ts`, URL rule shared with the facade via `lib/youtube.ts`), and
  video/audio uploads play natively in `RichTextBody`. An empty body is stored as none —
  Lexical rejects an empty root.

## Approved deviations from the spec

| Spec | Deviation | Reason |
|---|---|---|
| §3 grey `#888–#999` | `--color-meta: #757575` | `#8a8a8a` is 3.45:1 on white — fails WCAG AA across 53 elements. Colour is a modernization-pass item (§10), so AA wins. **User-approved.** Do not restore. |
| §8 Drizzle/Prisma + custom admin | Payload CMS 3 | Matches sister sites; admin, media, drafts, rich text come for free. **User-approved.** |
| Wireframe pairing | Collector, Cool Drives and both Dossiers are full-width stacked | The sketch compacted them; spec §5 and the live site stack them. **User-approved (A2).** |
| §3 "VH signature red ~#e31e24" | Accent `#166fc1` (VH blue, `--color-accent`) | Never verified; vh.ma's theme accent is `#026bb3`, the 2024 logo `#166fc1`, and `#e31e24` appears nowhere. **Owner decision 2026-11-12 (R3 amendment C1).** Do not reintroduce red. |

## Commands

```
pnpm dev            # localhost:3000, admin at /admin (admin@vh.ma / vhmagazine)
pnpm seed           # idempotent
pnpm migrate        # apply pending Payload migrations to DATABASE_URL (push is off)
pnpm build
pnpm generate:types # after any collection change
```
