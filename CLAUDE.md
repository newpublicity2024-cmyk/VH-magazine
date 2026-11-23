# VH Magazine (vh.ma)

Next.js 16 (App Router) + Payload CMS 3.85 + Postgres. French LTR magazine,
rebuilt from WordPress + WPBakery. Sister sites: `MFM-sport`, `lallafatema`.

Source of truth for scope: `vh-magazine-website-spec.md`, `vh_homepage_wireframe.svg`,
and the amendments + inventory in `PLAN.md`. Acceptance lives in `GATES.md`.

## Session state (2026-11-23)

**What is left before launch: `LAUNCH.md`** (owner inputs, engineering steps, critical path).

- **2026-11-23 — archive refresh (migration `GATES-P6R.md`), user go-ahead for the refresh and its Blob
  uploads only** (NOT the Neon push, `MEDIA_ORIGIN`, or deleting `rabat.jpg` — all still pending).
  `vh_migration` = live vh.ma at 14:32 UTC: 8,158 articles (+11), 200 issues, 31,308 media (+77).
  Fixed on branch **`migration/p6-refresh`** (local, not pushed; the launch-day sync must run from it
  or after it merges): `import-articles.ts` now converges existing articles on their conversion
  (before, only the date — WordPress edits after a post's first import were silently dropped) and
  has `--dry-run`. In the migration workspace: the converter keeps site links Payload would mangle
  absolute (see landmine), P5-import:G2 compares whole bodies, verify-p6 compares the survey with the
  delta's listing time. Migration ledgers from reset: P1 7/7, P3 7/8 (`rabat.jpg`), P4 9/9, P5-rest
  7/7, P5-import 8/8, P5-convert 7/7, P6 2/2, P6R 8/8. `.next` now holds a build of
  2026-11-23 whose ISR cache was filled from `vh_migration` — rebuild before any `vh_magazine` HTML gate.

- **2026-11-19 finishing pass — ledger `GATES-FINISH.md`; merged to `main` as PR #2 (d031cd9) and
  deployed to production the same day** (pushed with the fine-grained token the user keeps in `.env`
  as `fine_grained_token ` — note the space before `=`; read by one-shot helpers, never printed). Production (`vh-magazine-iota.vercel.app`) had its first database-backed build at
  09:47 UTC (the user set `DATABASE_URL`/`PAYLOAD_SECRET`); `MEDIA_ORIGIN` is still empty there.
  Fixed on production directly, with the user's go-ahead: the seed's public default admin password
  worked (rotated; credential in git-ignored `production-admin.txt`) and every image 404'd (the
  seed's 282 files uploaded to Blob, recorded in the migration's `manifests/seed-blob-uploads.jsonl`).
  Built: body search (migration `20261119_120000_search_body`), ISR for articles and issues (+ a
  pnpm patch of Next, see landmines), 200 magazine issues (`import-issues.ts`), WordPress
  `/page/N/` redirects in the proxy, the step-3 push tool (`push-archive.ts`, rehearsed), and
  `scripts/verify-deployed.mjs` for any deployment. P6 rehearsed (migration `GATES-P6.md`).
  The GitHub repository is PUBLIC; the old WordPress server still serves five public DB dumps.
  Re-run from a reset that day: `GATES.md` 61/62 (R3-G3), `GATES-FINISH.md` 13/13,
  `GATES-LAUNCH.md` 7/7 + L4 abandoned; migration P1/P4/P5-*/P6 all met, P3 7/8 (one orphan blob,
  `rabat.jpg` — `blob-orphans.ts --delete` needs the user's go-ahead).
  **Payload locks an account for 10 min after 5 failed logins** — never probe a real account
  with a wrong password from a verifier (it locked production's admin on 2026-11-19).

- **Round 1 — accepted** (2026-08-30). Spec §11 steps 1–4, gates G1–G19.
- **Round 2a — built, pushed, deployed; no recorded user acceptance.** Steps 5–7
  (all page types, search, view counter, SEO layer, redirects), gates G20–G39,
  contract `PLAN-2A.md`. Deployed on Vercel (project `vh-magazine`, team
  `newpublicitys-projects`) — but **production has never served data**: its `DATABASE_URL` and
  `PAYLOAD_SECRET` are empty (every production build log, 2026-08-31 and 2026-11-19: "Skipping
  migrations … not set"; pages are empty shells). The seed lives in Neon project VH-Magazine
  (`quiet-block-93024667`), branch `production`, put there from this Mac. Preview has its own
  working `DATABASE_URL` + `PAYLOAD_SECRET` (Neon branch `preview`, 2026-11-19, verified).
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
- **Round 3 (design finish) — built 2026-11-12 on branch `design/round-3`, approved by the
  owner 2026-11-17** (relayed by the user; R3-G12 met). From `migration/media-import`;
  **merged to `main` 2026-11-19** (PR #1, merge commit 79c4396; pushed with the
  newpublicity2024-cmyk fine-grained token). `DESIGN-SPEC-R3.md` with amendments
  C1–C5; D1–D8 all accepted as recommended. Full ledger from reset: 60/62 runnable-met
  (2026-11-17, 61 RUN lines for 61 runnable gates), **61/62** with the owner's approval
  (R3-G12, manual). Open: **R3-G3** only — VH's logo SVGs (`public/vh-logo*.svg` and
  `vh-mark-white.svg` are fixed-but-placeholder). C5 (no global smooth scroll) is a
  deviation of mine the owner was never shown explicitly.
  `scripts/r3-baseline.json` is the pre-R3 perf baseline (commit 3ab214b) — never re-record.
- **Launch engineering (2026-11-17, same branch)** — the LAUNCH.md items that need no
  go-ahead: step 5 (direct Blob media URLs, optimizer limited to the store) and step 7
  (`src/proxy.ts`, the 29 WordPress pages decided in `src/migrate/wp-pages.ts`), plus the
  admin import map regenerated with the Blob adapter on and JSON-LD file URLs fixed. Ledger
  `GATES-LAUNCH.md`: 7/7 runnable met (7 RUN lines), **L4 abandoned** (404 body — needs
  `cacheComponents`; handoff). `GATES.md` re-run from reset on that build: 61 RUN lines for 61
  runnable gates, 60 met — R3-G3 (logos) the only failure — so 61/62 with R3-G12.

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

- **Payload's Lexical link field percent-encodes any URL its `validateUrl` rejects** (richtext-lexical
  `features/link/server/baseFields.js`, `url` beforeChange → `encodeURIComponent`). A root-relative URL
  passes only `/^\/[\w\-./]*(\?[-;&=%\w]*)?(#[\w-]+)?$/` — no `%`, `~`, `,`, accents — so
  `/wp-content/uploads/…/Lettre-a%CC%80.pdf` is stored as `%2Fwp-content%2F…`, a dead link, and every
  re-save encodes again. Found 2026-11-23 (7 links, 5 migrated articles); the migration converter keeps
  such site links absolute. An editor pasting such a relative link in the admin hits it too.
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
- **Regenerate the admin import map after any editor or admin-component change — with the
  Blob adapter ON.** It was committed as `{}`, so the Articles body editor never rendered
  (`getFromImportMap: PayloadComponent not found`) and no gate noticed; G42 now opens an
  article in a browser. The adapter registers only when `BLOB_READ_WRITE_TOKEN` is set, so a
  map generated on this Mac silently dropped its `VercelBlobClientUploadHandler` (found
  2026-11-17). Generate with a powerless token naming the public store:
  `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_<storeid>_000000000000000000000000000000 pnpm generate:importmap`
  (`<storeid>` is the host prefix of any Blob URL). GATES-LAUNCH L2 compares the committed map
  with that output.
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
  it from the flight payload. Test 404s in a browser. Cause (Next 16.2.6 source, measured
  2026-11-17): app-render answers a page-thrown `notFound()` with `getErrorRSCPayload`, the
  `<html id="__next_error__">` shell, and server-renders a segment's not-found only under
  `cacheComponents`. Not the two root layouts: `app/global-not-found.tsx` +
  `experimental.globalNotFound` was built and measured — it serves only URLs no route
  matches, and the root catch-all `[...path]` matches every URL. Abandoned as GATES-LAUNCH L4.
- **`absoluteUrl()` is for pages, `absoluteFileUrl()` for files** (`lib/seo.ts`). The page
  helper appends the trailing slash, and Next 308s `/vh-logo.svg/` → `/vh-logo.svg`: JSON-LD
  image and logo URLs pointed at redirects until 2026-11-17 (G30 never requested them; L5 does).
- **With the Blob adapter on, Payload no longer serves `/api/media/file/*`**
  (`disablePayloadAccessControl`; only client-upload completion still uses it). Payload hands
  out direct Blob URLs through its afterRead hook, but the `media.url` columns still hold the
  import-time proxy path — anything reading media with SQL derives the URL with
  `mediaFileUrl()` (`lib/media-url.ts`), as live search does.
- **Pages prerendered at build carry the BUILD database's content** (`/`, contact, sondage,
  vh-tv, magazine-maroc, team). A server started against `vh_migration` on a `vh_magazine`
  build serves seed data there; judge only request-time pages (articles, categories, search)
  against `vh_migration`. Under `trailingSlash: true` the optimizer URL is `/_next/image/?url=`.
