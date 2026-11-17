# Gates: VH Magazine — rounds 1 + 2a (spec §11 steps 1–7)

OWNS: package.json, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs, .prettierrc.json, .npmrc, .gitignore, .env.example, src/**, public/**, scripts/**, tests/**, playwright.config.ts

Scope: A locally-running Next.js + Payload CMS rebuild of the vh.ma homepage — scaffold,
data model, seeded content, global layout, core components, and the homepage assembled in
spec §5 order — verified against the contract and inventory in PLAN.md (revision r1).

Contract: PLAN.md r1 (amendments A1–A4) and PLAN-2A.md r2a (amendments B1–B5 + riders).
G1–G19 are round 1 and re-run every pass as regression cover. G20–G39 are round 2a.
G40–G41 (round 2b, 2026-11-11) close two nav links that G12 checked by text but never
requested — both 404'd. G42 (2026-11-11) opens an article in the admin: the committed admin
import map was empty, so the body editor had never rendered and no gate had ever looked.
G43–G44 (2026-11-17): the gates that write to vh_magazine (G19, G34, G35) left debris —
an assertion exits the process and skips `finally`, and deleting an article before its
versions orphans them (`_articles_v.parent_id` is ON DELETE SET NULL): one stray article
in "Derniers articles" and 97 orphaned versions. G43 fails each writer on purpose and
counts what it left; G44 measures the database itself.
The migration itself is gated in the migration workspace
(/Users/mc/work/hostinger-ftp/migration/GATES-P*.md), not here.

- [x] G1: Local Postgres is running and the vh_magazine database is reachable from Node
  CHECK: node scripts/verify-db.mjs
  EXPECT: DB_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=164925f6b6bff5f0d700c3de4005778bfbe56773c7ad40e74652acdbe2e9e6d4; output-bytes=6

- [x] G2: The whole project typechecks with no errors
  CHECK: pnpm exec tsc --noEmit && echo TYPECHECK_OK
  EXPECT: TYPECHECK_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=0d31cf08e125020004c508c562e62037cd1809c414d62a869bc1452c072c96f0; output-bytes=13

- [x] G3: ESLint reports no errors across the project
  CHECK: pnpm run lint && echo LINT_OK
  EXPECT: LINT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=bc5486efe4b0ceb091f03bccab5f9a8e3596a3ea24a43d29695a098da0b6296a; output-bytes=301

- [x] G4: All 10 collections and 2 globals exist as real tables, and categories carries a self-referencing parent foreign key
  CHECK: node scripts/verify-schema.mjs
  EXPECT: SCHEMA_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=fb11620d9c6dc2909ba705d28b141ca072015bc71e956ba26aadbf549a37f346; output-bytes=10

- [x] G5: Seed content is present in the database at the expected per-collection counts, including at least one article filed under the moteur/vh-moteur subcategory
  CHECK: node scripts/verify-seed.mjs
  EXPECT: SEED_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=5ca921fcd194d92f6f1d19a26e1d3a5b452b468e5226219cc18b22dfbb556016; output-bytes=8

- [x] G6: The production build completes successfully
  CHECK: pnpm run build && echo BUILD_OK
  EXPECT: BUILD_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=ca6aaacb6609531ce9d13ca0c87b0992913957473966cf05b8da7f8e142fdb96; output-bytes=2175

- [x] G7: The homepage returns 200 with lang="fr", exactly one h1, and a canonical link equal to NEXT_PUBLIC_SERVER_URL with a single trailing slash
  CHECK: node scripts/verify-home.mjs
  EXPECT: HOME_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=cdc42c57841cf2b0ba9e71a4aa10de57d21c7fa3350dc949cbb8c1e7793963da; output-bytes=8

- [x] G8: All 14 spec section-5 sections are present on the homepage in spec order, each full-width section as its own top-level section element
  CHECK: node scripts/verify-sections.mjs
  EXPECT: SECTIONS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=3dd3328f2ce4d3b30ae22019d0ac0b7cf21a2e9df9666929169752b95a4fd052; output-bytes=12

- [x] G9: Each homepage block renders exactly the card count spec section 5 requires
  CHECK: node scripts/verify-counts.mjs
  EXPECT: COUNTS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=d3890b583672630e539d344969afa562fd7b4e532b4b62a169eab2c18e14cfa3; output-bytes=10

- [x] G10: Every date rendered on the homepage is formatted DD/MM/YYYY, with none in any other format
  CHECK: node scripts/verify-dates.mjs
  EXPECT: DATES_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=fc423c35a6b770e89d10fcd96d8989e819709dca2df078772368d48dd3f83113; output-bytes=9

- [x] G11: Every article link is a 2-or-3-segment nested category path and every category link is under /category/, and at least one 3-segment article link is actually present
  CHECK: node scripts/verify-urls.mjs
  EXPECT: URLS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=fc655684ed399794f33c2813c608795ceb3fc3164cbe7f90c92d5b5c4cb674b5; output-bytes=265

- [x] G12: The top bar, primary nav and footer expose exactly the labels and hrefs spec sections 4.1 to 4.3 list
  CHECK: node scripts/verify-navlinks.mjs
  EXPECT: NAVLINKS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=cf60078e592400c03c54f2152cb43a7c7ab7f0706498ea586b52232846d282ae; output-bytes=12

- [x] G13: Submitting the newsletter form stores a subscriber row, and resubmitting the same address neither errors nor creates a duplicate
  CHECK: node scripts/verify-newsletter.mjs
  EXPECT: NEWSLETTER_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=a803590db21ffa308e747ca0e76768295d40f3812f5d7651774a386339fd7b84; output-bytes=98

- [x] G14: No rendered image lacks explicit width and height, featured images are served through the Next image optimizer, and the first Actu card image is marked priority
  CHECK: node scripts/verify-images.mjs
  EXPECT: IMAGES_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=54e95b24b1955eebe3714bb7fc40c994fa1a3eefe4e5f88ebc3e3750fab3e951; output-bytes=47

- [x] G15: The homepage has no horizontal overflow at 375, 768 and 1440 CSS pixels, and the sidebar renders below the main column at 375
  CHECK: node scripts/verify-responsive.mjs
  EXPECT: RESPONSIVE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=ad5631de27a38141c3f24558d1e5069177f99612cdfb2d83c9529b03e8253906; output-bytes=131

- [x] G16: An axe accessibility scan of the homepage reports zero serious or critical violations
  CHECK: node scripts/verify-a11y.mjs
  EXPECT: A11Y_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=3ada289e70edf0a6f153a4e627049430ad1565b530b401aa85adf135c998846b; output-bytes=61

- [x] G17: The Payload admin is reachable and the seeded admin user authenticates, proving trailingSlash did not break it
  CHECK: node scripts/verify-admin.mjs
  EXPECT: ADMIN_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=99e5e0a0dcfe1f3c3b1d4322e8c7659d92bae902522b02e60527896f2bb69f8d; output-bytes=69

- [x] G18: The header becomes sticky on scroll and the hamburger opens a drawer containing the full primary nav
  CHECK: node scripts/verify-header.mjs
  EXPECT: HEADER_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=a96cd9648933ad17ff60ad6f27f0ea61e8411ccbeff27302dc7ea8055ed51852; output-bytes=103

- [x] G19: Renaming a published article creates exactly one redirect from its old URL, renaming again repoints that redirect rather than chaining, and renaming an unpublished article creates none — and the run leaves none of its articles, article versions or redirects behind
  CHECK: node scripts/verify-redirects.mjs
  EXPECT: REDIRECTS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=8aaafdff4096e9f381814c457f26756008590f8d9a135cd3293523db1e65a7b8; output-bytes=322

- [x] G20: An article page renders with its title as the single h1, a breadcrumb trail, a DD/MM/YYYY date, the rich-text body and share buttons
  CHECK: node scripts/verify-article.mjs
  EXPECT: ARTICLE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=eb35b2d70b86a4f7023398100246c5fe1363c55be7f3c4d3ebb4e1ad5bac403c; output-bytes=69

- [x] G21: The catch-all resolves both 2- and 3-segment article URLs, 301s a wrong-category path to the canonical URL without looping, and 404s a genuinely unknown slug
  CHECK: node scripts/verify-routing.mjs
  EXPECT: ROUTING_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=7892751eae6b143c82e3d997a0ffff76b4dd7205b48dddfc9c9660568c3fb936; output-bytes=172

- [x] G22: A category page paginates at the declared page size, emits rel prev/next, and each page canonicalises to its own ?page=n rather than to page 1
  CHECK: node scripts/verify-category.mjs
  EXPECT: CATEGORY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=38a2b5bb9227a4b60248a8f5d40e097026c1b1c9bbd5c2835293587c1c77e666; output-bytes=132

- [x] G23: A nested category URL resolves and lists only articles in that subcategory, while its parent lists the subcategory's articles too
  CHECK: node scripts/verify-category-nested.mjs
  EXPECT: NESTED_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=c555a7ee5b985f769fe95aaba7e9a65b8e7370026212bc9ffc241fba8fb5c04b; output-bytes=55

- [x] G24: The Les Unes archive lists every magazine issue and each issue's sommaire page renders its cover and summary
  CHECK: node scripts/verify-magazine.mjs
  EXPECT: MAGAZINE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=e100455a8ccf56568987f51d9f5a1e5dba37eda3d70698805310397177f68c41; output-bytes=58

- [x] G25: The VH TV page lists the video articles with play affordances
  CHECK: node scripts/verify-vhtv.mjs
  EXPECT: VHTV_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=81750e2bf4425181843f1a3203902941de37aff7015938383c80e457eefe45bb; output-bytes=45

- [x] G26: The contact form stores a message row, rejects an invalid email address, and silently discards a submission whose honeypot field is filled
  CHECK: node scripts/verify-contact.mjs
  EXPECT: CONTACT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=9a286a5562037cb5ab5d740beae9caea442f79830873fde45aaf97046abfb444; output-bytes=71

- [x] G27: The Team VH and Sondage pages render with their own single h1
  CHECK: node scripts/verify-static-pages.mjs
  EXPECT: STATICPAGES_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=cdf6803c54381e6f1e7a23ce21d306f6ff9fd2411f1324536712b48eb74642df; output-bytes=59

- [x] G28: Search finds an article by an accented French term typed without accents, returns empty for a nonsense query, and is unharmed by a SQL injection payload
  CHECK: node scripts/verify-search.mjs
  EXPECT: SEARCH_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=93ff2cb4abd333a18ffc14b18d26d5cc786c2b2d6befa3f4e20c3a4871d1050e; output-bytes=79

- [x] G29: Viewing an article increments its view count exactly once per reader, and a repeat call from the same reader does not increment it again
  CHECK: node scripts/verify-viewcount.mjs
  EXPECT: VIEWCOUNT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=c097674f36800825c7569c7fd75a084245f350f0dfee24dd44d518db8d9e590c; output-bytes=75

- [x] G30: JSON-LD parses and validates: NewsArticle plus BreadcrumbList on an article, WebSite plus Organization on the homepage
  CHECK: node scripts/verify-jsonld.mjs
  EXPECT: JSONLD_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=5997971e6981ff11c937a6f520fba8af8e0316b0e0d9726dcab0f7125a46422a; output-bytes=80

- [x] G31: sitemap.xml lists every published article, category and issue as absolute vh.ma URLs with trailing slashes and excludes drafts, and news-sitemap.xml contains only articles from the last 48 hours
  CHECK: node scripts/verify-sitemap.mjs
  EXPECT: SITEMAP_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=b5b83b6b2bd7396325acbcbcb58374a7efa06aee432677c7f78d355546e028bf; output-bytes=104

- [x] G32: rss.xml is well-formed XML whose item links are absolute vh.ma URLs matching the article route
  CHECK: node scripts/verify-rss.mjs
  EXPECT: RSS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=f689fc2edf6e7b319f21a76fdb04568ea056e97538e6a89891f7ae37d7cb83c6; output-bytes=64

- [x] G33: robots.txt allows indexing, sets max-image-preview large, and its Sitemap line is the absolute vh.ma sitemap URL
  CHECK: node scripts/verify-robots.mjs
  EXPECT: ROBOTS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=0abf538db5509d77d0883a9598740622b04c7a1fdcff25dbeb0e3e7dc2eda305; output-bytes=58

- [x] G34: Middleware 301s a stored old URL to its new one and leaves a live URL untouched at 200 — and the run leaves its redirect row behind in no case
  CHECK: node scripts/verify-middleware.mjs
  EXPECT: MIDDLEWARE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=831b1bc0d2cc6aba644d032a8891ba0f2073191f894abc65f10d7554ebddc1ad; output-bytes=166

- [x] G35: Renaming an article A to B and back to A leaves A resolving with 200 and never creates a self-referencing redirect — and the run leaves none of its article, article versions or redirects behind
  CHECK: node scripts/verify-rename-cycle.mjs
  EXPECT: RENAMECYCLE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=fb48c9a26f1c27ec514d6fcff4af8094f51c3d4b5231caa8395bd8c39baee8e0; output-bytes=293

- [x] G36: Every page type emits exactly one h1 and a self-referencing canonical built on the absolute vh.ma origin, never the deployment host
  CHECK: node scripts/verify-canonicals.mjs
  EXPECT: CANONICALS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=4763a29a1881b6069abb9fe8af603f0cafb5276cd2de7a8d125f54c0de99ff76; output-bytes=89

- [x] G37: An unknown path returns a real 404 status while a known path returns 200
  CHECK: node scripts/verify-404.mjs
  EXPECT: NOTFOUND_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=719cf1cab5604cbd4726249acf1bd2b3158719308ed84ff456088f8a1df20535; output-bytes=48

- [x] G38: The redirects map stays within its byte budget and contains no tag redirects, which are served by lookup instead
  CHECK: node scripts/verify-mapsize.mjs
  EXPECT: MAPSIZE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=802edaaa6eb537ffdc5e4b989e1897d30ce9d665ebb51c41b0cce6fcc2b29832; output-bytes=72

- [x] G39: A request with a foreign Host receives X-Robots-Tag noindex, and the same request with Host www.vh.ma does not
  CHECK: node scripts/verify-noindex.mjs
  EXPECT: NOINDEX_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=bef426e2e43c6ef518125f5b17cb231566e7a6b27e18c92299ad26ba7e7aed81; output-bytes=81

- [x] G40: Every internal link in the top bar, primary nav and footer resolves: 200 directly, or one redirect whose target answers 200
  CHECK: node scripts/verify-navresolve.mjs
  EXPECT: NAVRESOLVE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=30993663a3963128a14786d6dd3fc49582a3d540ef54512261b01c67f1cb5f29; output-bytes=520

- [x] G41: /vh-grand-angle-2/ lists exactly the published articles of the grand-angle tree including a 3-segment child-category one, with one h1, a self canonical, a link to /category/grand-angle/, and a 404 beyond the last page
  CHECK: node scripts/verify-grandangle.mjs
  EXPECT: GRANDANGLE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=b4f9d9f6f3e518e20d6d785e1d82dd670f19149ec972536275b767a0a92faedb; output-bytes=111

- [x] G42: An editor who logs in through the admin form can open a seeded article and its body editor renders, showing the article's opening words, with no page errors
  CHECK: node scripts/verify-admin-editor.mjs
  EXPECT: ADMIN_EDITOR_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=61c8a1af3b14e63b23d076e44efc0372455a39a0efc170f51dda53fb3b24949d; output-bytes=16

- [x] G43: A G19, G34 or G35 run made to fail — inside its Payload driver, or after its records exist and its assertions run — exits non-zero with the injected failure and still leaves none of its own articles, article versions or redirects behind
  CHECK: node scripts/verify-gate-cleanup.mjs
  EXPECT: GATE_CLEANUP_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=21e61bf62c016c747de1bb0062692ab01ba61d07124366a2cb4b04ea1069bf12; output-bytes=716

- [x] G44: The dev database holds no gate debris — no article or article version with a gate-stamped slug, no redirect from or to a gate path, no article version orphaned from its article, no contact message or newsletter subscriber with a gate address — and the detector counts a planted row of each kind before it measures
  CHECK: node scripts/verify-no-debris.mjs
  EXPECT: NO_DEBRIS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=e0559c62395b6a92cf645d7b262e6bfa3034ee6b325a57f4e5313e690f0d8308; output-bytes=240

## Round 3 — design finish (DESIGN-SPEC-R3.md, amendments C1–C4, decisions D1–D8)

Contract: DESIGN-SPEC-R3.md §10 (R3-G1–R3-G17). Branch `design/round-3`. R3-G3 waits on
VH's logo SVGs and R3-G12 on the owner's written approval: both are handoffs, not
failures to fix in code. Regression: G1–G42 above are reset to pending and re-run on
the round-3 build (standing harness policy).

- [x] R3-G0: This ledger's oracles are lint-clean
  CHECK: node /Users/mc/.claude/skills/unlazy/scripts/gate-lint.mjs GATES.md
  EXPECT: LINT OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=d11997f2ba472b00484fbd09b2bde7b0a718f61174b784ac2c433eee526a16b9; output-bytes=398

- [x] R3-G1: Only spec tokens compile into the shipped frontend CSS, and the source rules hold: no raw hex, no red, no uppercase utility, no literal duration, no off-scale spacing, no default type/radius/shadow utility in components
  CHECK: node scripts/verify-r3-tokens.mjs
  EXPECT: R3_TOKENS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=ff21cb69f553d81eeaa969d6c439ca3254a5be4c980c98b798f4c59b609a4619; output-bytes=87

- [x] R3-G2: Every date, kicker, band label, nav link, button, body link and dark-section title measures at least 4.5:1 (3:1 for large text) against its composited background at 1440 and 390
  CHECK: node scripts/verify-r3-contrast.mjs
  EXPECT: R3_CONTRAST_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=1d75333457e67ff8112e758d959fb0cc514d699b4db7c4c46e616c9e72d381f3; output-bytes=78

- [ ] R3-G3: The real VH logo ships: no placeholder SVG in public/, and every logo's drawn bounding box lies inside its viewBox
  CHECK: node scripts/verify-r3-logo.mjs
  EXPECT: R3_LOGO_OK
  EVIDENCE: pending

- [x] R3-G4: A hovered card's image computes scale(1.03) over a 600 ms ease-standard transition and its title gains an accent underline while staying ink, and under reduced motion the image does not transform
  CHECK: node scripts/verify-r3-hover.mjs
  EXPECT: R3_HOVER_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=e25ffc311fb5cd7a609572447004da1a5fa71d0d72c94b71a35b0d20abe96d54; output-bytes=156

- [x] R3-G5: The drawer and the search panel exist while closed as inert, animate open and closed with their motion tokens, trap Tab, close on Escape and return focus to their trigger
  CHECK: node scripts/verify-r3-overlays.mjs
  EXPECT: R3_OVERLAYS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=ee5a73d9d960ca50a7c3d391b4f60e42b4f25c9db8e510af2cf52975132dbec6; output-bytes=194

- [x] R3-G6: The sticky bar keeps one height at scroll 0 and 800, the compact mark appears only after the masthead scrolls away, and a scripted scroll accumulates CLS of at most 0.02
  CHECK: node scripts/verify-r3-compact.mjs
  EXPECT: R3_COMPACT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=b1b99c210a38f834cef25888323cf1e0fdcf9a3ab66fc02fb37ce7d7868c83ba; output-bytes=108

- [x] R3-G7: With reduced motion emulated, no element on home, article or the open drawer transitions a transform or animates, except the reading-progress bar and opacity fades of at most 150 ms, and scrolling is not smooth
  CHECK: node scripts/verify-r3-reduced.mjs
  EXPECT: R3_REDUCED_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=3381f034ddffbb252a6e4e741251569bda3bc3a0a69dfbac91327d4bd7e4a45a; output-bytes=99

- [x] R3-G8: Articles read clearly — paragraphs at least 16 px apart, body at least 17 px, column at most 720 px, balanced h1 — and every migrated body in vh_migration consists only of block nodes the renderer maps to spaced block elements
  CHECK: node scripts/verify-r3-reading.mjs
  EXPECT: R3_READING_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=f0386a850d253ec6f14b99eb345e1d2138eedbc5468e05b8e8f3930d65c05152; output-bytes=246

- [x] R3-G9: On home, category and article, every card shows its title and date without hover: rendered, opaque, visible and not clipped
  CHECK: node scripts/verify-r3-visible.mjs
  EXPECT: R3_VISIBLE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=5a61728018b607f1e04510266ecef42b3bdbb296d231d81daa8da512e7f52258; output-bytes=114

- [x] R3-G10: First-party JS on home and article grows at most 15 KB gz over the recorded pre-round-3 baseline, and Lighthouse mobile (median of 3) scores at least 90 with CLS at most 0.02 on home, article and category
  CHECK: node scripts/verify-r3-perf.mjs
  EXPECT: R3_PERF_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=8a99bbf78a76ed0a1be0ec60e4d5ee5cb5d7f377f35ae4e768c5255d17b444f1; output-bytes=477

- [x] R3-G11: axe reports zero serious or critical violations on home, article, category, search and 404 at 1440 and 390, and on the open drawer and search panel
  CHECK: node scripts/verify-r3-a11y.mjs
  EXPECT: R3_A11Y_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=9ba05a5133b7c0821f8d9546efa0d600e493357eeb8cbfbbdf927cbd5fefa20a; output-bytes=58

- [x] R3-G12: The owner approves the round-3 look in writing from the r3-after screenshot set (home, article, category, VH TV, search open, drawer open, 404 at 1440 and 390)
  EVIDENCE: manual — owner approval of the round-3 design relayed in writing by the user, 2026-11-17 ("the owner approved on the round 3-design"); covers the 13 .playwright-mcp/r3-after-* screenshots (2026-11-12 10:45 UTC); the one later component change, a31a200, renames data attributes no CSS selects

- [x] R3-G13: The decisions render as decided: accent #166fc1 with no red token (C1), black masthead (D1), square image corners and 12 px floating panels (D2), no View Transitions (D4), Vidéos and People on black (D5), titles below images (D6), logo centred in the masthead and left in the compact bar (D7), rank numerals 1–5 in Les plus lus (D8)
  CHECK: node scripts/verify-r3-decisions.mjs
  EXPECT: R3_DECISIONS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=26a325d1cd045d531e7a93c74932432a9ffa8d89c529aff48172ff44c74f5fd4; output-bytes=72

- [x] R3-G14: Live search (D3): /api/search returns at most 6 hits for a seeded term, none under 2 characters, survives an injection payload, and typing in the panel lists the hits plus a "Voir tous les résultats" link to /recherche/?q=
  CHECK: node scripts/verify-r3-livesearch.mjs
  EXPECT: R3_LIVESEARCH_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=9dcbd0c6e727cbd45b45e9065f8438e864282a3fa92ff7acd2be9e95ea059abf; output-bytes=169

- [x] R3-G15: typoFr is idempotent and never leaves a plain space beside a narrow no-break space across every migrated title, leaves URLs and times untouched, and a rendered seeded title carries U+202F before its question mark
  CHECK: node scripts/verify-r3-typo.mjs
  EXPECT: R3_TYPO_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=3b9658e1da21136b1ef5d4c4cf7012c4a1314e5a4f3ec69a7766b53ba3425947; output-bytes=146

- [x] R3-G16: An unknown path renders the designed 404: status 404, h1 "Page introuvable", a search form and the 6 latest articles
  CHECK: node scripts/verify-r3-notfound.mjs
  EXPECT: R3_NOTFOUND_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=b3b185402a07a04907c8729e523282bd3ce416aec4b0fe467bc800b021b6748e; output-bytes=112

- [x] R3-G17: The rest of the spec inventory is present: reading progress and reading time on articles, share row with WhatsApp, LinkedIn and a copy-link toast, listings opening with a lead card then horizontal rows, VH TV swapping its featured player in place, covers grouped by year, footer accordions at 390, back-to-top only after 600 px, and a print stylesheet
  CHECK: node scripts/verify-r3-inventory.mjs
  EXPECT: R3_INVENTORY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=87c361706fa6/16 entries; EXPECT=matched; output-sha256=10ec121c3e61bc84839032bfa0006746c6a148ec17964b81a008f225f123639b; output-bytes=153
