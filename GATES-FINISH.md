# Gates: VH Magazine — finishing pass (2026-11-19)

OWNS: src/proxy.ts, scripts/verify-wp-pagination.mjs, scripts/verify-contact.mjs, patches/next@16.2.6.patch, pnpm-workspace.yaml, pnpm-lock.yaml, CLAUDE.md, LAUNCH.md, GATES.md, src/migrations/20261119_120000_search_body.ts, src/migrations/index.ts, src/lib/search.ts, src/app/(frontend)/recherche/page.tsx, src/app/api/search/route.ts, src/app/(frontend)/[...path]/page.tsx, src/app/(frontend)/sommaire/[slug]/page.tsx, src/migrate/import-issues.ts, src/migrate/import-articles.ts, src/migrate/push-archive.ts, src/migrate/upload-seed-media.ts, src/migrate/blob-orphans.ts, scripts/verify-deployed.mjs, scripts/verify-prod-admin.mjs, scripts/verify-seed-blob.mjs, scripts/verify-search-body.mjs, scripts/verify-isr.mjs, scripts/verify-push-archive.mjs, .gitignore, GATES-FINISH.md

Scope: after the user's first look at the production deployment (vh-magazine-iota.vercel.app,
built 2026-11-19 09:47 with a database for the first time), check it and do every remaining
launch item that does not need the owner — with the go-aheads the user gave in this session:
rotate the production admin password, rehearse the final sync (P6, incl. Blob uploads of new
media), build body search, import the 200 magazine issues, upload the seed demo's images.
Not approved (stays a handoff): staging the archive on Neon / a preview with real data, the
production push itself (step 3), cutover.

Found and fixed on the way (each negative control observed before the fix):
- the public default admin password worked on production (login 200 with the CLAUDE.md
  credentials; the repository is public) — rotated, F3;
- every image on production answered 404 (47 of 47 Blob URLs): the seed ran without the Blob
  adapter, its files stayed in `media/` — uploaded, F10;
- articles were rendered on every request: the build listed no ISR route and Vercel answered
  `private, no-cache, no-store` in ~1 s per article — empty generateStaticParams, F6;
- search matched titles only for ~99% of the archive (80 of 8,121 articles keep an excerpt) —
  body in the generated column, F4/F5 (the verifier failed on both databases before the
  migration: "migration … recorded — expected 1, measured 0");
- WordPress's paginated archives (/page/N/, /category/{path}/page/N/, /tag/{slug}/page/N/)
  answer 200 on the live site but would 404 here (this site paginates with ?page=N) — 301s in
  the proxy, F11 (the verifier failed on the build before the change: "/page/2/: 404");
- making articles ISR exposed a Next 16.2.6 defect: an ISR miss that redirects (a wrong-category
  article URL) sent `Location` twice, read by fetch as "X, X" — GATES.md G21 failed on it.
  `connection()` before the redirect 500s inside an ISR render; fixed with a one-line pnpm patch of
  Next's app-page template (`patches/next@16.2.6.patch`), G21 passes on a miss again;
- GATES.md G26 timed out three runs in a row: a test race (a navigation started while link
  prefetches were in flight orphans them, so Playwright's `networkidle` never arrives); the
  verifier now waits for `load` and React's hydration of the form; its --self-test still holds;
- LAUNCH.md's "150 distinct issue numbers" was a parsing error: 202 posts carry 200 numbers;
  skipping them would have launched an empty /magazine-maroc/ — imported, F8/F9 (control: a
  scratch copy with one issue deleted and one redirect corrupted fails with 3 problems).

Measured but not fixable here: production's MEDIA_ORIGIN is empty (an unknown legacy upload
answers 404, not 302 → www.vh.ma); the live site now answers /wp-json/wp/v2/users with 403
(the P6 survey reads every other collection; authors are not imported).

Run order: F0–F3 and F10 need only the network; F5–F7 the local vh_magazine build and
databases; F4, F9 and F11 serve `vh_migration` and therefore run LAST — a vh_migration server writes
ISR pages into `.next`, and articles are ISR now — and the full `GATES.md` re-run starts with
its own rebuild.

- [x] F0: this ledger's oracles are lint-clean
  CHECK: node /Users/mc/.claude/skills/unlazy/scripts/gate-lint.mjs GATES-FINISH.md
  EXPECT: LINT OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=48630b7361dd44ee870917b12c3d19b9d7bdea738aaca16bb04d4cab83b772d2; output-bytes=8

- [x] F1: the whole project typechecks and passes its full ESLint run
  CHECK: pnpm exec tsc --noEmit && pnpm -s lint && echo FINISH_TYPES_LINT_OK
  EXPECT: FINISH_TYPES_LINT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=d6df7fddcb083eb792b41176063c4f7ee9c116ba795e9733b21cb93da0d9e47c; output-bytes=314

