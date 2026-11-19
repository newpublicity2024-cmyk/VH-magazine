import 'dotenv/config'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import type { Payload } from 'payload'

import config from '../payload.config'
import { query } from '../lib/db'
import { candidatePaths } from '../lib/legacy-media'

/**
 * Round 2b, phase P5 — import the converted WordPress posts into Payload.
 *
 *   DATABASE_URL=postgres://localhost/vh_migration \
 *     pnpm tsx src/migrate/import-articles.ts --dir <migration dir> [--concurrency 6] [--limit N]
 *
 * Input (built and verified in the migration workspace, gates P5-rest / P5-convert):
 *   manifests/wprest/converted.jsonl  one record per post: Lexical body with upload
 *                                     placeholders { legacyPath }, category, tags, SEO
 *   manifests/wprest/taxonomy.json    categories (parent chain) and the tags articles use
 *   manifests/wprest/media.jsonl      WordPress alt text per upload
 *
 * Writes, in order, each step idempotent (keyed by slug / `from`):
 *   1. categories, parents first           5. redirects: /?p=<id> → article, /tag/<slug>/ → category
 *   2. tags                                6. articles.updated_at ← WordPress modified date
 *   3. Media alt ← WordPress alt text      7. manifests/wprest/import-articles.jsonl (wpId → id, url)
 *   4. articles (published)
 *
 * A re-run creates only what is missing, and converges what exists on the conversion: an
 * existing article whose publication date differs is updated through Payload (so the latest
 * version, which the admin editor opens, changes too — e.g. post 47196, which WordPress dates
 * 1970-01-01 and the converter dates by its modified date). Existing bodies are walked again
 * so the dropped-uploads list is the same on every run.
 *
 * Magazine issues (posts of the `sommaire` rubric) are not articles: import-issues.ts imports
 * them as MagazineIssues (200 numbers from 202 posts; decision relayed 2026-11-19).
 *
 * Media the import cannot resolve (gate P5-convert:G5 proves each is one of these):
 *   - a body image the live site itself 404s → the node is dropped, listed in
 *     import-articles-dropped.jsonl;
 *   - a hero image uploaded after the P3 inventory → the article is deferred to P6, listed
 *     in import-articles-deferred.jsonl (featuredImage is required; no article goes in
 *     without its picture). Body images of that vintage are dropped and listed likewise;
 *     re-running after P6 picks both up.
 *
 * Refuses any database but vh_migration: the dev seed lives in vh_magazine and
 * production is only ever written by a reviewed push.
 */

type Upload = { type: 'upload'; value: { legacyPath: string } | number; [k: string]: unknown }
type LexNode = { type?: string; children?: LexNode[]; [k: string]: unknown }
type Converted = {
  wpId: number
  kind: 'article' | 'issue'
  link: string
  slug: string
  wpSlug: string
  title: string
  excerpt: string | null
  publishedAt: string
  modifiedAt: string
  categoryWpId: number
  categoryPath: string
  tagWpIds: number[]
  featured: string | null
  isVideo: boolean
  videoUrl: string | null
  seo: {
    title: string | null
    description: string | null
    canonicalURL: string | null
    noIndex: boolean
  }
  body: { root: LexNode } | LexNode
}
type Taxonomy = {
  categories: {
    wpId: number
    name: string
    slug: string
    parentWpId: number | null
    path: string
    description: string | null
  }[]
  tags: { wpId: number; name: string; slug: string; from: string; redirectTo: string }[]
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const readJsonl = <T>(file: string): T[] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T)

