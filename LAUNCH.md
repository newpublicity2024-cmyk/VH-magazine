# VH Magazine — what is left before launch

Launch = the real vh.ma archive served by this app on the vh.ma domain.
Recorded 2026-11-17. Details live in `CLAUDE.md` (session state) and, for the migration,
`/Users/mc/work/hostinger-ftp/migration/PLAN.md` (sections "Open" and "2026-11-17").

## Where it stands

- Design: round 3 **approved by the owner** (2026-11-17). Ledger `GATES.md` 61/62; the one
  open gate is R3-G3, the logo SVGs.
- Migration, all local: 8,121 articles, 130 categories, 27,946 tags, 36,177 redirects in
  `vh_migration`; 31,131 media originals in Vercel Blob and on the local staging disk.
- Live vh.ma, measured 2026-11-17 12:16 UTC: 8,348 published posts = 8,146 articles + 202
  magazine issues. Gap to the DB: 18 articles published after the 11-11 survey, 7 held for
  their post-inventory hero image, the 202 issues (owner decision). No unexplained miss.
  Re-measure: `node tools/compare-live-posts.mjs` in the migration folder.
- GitHub holds only rounds 1–2a: local `main` is one commit ahead of `origin/main`, and the
  round-2b/3 branches were never pushed. Nothing is in Neon; DNS is untouched.

## Owner inputs

- [ ] **Logo SVGs** — blue-on-white, white-on-black, compact "VH" mark (R3-G3; drop them in
      `public/` under the same names, re-run R3-G3, then the full ledger).
- [ ] **Magazine issues** — 202 `sommaire` posts carry 150 distinct issue numbers; the app's
      issue number is unique. Merge, renumber, or skip.
- [ ] **Hotlinked images** — 467 images in 170 posts live on other sites (challenge.ma,
      old.vh-magazine.com, Facebook CDN…): copy into Media, embed as-is, or keep as links.
- [ ] **Search** — only 110 articles keep an excerpt, so search matches titles for the rest;
      indexing body text needs a stored text column.
- [ ] **Accounts and bylines** — `vh_migration` has 0 users and 0 of 8,121 articles with an
      author (WordPress has 23 authors). Who gets admin/editor logins; carry bylines or not.
- [ ] **View counts, drafts, old video URLs** — only in the WordPress DB: allowlist an IP
      (this Mac's rotates daily) or provide a phpMyAdmin export; otherwise "Les plus lus"
      starts from zero.
- [ ] **Security, urgent regardless of launch** — five public DB dumps (2023-10-03, ~1.7 GB)
      in `/public_html/dbsofvh/` on the live server; raised 2026-11-05, unanswered. Delete them.
- [ ] Optional: tell the owner about C5 (no global smooth scroll) — a deviation, never shown.

## Engineering (steps marked * need an explicit go-ahead)

1. [ ] Merge `design/round-3` (carries `migration/media-import` and the 2026-11-17 fixes) into
       `main` and push*. `main` cannot build today (Google Fonts, see CLAUDE.md landmines).
2. [ ] **Final sync (P6), last thing before launch**: posts and uploads published since the
       survey, plus the 7 held articles — re-run the REST survey, FTP delta of uploads after
       2026-11-05, convert, import (re-runs converge). Ideally behind a short publishing freeze.
3. [ ] Push `vh_migration` to Neon* (full replace); create the real accounts; change the
       default admin password.
4. [ ] Verify on Vercel with the real data: `/wp-content/uploads/*` → Blob, the 36k-row
       redirects, sitemaps, article pages — the prototype has only ever served seed data.
5. [ ] Decide image serving: direct Blob URLs (`disablePayloadAccessControl`) instead of a
       function call per image; check the Vercel image-optimizer quota at 31k images.
6. [ ] Cutover*: point `MEDIA_ORIGIN` at the old server under another name before switching
       DNS (else late uploads 404 — loop guard); keep the old WordPress up; submit sitemaps;
       watch 404s.
7. [ ] Smaller: 29 WordPress pages surveyed, not migrated (incl. the Grand Angle tiles) —
       decide which matter; 404 responses have no server-rendered body; Next 16 wants
       `middleware.ts` renamed `proxy.ts`; post 47196 (a shorter duplicate of 47831) could
       301 to its twin.

Critical path: logos + accounts → 1 → 2 → 3 → 4 → 6. The three content decisions can default
to "keep links, titles-only search, skip issues" if speed matters more.
