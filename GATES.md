# Gates: VH Magazine — rounds 1 + 2a (spec §11 steps 1–7)

OWNS: package.json, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs, .prettierrc.json, .npmrc, .gitignore, .env.example, src/**, public/**, scripts/**, tests/**, playwright.config.ts

Scope: A locally-running Next.js + Payload CMS rebuild of the vh.ma homepage — scaffold,
data model, seeded content, global layout, core components, and the homepage assembled in
spec §5 order — verified against the contract and inventory in PLAN.md (revision r1).

Contract: PLAN.md r1 (amendments A1–A4) and PLAN-2A.md r2a (amendments B1–B5 + riders).
G1–G19 are round 1 and re-run every pass as regression cover. G20–G39 are round 2a.
The migration scraper (round 2b) is out of scope and unclaimed by any gate here.

- [x] G1: Local Postgres is running and the vh_magazine database is reachable from Node
  CHECK: node scripts/verify-db.mjs
  EXPECT: DB_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=164925f6b6bff5f0d700c3de4005778bfbe56773c7ad40e74652acdbe2e9e6d4; output-bytes=6

- [x] G2: The whole project typechecks with no errors
  CHECK: pnpm exec tsc --noEmit && echo TYPECHECK_OK
  EXPECT: TYPECHECK_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=0d31cf08e125020004c508c562e62037cd1809c414d62a869bc1452c072c96f0; output-bytes=13

- [x] G3: ESLint reports no errors across the project
  CHECK: pnpm run lint && echo LINT_OK
  EXPECT: LINT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=bc5486efe4b0ceb091f03bccab5f9a8e3596a3ea24a43d29695a098da0b6296a; output-bytes=301

- [x] G4: All 10 collections and 2 globals exist as real tables, and categories carries a self-referencing parent foreign key
  CHECK: node scripts/verify-schema.mjs
  EXPECT: SCHEMA_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=fb11620d9c6dc2909ba705d28b141ca072015bc71e956ba26aadbf549a37f346; output-bytes=10

- [x] G5: Seed content is present in the database at the expected per-collection counts, including at least one article filed under the moteur/vh-moteur subcategory
  CHECK: node scripts/verify-seed.mjs
  EXPECT: SEED_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=5ca921fcd194d92f6f1d19a26e1d3a5b452b468e5226219cc18b22dfbb556016; output-bytes=8

- [x] G6: The production build completes successfully
  CHECK: pnpm run build && echo BUILD_OK
  EXPECT: BUILD_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=90e98f733cbb4e622313fc47d58b163674f187db7371dc46046b59d922dea478; output-bytes=1805

- [x] G7: The homepage returns 200 with lang="fr", exactly one h1, and a canonical link equal to NEXT_PUBLIC_SERVER_URL with a single trailing slash
  CHECK: node scripts/verify-home.mjs
  EXPECT: HOME_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=cdc42c57841cf2b0ba9e71a4aa10de57d21c7fa3350dc949cbb8c1e7793963da; output-bytes=8

- [x] G8: All 14 spec section-5 sections are present on the homepage in spec order, each full-width section as its own top-level section element
  CHECK: node scripts/verify-sections.mjs
  EXPECT: SECTIONS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=3dd3328f2ce4d3b30ae22019d0ac0b7cf21a2e9df9666929169752b95a4fd052; output-bytes=12

- [x] G9: Each homepage block renders exactly the card count spec section 5 requires
  CHECK: node scripts/verify-counts.mjs
  EXPECT: COUNTS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=d3890b583672630e539d344969afa562fd7b4e532b4b62a169eab2c18e14cfa3; output-bytes=10

- [x] G10: Every date rendered on the homepage is formatted DD/MM/YYYY, with none in any other format
  CHECK: node scripts/verify-dates.mjs
  EXPECT: DATES_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=fc423c35a6b770e89d10fcd96d8989e819709dca2df078772368d48dd3f83113; output-bytes=9

- [x] G11: Every article link is a 2-or-3-segment nested category path and every category link is under /category/, and at least one 3-segment article link is actually present
  CHECK: node scripts/verify-urls.mjs
  EXPECT: URLS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=3a161f86e076ffcc0f524be135fdb88ac7c212137aa24894322bae498f5a69e7; output-bytes=265

- [x] G12: The top bar, primary nav and footer expose exactly the labels and hrefs spec sections 4.1 to 4.3 list
  CHECK: node scripts/verify-navlinks.mjs
  EXPECT: NAVLINKS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=cf60078e592400c03c54f2152cb43a7c7ab7f0706498ea586b52232846d282ae; output-bytes=12

- [x] G13: Submitting the newsletter form stores a subscriber row, and resubmitting the same address neither errors nor creates a duplicate
  CHECK: node scripts/verify-newsletter.mjs
  EXPECT: NEWSLETTER_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=a803590db21ffa308e747ca0e76768295d40f3812f5d7651774a386339fd7b84; output-bytes=98

- [x] G14: No rendered image lacks explicit width and height, featured images are served through the Next image optimizer, and the first Actu card image is marked priority
  CHECK: node scripts/verify-images.mjs
  EXPECT: IMAGES_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=54e95b24b1955eebe3714bb7fc40c994fa1a3eefe4e5f88ebc3e3750fab3e951; output-bytes=47

- [x] G15: The homepage has no horizontal overflow at 375, 768 and 1440 CSS pixels, and the sidebar renders below the main column at 375
  CHECK: node scripts/verify-responsive.mjs
  EXPECT: RESPONSIVE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=ad5631de27a38141c3f24558d1e5069177f99612cdfb2d83c9529b03e8253906; output-bytes=131

- [x] G16: An axe accessibility scan of the homepage reports zero serious or critical violations
  CHECK: node scripts/verify-a11y.mjs
  EXPECT: A11Y_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=00739d11b6b1a850749d6e42226bfc63381bab7309a35a02d36212eb4743ac88; output-bytes=61

- [x] G17: The Payload admin is reachable and the seeded admin user authenticates, proving trailingSlash did not break it
  CHECK: node scripts/verify-admin.mjs
  EXPECT: ADMIN_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=4fef1ffb29f47566d756db9100296b68a479dce9f93faa72b8d28efb79103ddc; output-bytes=69

- [x] G18: The header becomes sticky on scroll and the hamburger opens a drawer containing the full primary nav
  CHECK: node scripts/verify-header.mjs
  EXPECT: HEADER_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=a96cd9648933ad17ff60ad6f27f0ea61e8411ccbeff27302dc7ea8055ed51852; output-bytes=103

- [x] G19: Renaming a published article creates exactly one redirect from its old URL, renaming again repoints that redirect rather than chaining, and renaming an unpublished article creates none
  CHECK: node scripts/verify-redirects.mjs
  EXPECT: REDIRECTS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=aafcea03e301da8528945d08e151efab418639c71d07fbc205dd0eae02fde2d0; output-bytes=213

- [x] G20: An article page renders with its title as the single h1, a breadcrumb trail, a DD/MM/YYYY date, the rich-text body and share buttons
  CHECK: node scripts/verify-article.mjs
  EXPECT: ARTICLE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=eb35b2d70b86a4f7023398100246c5fe1363c55be7f3c4d3ebb4e1ad5bac403c; output-bytes=69

- [x] G21: The catch-all resolves both 2- and 3-segment article URLs, 301s a wrong-category path to the canonical URL without looping, and 404s a genuinely unknown slug
  CHECK: node scripts/verify-routing.mjs
  EXPECT: ROUTING_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=7892751eae6b143c82e3d997a0ffff76b4dd7205b48dddfc9c9660568c3fb936; output-bytes=172

- [x] G22: A category page paginates at the declared page size, emits rel prev/next, and each page canonicalises to its own ?page=n rather than to page 1
  CHECK: node scripts/verify-category.mjs
  EXPECT: CATEGORY_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=38a2b5bb9227a4b60248a8f5d40e097026c1b1c9bbd5c2835293587c1c77e666; output-bytes=132

- [x] G23: A nested category URL resolves and lists only articles in that subcategory, while its parent lists the subcategory's articles too
  CHECK: node scripts/verify-category-nested.mjs
  EXPECT: NESTED_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=d2d2e92e4eb2b530c10bb391dfe959e188a4c1f12a87990f436f7d0db6ed99fe; output-bytes=55

- [x] G24: The Les Unes archive lists every magazine issue and each issue's sommaire page renders its cover and summary
  CHECK: node scripts/verify-magazine.mjs
  EXPECT: MAGAZINE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=e100455a8ccf56568987f51d9f5a1e5dba37eda3d70698805310397177f68c41; output-bytes=58

- [x] G25: The VH TV page lists the video articles with play affordances
  CHECK: node scripts/verify-vhtv.mjs
  EXPECT: VHTV_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=722697e79b6ac94b33c2359c6fb659a9be8a25d5a78e03be343ff5596d891283; output-bytes=45

- [x] G26: The contact form stores a message row, rejects an invalid email address, and silently discards a submission whose honeypot field is filled
  CHECK: node scripts/verify-contact.mjs
  EXPECT: CONTACT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=9a286a5562037cb5ab5d740beae9caea442f79830873fde45aaf97046abfb444; output-bytes=71

- [x] G27: The Team VH and Sondage pages render with their own single h1
  CHECK: node scripts/verify-static-pages.mjs
  EXPECT: STATICPAGES_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=cdf6803c54381e6f1e7a23ce21d306f6ff9fd2411f1324536712b48eb74642df; output-bytes=59

- [x] G28: Search finds an article by an accented French term typed without accents, returns empty for a nonsense query, and is unharmed by a SQL injection payload
  CHECK: node scripts/verify-search.mjs
  EXPECT: SEARCH_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=ccbaae92c85f8ad3be1f3ff9567cae33cb7a3d4343a81763696454bdd612fa94; output-bytes=79

- [x] G29: Viewing an article increments its view count exactly once per reader, and a repeat call from the same reader does not increment it again
  CHECK: node scripts/verify-viewcount.mjs
  EXPECT: VIEWCOUNT_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=87e20e26a4de46033550ffea04e68788e99817b526c5cd440a01a64de47fd768; output-bytes=75

- [x] G30: JSON-LD parses and validates: NewsArticle plus BreadcrumbList on an article, WebSite plus Organization on the homepage
  CHECK: node scripts/verify-jsonld.mjs
  EXPECT: JSONLD_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=5997971e6981ff11c937a6f520fba8af8e0316b0e0d9726dcab0f7125a46422a; output-bytes=80

- [x] G31: sitemap.xml lists every published article, category and issue as absolute vh.ma URLs with trailing slashes and excludes drafts, and news-sitemap.xml contains only articles from the last 48 hours
  CHECK: node scripts/verify-sitemap.mjs
  EXPECT: SITEMAP_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=9a8a39ef9d95db7a4c94dda672a0988f4c1808282374814e1c543a1c2588b246; output-bytes=104

- [x] G32: rss.xml is well-formed XML whose item links are absolute vh.ma URLs matching the article route
  CHECK: node scripts/verify-rss.mjs
  EXPECT: RSS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=106672ecab21080a9c6e0eab4d20d0149ba707459a9965183d9c4f3890433f52; output-bytes=64

- [x] G33: robots.txt allows indexing, sets max-image-preview large, and its Sitemap line is the absolute vh.ma sitemap URL
  CHECK: node scripts/verify-robots.mjs
  EXPECT: ROBOTS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=0abf538db5509d77d0883a9598740622b04c7a1fdcff25dbeb0e3e7dc2eda305; output-bytes=58

- [x] G34: Middleware 301s a stored old URL to its new one and leaves a live URL untouched at 200
  CHECK: node scripts/verify-middleware.mjs
  EXPECT: MIDDLEWARE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=c2f8cf8914845684c12861167f0af50095cf97c5582ee299b3565becded85d03; output-bytes=125

- [x] G35: Renaming an article A to B and back to A leaves A resolving with 200 and never creates a self-referencing redirect
  CHECK: node scripts/verify-rename-cycle.mjs
  EXPECT: RENAMECYCLE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=aec67f7ecc24d3ac5a693004f9f56e63d99bbc5191152d5193679c6006573e3e; output-bytes=184

- [x] G36: Every page type emits exactly one h1 and a self-referencing canonical built on the absolute vh.ma origin, never the deployment host
  CHECK: node scripts/verify-canonicals.mjs
  EXPECT: CANONICALS_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=4763a29a1881b6069abb9fe8af603f0cafb5276cd2de7a8d125f54c0de99ff76; output-bytes=89

- [x] G37: An unknown path returns a real 404 status while a known path returns 200
  CHECK: node scripts/verify-404.mjs
  EXPECT: NOTFOUND_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=719cf1cab5604cbd4726249acf1bd2b3158719308ed84ff456088f8a1df20535; output-bytes=48

- [x] G38: The redirects map stays within its byte budget and contains no tag redirects, which are served by lookup instead
  CHECK: node scripts/verify-mapsize.mjs
  EXPECT: MAPSIZE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=802edaaa6eb537ffdc5e4b989e1897d30ce9d665ebb51c41b0cce6fcc2b29832; output-bytes=72

- [x] G39: A request with a foreign Host receives X-Robots-Tag noindex, and the same request with Host www.vh.ma does not
  CHECK: node scripts/verify-noindex.mjs
  EXPECT: NOINDEX_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/mc/work/VH-magazine; path=f4e8a51e2bd0/14 entries; EXPECT=matched; output-sha256=bef426e2e43c6ef518125f5b17cb231566e7a6b27e18c92299ad26ba7e7aed81; output-bytes=81