/** Bounded-concurrency map; results in input order. */
async function pool<T, R>(
  items: T[],
  n: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

async function main() {
  const dir = arg('dir')
  const W = (f: string) => path.join(dir ?? '', 'manifests', 'wprest', f)
  if (!dir || !existsSync(W('converted.jsonl')) || !existsSync(W('taxonomy.json'))) {
    throw new Error(
      '--dir must point at the migration folder (manifests/wprest/converted.jsonl, taxonomy.json)',
    )
  }
  const dbName = new URL(process.env.DATABASE_URL || 'postgres://unset/unset').pathname.slice(1)
  if (dbName !== 'vh_migration')
    throw new Error(`refusing to import into "${dbName}" — only vh_migration`)
  const concurrency = Number(arg('concurrency', '6'))
  const limit = arg('limit') ? Number(arg('limit')) : Infinity
  const errorsFile = W('import-articles-errors.jsonl')
  const deferredFile = W('import-articles-deferred.jsonl')
  const droppedFile = W('import-articles-dropped.jsonl')
  for (const f of [errorsFile, deferredFile, droppedFile]) writeFileSync(f, '')
  const fail = (entry: Record<string, unknown>) =>
    appendFileSync(errorsFile, JSON.stringify(entry) + '\n')
  const record = (file: string, entry: Record<string, unknown>) =>
    appendFileSync(file, JSON.stringify(entry) + '\n')

  const converted = readJsonl<Converted>(W('converted.jsonl'))
  const taxonomy = JSON.parse(readFileSync(W('taxonomy.json'), 'utf8')) as Taxonomy
  const articles = converted.filter((r) => r.kind === 'article').slice(0, limit)
  console.log(
    `target ${dbName}: ${articles.length} articles, ${taxonomy.categories.length} categories, ${taxonomy.tags.length} tags`,
  )

  const payload: Payload = await getPayload({ config })
  const ctx = { skipRedirects: true }

  // Media: legacy path → id, resolved with the /api/legacy-media rules.
  const mediaRows = await query<{ id: number; legacy_path: string }>(
    'select id, legacy_path from media where legacy_path is not null',
  )
  const mediaByPath = new Map(mediaRows.map((r) => [r.legacy_path, r.id]))
  const resolveMedia = (lp: string): number | null => {
    for (const c of candidatePaths(lp)) {
      const id = mediaByPath.get(c)
      if (id) return id
    }
    return null
  }

  // 1. Categories, parents first (depth = path segments).
  const catId = new Map<number, number>()
  const existingCats = new Map(
    (await query<{ id: number; slug: string }>('select id, slug from categories')).map((r) => [
      r.slug,
      r.id,
    ]),
  )
  for (const c of [...taxonomy.categories].sort(
    (a, b) => a.path.split('/').length - b.path.split('/').length,
  )) {
    const have = existingCats.get(c.slug)
    if (have) {
      catId.set(c.wpId, have)
      continue
    }
    const doc = await payload.create({
      collection: 'categories',
      data: {
        name: c.name,
        slug: c.slug,
        description: c.description ?? undefined,
        parent: c.parentWpId ? catId.get(c.parentWpId) : undefined,
      },
      context: ctx,
      overrideAccess: true,
    })
    catId.set(c.wpId, doc.id as number)
  }
  console.log(`categories: ${catId.size}`)

  // 2. Tags.
  const tagId = new Map<number, number>()
  const existingTags = new Map(
    (await query<{ id: number; slug: string }>('select id, slug from tags')).map((r) => [
      r.slug,
      r.id,
    ]),
  )
  await pool(taxonomy.tags, concurrency, async (t) => {
    const have = existingTags.get(t.slug)
    if (have) {
      tagId.set(t.wpId, have)
      return
    }
    try {
      const doc = await payload.create({
        collection: 'tags',
        data: { name: t.name, slug: t.slug },
        context: ctx,
        overrideAccess: true,
      })
      tagId.set(t.wpId, doc.id as number)
    } catch (e) {
      fail({ step: 'tag', wpId: t.wpId, slug: t.slug, error: (e as Error).message })
    }
  })
  console.log(`tags: ${tagId.size}`)

  // 3. Media alt text from WordPress, where WordPress has one. Direct SQL: 28k rows, and
  //    the only Media hook is revalidation, which has no request scope here anyway.
  const altRows = readJsonl<{ source_url: string; alt_text: string }>(W('media.jsonl'))
    .filter((m) => m.alt_text?.trim())
    .map((m) => {
      let p: string
      try {
        p = decodeURIComponent(new URL(m.source_url).pathname).replace(/^\//, '')
      } catch {
        return null
      }
      const id = resolveMedia(p)
      return id ? { id, alt: m.alt_text.trim().slice(0, 500) } : null
    })
    .filter((x): x is { id: number; alt: string } => x !== null)
  if (altRows.length) {
    await query(
      'update media set alt = v.alt from unnest($1::int[], $2::text[]) as v(id, alt) where media.id = v.id',
      [altRows.map((r) => r.id), altRows.map((r) => r.alt)],
    )
  }
  console.log(`media alt text from WordPress: ${altRows.length}`)

  // 4. Articles.
  const existingArticles = new Map(
    (
      await query<{ id: number; slug: string; published_at: Date | string | null }>(
        'select id, slug, published_at from articles',
      )
    ).map((r) => [r.slug, { id: r.id, publishedAt: r.published_at }]),
  )
  const mapFile = W('import-articles.jsonl')
  const map: { wpId: number; id: number; url: string }[] = []
  let created = 0
  let droppedUploads = 0
  let deferred = 0
  const redated: string[] = []
  const bodyWithIds = (root: LexNode, wpId: number): LexNode => {
    const walk = (n: LexNode): LexNode | null => {
      if (n.type === 'upload') {
        const u = n as Upload
        const id = typeof u.value === 'number' ? u.value : resolveMedia(u.value.legacyPath)
        if (!id) {
          droppedUploads++
          record(droppedFile, {
            wpId,
            legacyPath: typeof u.value === 'number' ? u.value : u.value.legacyPath,
          })
          return null
        }
        return { ...u, value: id }
      }
      if (!n.children) return n
      return { ...n, children: n.children.map(walk).filter((c): c is LexNode => c !== null) }
    }
    return walk(root) as LexNode
  }
  await pool(articles, concurrency, async (r) => {
    const url = `/${r.categoryPath}/${r.slug}/`
    const have = existingArticles.get(r.slug)
    const source = 'root' in r.body ? (r.body as { root: LexNode }).root : (r.body as LexNode)
    if (have) {
      map.push({ wpId: r.wpId, id: have.id, url })
      // The same walk as a first import, for the dropped-uploads list; the body itself stays.
      bodyWithIds(source, r.wpId)
      const stored = have.publishedAt === null ? NaN : new Date(have.publishedAt).getTime()
      if (stored !== new Date(r.publishedAt).getTime()) {
        try {
          await payload.update({
            collection: 'articles',
            id: have.id,
            data: { publishedAt: r.publishedAt },
            context: ctx,
            overrideAccess: true,
          })
          redated.push(`${r.slug}: ${new Date(stored).toISOString()} → ${r.publishedAt}`)
        } catch (e) {
          fail({ step: 'article date', wpId: r.wpId, slug: r.slug, error: (e as Error).message })
        }
      }
      return
    }
    const featuredImage = r.featured ? resolveMedia(r.featured) : null
    const category = catId.get(r.categoryWpId)
    if (!category) {
      fail({ step: 'article', wpId: r.wpId, slug: r.slug, error: `no category ${r.categoryWpId}` })
      return
    }
    if (!featuredImage) {
      deferred++
      record(deferredFile, { wpId: r.wpId, slug: r.slug, featured: r.featured })
      return
    }
    // Checked after the substitution: a body of nothing but unresolvable images ends empty.
    const root = bodyWithIds(source, r.wpId)
    try {
      const doc = await payload.create({
        collection: 'articles',
        data: {
          title: r.title,
          slug: r.slug,
          excerpt: r.excerpt ?? undefined,
          featuredImage,
          // no content on WordPress → no body (an empty Lexical root is not a valid document)
          body: (root.children?.length ? { root } : undefined) as never,
          category,
          tags: r.tagWpIds.map((t) => tagId.get(t)).filter((t): t is number => Boolean(t)),
          publishedAt: r.publishedAt,
          isVideo: r.isVideo,
          videoUrl: r.videoUrl ?? undefined,
          viewCount: 0,
          seo: {
            title: r.seo.title ?? undefined,
            description: r.seo.description ?? undefined,
            canonicalURL: r.seo.canonicalURL ?? undefined,
            noIndex: r.seo.noIndex,
          },
          _status: 'published',
        },
        context: ctx,
        overrideAccess: true,
      })
      created++
      map.push({ wpId: r.wpId, id: doc.id as number, url })
      if (created % 500 === 0) console.log(`articles: ${created} created`)
    } catch (e) {
      fail({ step: 'article', wpId: r.wpId, slug: r.slug, error: (e as Error).message })
    }
  })
  writeFileSync(
    mapFile,
    map
      .sort((a, b) => a.wpId - b.wpId)
      .map((m) => JSON.stringify(m))
      .join('\n') + '\n',
  )
  console.log(
    `articles: ${created} created, ${map.length} mapped, ${redated.length} publication dates updated, ${deferred} deferred to P6, ${droppedUploads} unresolvable body uploads dropped`,
  )
  for (const line of redated) console.log(`  redated ${line}`)

  // 5. Redirects: /?p=<wpId> for every imported article, /tag/<slug>/ for every tag.
  const existingFrom = new Map(
    (await query<{ id: number; from: string; to: string }>('select id, "from", "to" from redirects')).map((r) => [
      r.from,
      r,
    ]),
  )
  // Re-slugged articles (48 live slugs with percent-encoded characters the app's slug rule
  // refuses): their WordPress path → the new URL. WordPress links use lowercase hex; a browser
  // that encodes the characters itself sends uppercase, so both spellings are mapped.
  const urlByWp = new Map(map.map((m) => [m.wpId, m.url]))
  const reslugged = articles
    .filter((r) => r.slug !== r.wpSlug && urlByWp.has(r.wpId))
    .flatMap((r) => {
      const wpPath = new URL(r.link).pathname
      const upper = wpPath.replace(/%[0-9a-f]{2}/g, (h) => h.toUpperCase())
      return [...new Set([wpPath, upper])].map((from) => ({ from, to: urlByWp.get(r.wpId)! }))
    })
  const redirects = [
    ...map.map((m) => ({ from: `/?p=${m.wpId}`, to: m.url })),
    ...reslugged,
    ...taxonomy.tags
      .filter((t) => tagId.has(t.wpId))
      .flatMap((t) =>
        [...new Set([t.from, t.from.replace(/%[0-9a-f]{2}/g, (h) => h.toUpperCase())])].map(
          (from) => ({ from, to: t.redirectTo }),
        ),
      ),
  ]
  // Converge, like import-page-redirects.ts: an existing row whose target changed is repointed.
  // A tag's target is its most common category, which new articles can move (2026-11-19 P6:
  // /tag/bamotors/ went from /category/moteur/ to /category/moteur/vh-moteur/).
  const repoint = redirects.filter((r) => existingFrom.has(r.from) && existingFrom.get(r.from)!.to !== r.to)
  let repointed = 0
  for (const r of repoint) {
    try {
      await payload.update({
        collection: 'redirects',
        id: existingFrom.get(r.from)!.id,
        data: { to: r.to },
        context: ctx,
        overrideAccess: true,
      })
      repointed++
    } catch (e) {
      fail({ step: 'redirect repoint', from: r.from, error: (e as Error).message })
    }
  }
  const missing = redirects.filter((r) => !existingFrom.has(r.from))
  let redirected = 0
  await pool(missing, concurrency, async (r) => {
    try {
      await payload.create({
        collection: 'redirects',
        data: { ...r, permanent: true, source: 'migration' },
        context: ctx,
        overrideAccess: true,
      })
      redirected++
    } catch (e) {
      fail({ step: 'redirect', from: r.from, error: (e as Error).message })
    }
  })
  console.log(`redirects: ${redirected} created, ${repointed} repointed`)

  // 6. updatedAt ← WordPress's modified date, so sitemaps carry the real lastmod.
  const byWp = new Map(articles.map((r) => [r.wpId, r]))
  const ids = map.map((m) => m.id)
  const dates = map.map((m) => byWp.get(m.wpId)!.modifiedAt)
  await query(
    'update articles set updated_at = v.d from unnest($1::int[], $2::timestamptz[]) as v(id, d) where articles.id = v.id',
    [ids, dates],
  )
  console.log(`updated_at set for ${ids.length} articles`)

  const errors = readFileSync(errorsFile, 'utf8').split('\n').filter(Boolean).length
  console.log(
    errors
      ? `import finished with ${errors} error(s) — see ${errorsFile}`
      : 'import finished without errors',
  )
  process.exit(errors ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
