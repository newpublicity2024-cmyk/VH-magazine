# Gates: VH Magazine — launch engineering (LAUNCH.md steps 5 and 7)

OWNS: src/proxy.ts, src/middleware.ts, src/payload.config.ts, src/app/(payload)/admin/importMap.js, next.config.ts, src/lib/media-url.ts, src/lib/seo.ts, src/lib/search.ts, src/app/(frontend)/[...path]/page.tsx, src/app/(frontend)/page.tsx, src/migrate/wp-pages.ts, src/migrate/import-page-redirects.ts, scripts/verify-launch-*.mjs, GATES-LAUNCH.md

Scope: the LAUNCH.md engineering items that need no go-ahead — image serving decided and
built (step 5), and the smaller items of step 7: the request interceptor renamed to Next 16's
`proxy`, 404 responses server-rendered, and every WordPress page the REST survey recorded
answered on purpose — plus two defects found on the way: the committed admin import map lacked
the Blob adapter's client-upload handler, and JSON-LD image URLs pointed at redirects.
Opened 2026-11-17 on branch `design/round-3`.

L4 is abandoned, not met (see the ABANDON line at the end). The first run (2026-11-17, 8 RUN
lines) built `app/global-not-found.tsx` behind `experimental.globalNotFound` and still measured
`__next_error__`; Next 16.2.6's source then showed why, and the attempt was reverted rather
than shipped as dead code: app-render answers a `notFound()` that reaches the shell with
`getErrorRSCPayload` (the empty error shell) on every path, and server-renders a segment's
not-found only under `cacheComponents` (`findPrerenderHTTPErrorBoundaryTree`); global-not-found
serves only URLs no route matches, and the root catch-all `[...path]` matches every URL. The
two root layouts are not the cause (CLAUDE.md's earlier theory).

Not here, by design: merge/push (step 1), P6 final sync (step 2), the Neon push (step 3), the
Vercel verification with real data (step 4) and cutover (step 6) each need the user's go-ahead
or come last; post 47196 → 47831 stays a content decision (migration PLAN: "it stays").

Run order matters. L2 regenerates nothing it does not restore; L3 builds; L4 and L5 serve that
build against `vh_magazine`; L6 and L7 serve it against `vh_migration` and therefore run last (a
`vh_migration` server can ISR-regenerate pages into `.next` — CLAUDE.md landmine). Only
request-time pages are judged against `vh_migration`: the homepage and the static pages are
prerendered at build time from the build's database. These changes alter the build, so after
this ledger the full `GATES.md` (from a reset), the migration `GATES-P4.md` (the legacy-media
rewrite runs in the interceptor) and `GATES-P5-import.md` (`/?p=` and tag redirects run in the
interceptor; G4 reads the redirects map) are reset to pending and re-run in full.

Negative controls observed before each fix (the verifier run against the unfixed code failed):
L2 — the committed map has no Blob client-upload handler; L3 — `src/middleware.ts` still
exists (and an earlier build log carries the deprecation warning the pattern is tested on);
L4 — every unknown path answered `__next_error__`; L5 — the Organization logo URL ends in a
slash (308); L6 — a request-time category page carried `/api/media/file/`; L7 — vh_migration
had no redirect row for /homepage/.

Runs 2 and 3 (7 RUN lines each) failed L6 on its positive control — the optimizer refused our
own store — for two causes, each fixed and then re-run from a reset: (1) Next freezes `images`
into the build, and the allow-list was derived from a token the build never had (now the store
host is pinned in next.config.ts); (2) this Mac's network does DNS64, so the store also
resolves to `64:ff9b::23b4:100c` (NAT64 of 35.180.16.12), which Next's in-process optimizer
treats as private. L6 measures that with Next's own lookup and guard and, only then, starts its
server with `scripts/lib/dns64-preload.cjs`, which drops exactly the synthesised addresses whose
IPv4 the same lookup returned; its output says when it did. The foreign-store control is
refused by the allow-list before any lookup.

- [x] L0: this ledger's oracles are lint-clean
  CHECK: node /Users/mc/.claude/skills/unlazy/scripts/gate-lint.mjs GATES-LAUNCH.md
  EXPECT: LINT OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=48630b7361dd44ee870917b12c3d19b9d7bdea738aaca16bb04d4cab83b772d2; output-bytes=8

- [x] L1: the whole project typechecks and passes its full ESLint run
  CHECK: pnpm exec tsc --noEmit && pnpm -s lint && echo LAUNCH_TYPES_LINT_OK
  EXPECT: LAUNCH_TYPES_LINT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=8453d6f1628ab9d110df6caaf83e30eebeae993b63098eda8341a39eecbc2698; output-bytes=314

- [x] L2: the committed admin import map is exactly what Payload generates for the production configuration — the Blob adapter on — so it carries the adapter's client-upload handler
  CHECK: node scripts/verify-launch-importmap.mjs
  EXPECT: IMPORTMAP_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=534422130f424c456d5a495cd637f825a590ec3545440c8ad0b07be78ecb0c84; output-bytes=118

- [x] L3: the production build completes without Next's "middleware file convention is deprecated" warning, the request interceptor is src/proxy.ts exporting `proxy` with its matcher unchanged, and no src/middleware.ts remains
  CHECK: node scripts/verify-launch-proxy.mjs
  EXPECT: LAUNCH_PROXY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=f8bf863aa970c861505425f61d846583ca68865da95b38ff9d8cdb71c2d7b517; output-bytes=120

- [ ] L4: an unknown URL's 404 is server-rendered inside the site chrome — status 404 with noindex, and the HTML before any script runs holds lang="fr", the masthead, the primary nav, the footer, one h1 "Page introuvable", the search form and 6 latest-article cards, on 1- to 4-segment catch-all, category and sommaire paths — and a browser with JavaScript disabled shows that h1 and those cards; a known page still answers 200 with its own h1
  CHECK: node scripts/verify-launch-404-ssr.mjs
  EXPECT: NOTFOUND_SSR_OK
  EVIDENCE: pending

- [x] L5: every image URL the seeded site puts in JSON-LD — an article's NewsArticle image and the homepage Organization logo — is absolute, has no trailing slash, and answers 200 with an image directly rather than through a redirect; the article's JSON-LD image is the same URL as its og:image
  CHECK: node scripts/verify-launch-jsonld-image.mjs
  EXPECT: JSONLD_IMAGE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=600d32c757a8790b52ccc1cafbb251d3cf66510f9b80dd2271a24b4e51d99fe7; output-bytes=133

- [x] L6: served against vh_migration with the Blob adapter on — given a powerless token that names only the public store — every media URL is a direct Blob URL: no /api/media/file/ in the HTML of a category, an article with a video, an article with body images and a search results page (not the homepage — it is prerendered from the build's database), nor in the articles' og:image or JSON-LD, nor in live-search thumbnails; the video answers a Range request with 206 and exactly the requested bytes of a file of its recorded size; an image candidate comes back from the optimizer as AVIF or WebP; and the optimizer refuses the same request for another Blob store
  CHECK: node scripts/verify-launch-media-direct.mjs
  EXPECT: MEDIA_DIRECT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=56d1202c0f53c5bc1bd86f0af60b2a692027f4fc78a42af048a6e59dce6d457c; output-bytes=437

- [x] L7: each WordPress page the REST survey recorded has exactly one decision, consistent with its content (only theme-demo or empty pages may 404), and the build served against vh_migration answers each as decided — the app's own pages 200 at the same URL, each redirected page a single 301 to a page that answers 200, the rest 404 — while a planted wrong decision is caught
  CHECK: node scripts/verify-launch-wp-pages.mjs
  EXPECT: WP_PAGES_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=cb880aa38c8139625d8350351beafc47a39e0ead51afd68655ab8bf56c088da6; output-bytes=113

ABANDON: L4 Not achievable on Next 16.2.6 without enabling cacheComponents — app-render renders a page-thrown notFound() as the empty __next_error__ shell unless cacheComponents is on, and global-not-found never runs because the root catch-all [...path] matches every URL. Enabling cacheComponents replaces every `revalidate` export with 'use cache' and Suspense boundaries: a caching refactor of the whole app, for a later round or a Next release that server-renders not-found without it. Until then R3-G16 and R3-G11 gate the designed 404 as rendered after hydration; status stays 404 (G37). Handoff to the user.
