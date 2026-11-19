# VH Magazine — what is left before launch

Launch = the real vh.ma archive served by this app on the vh.ma domain.
Rewritten 2026-11-19 after the first production deployment with a database. Details: `CLAUDE.md`
(session state), `GATES-FINISH.md` (this pass), and for the migration
`/Users/mc/work/hostinger-ftp/migration/PLAN.md` + `GATES-P6.md`.

## Where it stands (2026-11-19)

- **Production** (`vh-magazine-iota.vercel.app`) serves the seed demo from Neon branch
  `production` (34 articles, 47 media, 4 issues, 1 user); its first database-backed build was
  2026-11-19 09:47 UTC. Checked route by route (`scripts/verify-deployed.mjs`, GATES-FINISH F2).
  Fixed there today: the public default admin password worked (rotated → `production-admin.txt`,
  F3) and every image was a 404 (the seed's 282 files uploaded to Blob, F10).
- **Merged and deployed 2026-11-19** — PR #2 (merge commit d031cd9, pushed with the account's
  fine-grained token on the user's go-ahead): body search, ISR articles and issues (+ the Next
  patch), magazine-issue import, WordPress pagination redirects, the push tool. The production
  build migrated Neon `production` (`20261119_120000_search_body`); re-verified on the live alias:
  `verify-deployed.mjs` and `verify-prod-admin.mjs` pass, an article's second request is a Vercel
  cache HIT (0.32 s), a wrong-category URL sends one Location, `/page/2/` 301s to `/`.
- **Archive** (local `vh_migration`, P6 rehearsal 2026-11-19): see "Numbers" below.
- Design: round 3 approved by the owner (2026-11-17).
- **Ledgers, all re-run from a reset on 2026-11-19 (RUN lines = runnable gates in each):**
  `GATES.md` 61/62 (R3-G3 logos open) · `GATES-FINISH.md` 13/13 · `GATES-LAUNCH.md` 7/7 + L4
  abandoned (handoff) · migration P1 7/7, P3 7/8 (G7: the one orphan blob), P4 9/9, P5-rest 7/7,
  P5-convert 7/7, P5-import 8/8, P6 2/2.

## Needs you or the owner — in order of urgency

1. **Delete the public database dumps — urgent, independent of launch.** `/public_html/dbsofvh/`
   on the live server holds five WordPress dumps from October 2023 (~1.7 GB:
   `vh20231003.sql`, `db-vhnew.sql`, `backup-database-26-09-23-20h25.sql`,
   `backup_database_no_tablespace_26_09_23_20h25.sql`, `vh.20231003.sql.gz`). Re-measured
   2026-11-19: still there, and `https://www.vh.ma/dbsofvh/vh.20231003.sql.gz` answers 200 to
   anyone (54 MB). Raised 2026-11-05. The migration's FTP tools are read-only by design.
2. **Make the GitHub repository private** (`newpublicity2024-cmyk/VH-magazine` is public). It
   carries CLAUDE.md with the dev seed's admin login (no longer valid on production) and the
   whole migration's internals.
