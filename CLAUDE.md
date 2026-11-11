# VH Magazine (vh.ma)

Next.js 16 (App Router) + Payload CMS 3.85 + Postgres. French LTR magazine,
rebuilt from WordPress + WPBakery. Sister sites: `MFM-sport`, `lallafatema`.

Source of truth for scope: `vh-magazine-website-spec.md`, `vh_homepage_wireframe.svg`,
and the amendments + inventory in `PLAN.md`. Acceptance lives in `GATES.md`.

## Session state (2026-11-11)

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
  legacy upload URL. P5 (8,170 articles) is blocked on Hostinger Remote MySQL
  allowlisting this Mac's public IP.
- `GATES.md` = G1–G41. G40–G41 (2026-11-11) cover two nav links G12 checked by
  text but never requested — Grand Angle and KIT MEDIA both 404'd.
- Still open from round 1: the D4 visual punch list never arrived.

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
- **Vercel Blob serves HTML as `Content-Disposition: attachment`.** The legacy
  newsletters are proxied inline under a `sandbox` CSP instead of redirected.

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

## Approved deviations from the spec

| Spec | Deviation | Reason |
|---|---|---|
| §3 grey `#888–#999` | `--color-meta: #757575` | `#8a8a8a` is 3.45:1 on white — fails WCAG AA across 53 elements. Colour is a modernization-pass item (§10), so AA wins. **User-approved.** Do not restore. |
| §8 Drizzle/Prisma + custom admin | Payload CMS 3 | Matches sister sites; admin, media, drafts, rich text come for free. **User-approved.** |
| Wireframe pairing | Collector, Cool Drives and both Dossiers are full-width stacked | The sketch compacted them; spec §5 and the live site stack them. **User-approved (A2).** |

## Commands

```
pnpm dev            # localhost:3000, admin at /admin (admin@vh.ma / vhmagazine)
pnpm seed           # idempotent
pnpm migrate        # apply pending Payload migrations to DATABASE_URL (push is off)
pnpm build
pnpm generate:types # after any collection change
```