- [x] F2: the production deployment serves every route type: home, sampled articles and categories with canonicals on www.vh.ma, search page and API, RSS, news sitemap, robots, redirects map, a 404, the legacy-upload fallback, optimized images and og:images, admin login page — noindex on its vercel.app host (no login attempt: failed logins lock the account)
  CHECK: node scripts/verify-deployed.mjs --base https://vh-magazine-iota.vercel.app --canonical https://www.vh.ma
  EXPECT: DEPLOYED_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=f6b9cdcbdf396426858b6bd2d0eaab1b061696b5bbbe32a39430b9dc4bfbd301; output-bytes=776

- [x] F2C: control — the same deployed check fails when told the wrong canonical origin, so F2 can fail
  CHECK: node scripts/verify-deployed.mjs --base https://vh-magazine-iota.vercel.app --canonical https://example.invalid > /dev/null 2>&1; test $? -eq 1 && echo DEPLOYED_CONTROL_FAILS
  EXPECT: DEPLOYED_CONTROL_FAILS
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=45a386c468154c73d6487cff8cc00f5ecaf9ee8cee3e6cb7906c737040fc1252; output-bytes=23

- [x] F3: on production the rotated credential (production-admin.txt, git-ignored, owner-only) logs in, the default admin password is refused, and the check leaves no failed login behind (a second successful login resets Payload's lockout count)
  CHECK: node scripts/verify-prod-admin.mjs --base https://vh-magazine-iota.vercel.app
  EXPECT: PROD_ADMIN_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=5c1938a7e5d96df8be7797f4391b86961ae01293b1a56285e635a317f610e275; output-bytes=145

- [x] F10: all 282 seed files the production database names are on Blob at their recorded byte sizes, and a never-uploaded name answers 404
  CHECK: node scripts/verify-seed-blob.mjs
  EXPECT: SEED_BLOB_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=e3ed705cb66408a426fe90706598bbd645d351a65038d9057200905753927a3d; output-bytes=76

- [x] F5: on the dev seed, every body word of every article is in its search index, and a title+excerpt index would miss them (control)
  CHECK: node scripts/verify-search-body.mjs --coverage-only
  EXPECT: SEARCH_BODY_COVERAGE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=9f31f2e2f0c984d85f8a1d440f429f9c80885181b01da497de6c617c75cf0552; output-bytes=138

- [x] F6: article and issue pages are ISR routes answered from the cache on a second request with a public s-maxage, while the dynamic category route stays no-store (control) and an unknown article path 404s
  CHECK: node scripts/verify-isr.mjs
  EXPECT: ISR_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=aa19f96d5d3d4b1815518a9f5eabbd062bae75e6a8b25765b3ba0642a28d5a1b; output-bytes=352

- [x] F7: the step-3 push, rehearsed on scratch copies of the seed database: refuses a wrong --confirm and a working database, a push that fails midway leaves the target unchanged, and a real push leaves every table equal to vh_migration with one admin and working body search
  CHECK: node scripts/verify-push-archive.mjs
  EXPECT: PUSH_REHEARSAL_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=81862fa8b79342500264256e22bf9f11aa267ebd2c4b67284260e6551ffdea10; output-bytes=220

- [x] F8: vh_migration holds one magazine issue per number the surveyed /sommaire/ posts carry, at the primary post's slug, date and cover, with a permanent redirect for every post id and merged post
  CHECK: cd /Users/mc/work/hostinger-ftp/migration && node tools/verify-import-issues.mjs db
  EXPECT: issue db verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=3303b2cf151c21f130156e60c712ed8169b797ac2c9ac3dc614cde3d3eba8418; output-bytes=144

- [x] F4: on the migrated archive, every body word of every article with text is indexed, the title+excerpt control would miss them, and /recherche/ finds articles by a word unique to their body and shows it in the result
  CHECK: DATABASE_URL=postgres://localhost/vh_migration node scripts/verify-search-body.mjs
  EXPECT: SEARCH_BODY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=b546773ae4e0b5b4532c208771ce13d73fe75705d0a6d305cda5c99b8fbe611a; output-bytes=554

- [x] F9: served from vh_migration, every issue page answers 200 with its title and cover, every issue redirect 301s to its issue, an unknown issue 404s and the page judge rejects a wrong page
  CHECK: cd /Users/mc/work/hostinger-ftp/migration && node tools/verify-import-issues.mjs serve
  EXPECT: issue serve verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=d0e45485b2c6707a172a551b92f7d441a923842e699606a85417ca07b20445cd; output-bytes=131

- [x] F11: WordPress's paginated archive URLs 301 to this site's listings — /page/N/ to the home, a category's page N to its ?page=N (page 1 to the bare URL), a tag's page N to the tag's category — while a non-archive path ending in page/N and an author archive are left alone (controls)
  CHECK: DATABASE_URL=postgres://localhost/vh_migration node scripts/verify-wp-pagination.mjs
  EXPECT: WP_PAGINATION_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=d425da979dd51784d48371f09c2dcd07daae439c73baced730541304cc707715; output-bytes=144