3. ~~Push and merge~~ — done 2026-11-19 (PR #2, deployed; see above).
4. **Go-ahead: LAUNCH step 3, the archive push** (one command, rehearsed — below). Replaces every
   table of Neon branch `production` (today the seed demo) with `vh_migration`; the admin
   account in `production-admin.txt` is re-created so the login keeps working.
5. **Vercel env `MEDIA_ORIGIN` (Production) is empty** — measured: an unknown legacy upload
   answers 404 instead of 302. Set it to `https://www.vh.ma` now; at cutover, to the old
   server's other name (step 6).
6. **Logo SVGs** — blue-on-white, white-on-black, compact "VH" mark (R3-G3; drop them in
   `public/` under the same names).
7. **Accounts** — who gets an admin/editor login. Once the archive is pushed, the admin creates
   them in `/admin` → Utilisateurs. Bylines: WordPress has 23 authors, none carried (the live
   site now refuses `/wp-json/wp/v2/users`).
8. **View counts, drafts, old video URLs** — only in the WordPress DB: allowlist an IP for
   Remote MySQL (this Mac's rotates daily) or drop a phpMyAdmin export into the migration
   folder; otherwise "Les plus lus" starts from zero.
9. **Cutover plan** — who changes vh.ma's DNS, when, and a short publishing freeze for the final
   sync.
10. Housekeeping: delete `vercel-production-env.txt` once `PAYLOAD_SECRET` is in a password
    manager (Vercel will not show it again); keep `production-admin.txt` the same way.
11. Optional: C5 (no global smooth scroll) was never shown to the owner; post 47196 duplicates
    47831 (could 301 to it); 404 pages render their body after hydration (status is correct;
    a server-rendered body needs `cacheComponents` — GATES-LAUNCH L4).

Decided 2026-11-19 (relayed by the user): magazine issues **imported** (200 issues from 202
posts), hotlinked images **kept as links**, search **covers article bodies**.

## Engineering

1. [x] Merged round 3 (PR #1, 2026-11-19). [x] Production env `DATABASE_URL`/`PAYLOAD_SECRET`
       set by the user; the 09:47 build migrated Neon `production`. [ ] `MEDIA_ORIGIN` (above).
2. [x] **Final sync rehearsed (P6, 2026-11-19, `GATES-P6.md`)** — the launch-day pass is the
       same commands, run behind a publishing freeze:
       ```
       cd /Users/mc/work/hostinger-ftp/migration
       python3 -I tools/p6_delta_inventory.py --merge        # upload folders changed since
       python3 -I tools/stage_media.py --select && python3 -I tools/stage_media.py --download
       (VH) import-media.ts --dir <migration>                # token from .secrets/blob.env
       node tools/wprest-survey.mjs categories tags pages posts media   # ~45 min
       node tools/wprest-convert.mjs
       (VH) import-articles.ts, import-page-redirects.ts, import-issues.ts   # DATABASE_URL=vh_migration
       node tools/verify-p6.mjs                              # every surveyed post is in vh_migration
       ```
3. [ ] **Push the archive to Neon** (go-ahead) — rehearsed by GATES-FINISH F7:
       ```
       TARGET_DATABASE_URL=<Neon production branch, pooled> \
         pnpm tsx src/migrate/push-archive.ts --confirm <its host> --admin-file production-admin.txt
       ```
       One transaction (all or nothing), row counts of every table checked against
       `vh_migration`, admin re-created. Then redeploy (the pages prerendered at build time —
       home, VH TV, Les Unes… — carry the build's database). Afterwards remove the seed's 282
       Blob files (`manifests/seed-blob-uploads.jsonl`) or keep them; they cost nothing.
4. [ ] **Verify on Vercel with the real data**: `node scripts/verify-deployed.mjs --base
       https://vh-magazine-iota.vercel.app --canonical https://www.vh.ma --media-origin
       https://www.vh.ma` (sitemap-driven: articles of both depths, categories, issues, search,
       legacy uploads, optimizer, admin); add `--redirects-db postgres://localhost/vh_migration
       --redirects-sample 2000` to replay a spread of the 36k redirect rows against it.
5. [x] Image serving decided (2026-11-17, GATES-LAUNCH L6): direct Blob URLs; optimizer limited
       to this store.
6. [ ] **Cutover** (go-ahead): point `MEDIA_ORIGIN` at the old server under another name before
       switching DNS (else late uploads 404 — loop guard); keep the old WordPress up; add vh.ma
       and www.vh.ma to the Vercel project; switch DNS; submit `sitemap.xml` and
       `news-sitemap.xml` in Search Console; watch 404s (Vercel logs) for a week. After DNS
       moves, `verify-deployed.mjs --base https://www.vh.ma --canonical https://www.vh.ma`
       (indexable, no noindex header).
7. [x] Smaller items (2026-11-17, `GATES-LAUNCH.md`): proxy rename, the 29 WordPress pages,
       import map, JSON-LD URLs. [ ] L4 (404 body) — handoff, see owner item 11.
8. [x] **Found and fixed 2026-11-19** (`GATES-FINISH.md`): articles were rendered on every
       request (no ISR route; ~1 s per view) — now cached, purged by the publish hook;
       WordPress's `/page/N/` archive URLs would have 404'd — now 301 to the listings; search
       covers bodies; 200 magazine issues imported (LAUNCH's earlier "150 distinct numbers" was
       a parsing error).

Critical path: dumps deleted (now) → push + merge (go-ahead) → final sync (P6, freeze) → archive
push (go-ahead) → verify on Vercel → logos + accounts → cutover.

## Numbers (measured 2026-11-19)

| | Live vh.ma (REST survey 10:18–10:54 UTC) | Local `vh_migration` after the P6 rehearsal |
|---|---|---|
| Articles | 8,147 published posts outside `/sommaire/` | 8,147 (26 added today: 19 new, 7 that waited for their hero image) |
| Magazine issues | 202 `/sommaire/` posts | 200 issues (N°60 and N°190 each merge two posts) |
| Media | 28,331 items (28,017 visible) | 31,231 rows (+100 today) + 167 raw newsletters, all in Blob |
| Categories / tags | 131 / 29,064 | 130 / 27,979 (the tags articles use) |
| Redirects | — | 36,448 (`/?p=`, tag archives, re-slugs, 8 pages, 204 issue redirects) |
| Users | 23 authors (endpoint now 403) | 0 — the push re-creates the admin |
| Size | — | 195 MB (Neon) · Blob store 154,731 objects ≈ 22 GB |

Uploads delta since the P1 inventory (2026-11-05): 884 files in `uploads/2026/11/`, 106 originals
staged, 100 Media rows + 1 newsletter imported. One leftover Blob object from a renamed upload
(`rabat.jpg`, 214 KB) awaits `blob-orphans.ts --delete` (blocked by the session's permission
classifier — run it, or approve it).
