# Deploying VH Magazine to Vercel

## The error you hit

```
Error: missing secret key. A secret key is needed to secure Payload.
Error occurred prerendering page "/news-sitemap.xml"
```

Payload could not start because **no environment variables were set on Vercel**.
`/news-sitemap.xml` was simply the first prerendered route that touches the
database — the same failure would have come from `/`, `/vh-tv/` or `/rss.xml`.

Behind it sat a second failure you had not reached yet: `DATABASE_URL` pointed
at `postgres://localhost/...`, which does not exist inside Vercel's build
container. And a third: with `push: false`, Payload does not create tables on a
fresh database — that needs migrations, which did not exist yet.

All three are addressed. The build now succeeds even with nothing configured,
but **it will serve an empty site until you complete the steps below.**

## 1. Create a Postgres database

Any Postgres works; Neon is what the sister sites use.

- Vercel dashboard → **Storage** → **Create Database** → **Neon**, or sign up at
  neon.tech and copy the connection string.
- It must be reachable from the public internet and use SSL. The connection
  string looks like:
  `postgres://user:password@ep-xxx.eu-central-1.aws.neon.tech/vhmagazine?sslmode=require`

## 2. Set the environment variables

Vercel → your project → **Settings → Environment Variables**. Add these to
**Production, Preview and Development**:

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | your Neon connection string | must include `?sslmode=require` |
| `PAYLOAD_SECRET` | a long random string | generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_SERVER_URL` | `https://www.vh.ma` | see the warning below |
| `MEDIA_ORIGIN` | `https://www.vh.ma` | upstream for legacy `/wp-content/uploads/*` |

> **`NEXT_PUBLIC_SERVER_URL` is deliberately the FINAL domain, not the Vercel
> preview URL.** Every canonical, sitemap entry, RSS link and JSON-LD URL is
> built from it, so nothing in the markup has to change at DNS cutover. While
> the site runs on a Vercel domain, middleware sends `X-Robots-Tag: noindex` for
> any host that is not `vh.ma`/`www.vh.ma`, so the preview cannot be indexed —
> and that protection disappears by itself once DNS points at the real domain.
> There is no flag to remember to flip.

## 3. Deploy

Push to `main`. The build runs `scripts/deploy-migrate.mjs` first, which applies
the migrations in `src/migrations/` (creating all 24 tables plus the full-text
search column and index), then builds.

Migrations are recorded, so redeploys skip them.

## 4. Seed the content

The database is empty after migrating. From your machine, pointed at Neon:

```bash
cd /Users/mc/work/VH-magazine
DATABASE_URL='<your neon url>' PAYLOAD_SECRET='<same secret as Vercel>' pnpm seed
```

This is idempotent — safe to re-run. It creates 11 categories, 33 published
articles with generated placeholder imagery, 4 magazine issues, 7 banners, the
admin user, and one deliberate draft used as a test control.

Then sign in at `https://<your-domain>/admin` with `admin@vh.ma` / `vhmagazine`
and **change that password immediately** — it is a known default.

## What "prototype" means here

Working: homepage, article pages (nested URLs), category listings with
pagination, Les Unes, sommaire, VH TV, contact, team, sondage, search, the admin,
sitemap/RSS/robots/JSON-LD, redirects, view counter.

Not included (round 2b): the migration of the 8,170 real articles from vh.ma, so
the site shows seeded demo content with generated placeholder images rather than
the real archive. Media still resolves from the old WordPress via `MEDIA_ORIGIN`.

## If the build fails again

- `[deploy-migrate] Skipping migrations: … not set` — the env vars are missing or
  were added to the wrong environment. The build still succeeds, and the site
  will be empty.
- Migrations run but fail — the build stops deliberately rather than deploy
  against a half-migrated schema. Check that `DATABASE_URL` is reachable and the
  role can create tables.
- Pages render but are empty — the database migrated but was never seeded. Step 4.