- **This Mac's network does DNS64, and `next start` then refuses every remote image** with
  `"url" parameter is not allowed`: the host also resolves to a NAT64 address
  (`64:ff9b::/96`), which Next's in-process optimizer counts as private. Not an app bug and not
  a Vercel concern (the platform optimizes against the build's allow-list). A gate that needs
  the local optimizer on a remote image measures it first and loads
  `scripts/lib/dns64-preload.cjs` into its server (see verify-launch-media-direct.mjs).
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

- **Next 16.2.6 is patched** (`patches/next@16.2.6.patch`, `pnpm-workspace.yaml`
  patchedDependencies): an ISR miss whose render redirects (`permanentRedirect` for a
  wrong-category article URL) sent `Location` twice — the render sets it, then the new cache
  entry's headers are appended — and fetch clients read "X, X" (G21 caught it). The patch skips
  the appended copy. `connection()` before the redirect is not an alternative: it 500s inside an
  ISR render. Re-check on any Next upgrade (pnpm refuses to install when the patch no longer applies).
- **Articles and issues are ISR** (empty `generateStaticParams`; before 2026-11-19 every article
  rendered per request, `private, no-store`). The publish hook purges everything
  (`revalidatePath('/', 'layout')`); scripts writing through their own Payload instance purge
  nothing, but redirects still work because the proxy runs ahead of the page cache. **The ISR
  cache in `.next` now crosses databases in BOTH directions**: three seed slugs also exist in the
  archive, and after the `vh_magazine` ledger a `vh_migration` server served the seed's cached
  pages (P5-import G3, 2026-11-19). Rebuild between a `vh_magazine` HTML run and a `vh_migration`
  serve run, whichever comes first.
- **Never wait for Playwright `networkidle` across back-to-back navigations.** A navigation that
  starts while link prefetches are in flight orphans them and `networkidle` never arrives (G26
  timed out three runs in a row; the server had answered the same requests in ms). Wait for
  `load` plus the element you need — `verify-contact.mjs` waits for React's `__reactProps` on the form.
- **The live site answers `/wp-json/wp/v2/users` with 403** since 2026-11-19 (it did not on 11-11):
  survey with `wprest-survey.mjs categories tags pages posts media`.
- **`verify-deployed.mjs --base <url> --canonical https://www.vh.ma`** checks any deployment
  without a local server (sitemap-driven sample); a protected one needs
  `VERCEL_AUTOMATION_BYPASS_SECRET`. Production's per-deployment URLs are behind Vercel
  Authentication; the `vh-magazine-iota.vercel.app` alias is public.

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
  AVIF/WebP and there is no CDN in front. Sources are direct Blob URLs (LAUNCH.md step 5,
  decided 2026-11-17), and `remotePatterns` admits this project's store only — the old
  `*.public.blob.vercel-storage.com` wildcard let anyone bill transformations to us. The
  store host is pinned in `next.config.ts`: Next freezes `images` into the build, so an
  allow-list derived from a token the build cannot read would refuse every migrated image.
  Video, audio and PDFs play straight from Blob, which serves byte ranges.
- The request interceptor is `src/proxy.ts` (Next 16 renamed middleware; it runs on the
  Node.js runtime and may not set `runtime`).
- **Legacy uploads** (`/wp-content/uploads/*`): the proxy rewrites to
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
pnpm dev            # localhost:3000, admin at /admin (admin@vh.ma / vhmagazine — dev seed only;
                    # production's admin was rotated 2026-11-19: production-admin.txt)
pnpm seed           # idempotent
pnpm migrate        # apply pending Payload migrations to DATABASE_URL (push is off)
pnpm build
pnpm generate:types # after any collection change
```
