import 'dotenv/config'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import type { Payload } from 'payload'

import config from '../payload.config'
import { query } from '../lib/db'
import { candidatePaths } from '../lib/legacy-media'

/**
 * Round 2b — import the WordPress magazine issues (posts of the `sommaire` rubric) as
 * MagazineIssues. Decision relayed by the user 2026-11-19: "Import 200 issues".
 *
 *   DATABASE_URL=postgres://localhost/vh_migration \
 *     pnpm tsx src/migrate/import-issues.ts --dir <migration dir>
 *
 * Input: manifests/wprest/converted.jsonl, records with kind 'issue' (202 on the 2026-11-11
 * survey). Measured then: every title carries its issue number (N°, Nº, "VH n"), 200 distinct
 * numbers from 1 to 201 (178 has no post) in date order; two numbers have two posts — N°60
 * (the issue and its supplement) and N°190 (two cover stories). LAUNCH.md's earlier
 * "150 distinct numbers" was a parsing error.
 *
 * Per number, the primary post is the earliest published (then the lowest WordPress id). It
 * becomes the issue, at its WordPress slug, so /sommaire/<slug>/ keeps its URL:
 *   number, title, cover ← featured image (resolved with the /api/legacy-media rules),
 *   summary ← the body's text, one block per paragraph (the page renders it pre-line),
 *   publishedAt, seo.description ← Yoast.
 * Redirects (source `migration`, permanent): /?p=<wpId> → the issue for all posts, and the
 * secondary post's /sommaire/<slug>/ → its number's issue.
 *
 * Idempotent, keyed by number: a re-run creates what is missing and converges what exists.
 * The report goes to manifests/wprest/import-issues.jsonl. Refuses any database but vh_migration.
 */

type LexNode = { type?: string; text?: string; children?: LexNode[] }
type Converted = {
  wpId: number
  kind: 'article' | 'issue'
  link: string
  slug: string
  title: string
  publishedAt: string
  featured: string | null
  seo: { title: string | null; description: string | null }
  body: { root?: LexNode } | LexNode | null
  /** An article WordPress also files under sommaire (converter of 2026-11-24 on). */
  inSommaire?: boolean
  categoryPath?: string
}

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

/** The issue number a title (or, failing that, the slug) carries. */
export function issueNumber(title: string, slug: string): number | null {
  const t = title.replace(/[–—]/g, ' ')
  const m = /N\s*[°º]\s*(\d{1,3})\b/i.exec(t) ?? /\bVH\s*(\d{1,3})\b/i.exec(t) ?? /\bn(\d{1,3})\b/.exec(slug)
  return m ? Number(m[1]) : null
}

/** Paragraph-level plain text of a Lexical body, blocks separated by a blank line. */
function summaryOf(body: Converted['body']): string {
  const root = body && 'root' in body ? body.root : (body as LexNode | null)
  const text = (n: LexNode): string =>
    n.type === 'linebreak' ? '\n' : (n.text ?? '') + (n.children ?? []).map(text).join('')
  return (root?.children ?? [])
    .map((n) => text(n).replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

async function main() {
  const dir = arg('dir')
  const W = (f: string) => path.join(dir ?? '', 'manifests', 'wprest', f)
  if (!dir || !existsSync(W('converted.jsonl'))) throw new Error('--dir must point at the migration folder')
  const dbName = new URL(process.env.DATABASE_URL || 'postgres://unset/unset').pathname.slice(1)
  if (dbName !== 'vh_migration') throw new Error(`refusing to import into "${dbName}" — only vh_migration`)

  const converted = readFileSync(W('converted.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Converted)
  const sommairePosts = converted.filter((r) => r.kind === 'issue')
  const sommaireNumbers = new Set(sommairePosts.map((r) => issueNumber(r.title, r.slug)))
  // Since N°202 vh.ma publishes an issue as an Actu post filed under sommaire too. Such a post
  // is an issue whose page is the article (`article` relation) — but only for a number no
  // /sommaire/ post carries, so an Actu teaser can never take an existing issue's URL.
  const articleIssues = converted.filter((r) => {
    if (r.kind !== 'article' || !r.inSommaire) return false
    const n = issueNumber(r.title, r.slug)
    return n !== null && !sommaireNumbers.has(n)
  })
  const issues = [...sommairePosts, ...articleIssues]
  const reportFile = W('import-issues.jsonl')
  writeFileSync(reportFile, '')
  const report = (e: Record<string, unknown>) => appendFileSync(reportFile, JSON.stringify(e) + '\n')

  // Group by number; refuse to guess when a title carries none.
  const byNumber = new Map<number, Converted[]>()
  for (const r of issues) {
    const n = issueNumber(r.title, r.slug)
    if (n === null) throw new Error(`no issue number in post ${r.wpId}: ${r.title}`)
    byNumber.set(n, [...(byNumber.get(n) ?? []), r])
  }
  for (const posts of byNumber.values()) {
    posts.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.wpId - b.wpId)
  }

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

  const payload: Payload = await getPayload({ config })
  const ctx = { skipRedirects: true }
  const existing = new Map(
    (await payload.find({ collection: 'magazine-issues', pagination: false, depth: 0 })).docs.map((d) => [d.number, d]),
  )

  let created = 0
  let updated = 0
  let unchanged = 0
  const errors: string[] = []
  const urlByWp = new Map<number, string>()
  const redirects: { from: string; to: string }[] = []

  for (const [number, posts] of [...byNumber.entries()].sort((a, b) => a[0] - b[0])) {
    const primary = posts[0]
    const cover = primary.featured ? resolveMedia(primary.featured) : null
    if (!cover) {
      errors.push(`N°${number} (post ${primary.wpId}): cover ${primary.featured} is not in Media`)
      report({ number, wpId: primary.wpId, error: 'cover not in Media', featured: primary.featured })
      continue
    }
    // An issue presented by an Actu post links to that article, and lives at its URL.
    let article: number | null = null
    if (primary.kind === 'article') {
      article = (await query<{ id: number }>('select id from articles where slug = $1', [primary.slug]))[0]?.id ?? null
      if (!article) {
        errors.push(`N°${number} (post ${primary.wpId}): its article ${primary.slug} is not imported`)
        report({ number, wpId: primary.wpId, error: 'article not imported', slug: primary.slug })
        continue
      }
    }
    const data = {
      number,
      title: primary.title,
      slug: primary.slug,
      cover,
      summary: summaryOf(primary.body) || null,
      publishedAt: primary.publishedAt,
      seo: { description: primary.seo.description ?? undefined },
      article,
    }
    const url = article ? `/${primary.categoryPath}/${primary.slug}/` : `/sommaire/${primary.slug}/`
    const have = existing.get(number)
    try {
      if (!have) {
        await payload.create({ collection: 'magazine-issues', data, context: ctx, overrideAccess: true })
        created++
      } else {
        const same =
          have.title === data.title &&
          have.slug === data.slug &&
          (typeof have.cover === 'object' ? have.cover?.id : have.cover) === cover &&
          (have.summary ?? null) === data.summary &&
          ((typeof have.article === 'object' ? have.article?.id : have.article) ?? null) === article &&
          new Date(have.publishedAt).getTime() === new Date(data.publishedAt).getTime()
        if (same) unchanged++
        else {
          await payload.update({ collection: 'magazine-issues', id: have.id, data, context: ctx, overrideAccess: true })
          updated++
        }
      }
    } catch (e) {
      errors.push(`N°${number} (post ${primary.wpId}): ${(e as Error).message}`)
      report({ number, wpId: primary.wpId, error: (e as Error).message })
      continue
    }
    for (const p of posts) {
      urlByWp.set(p.wpId, url)
      redirects.push({ from: `/?p=${p.wpId}`, to: url })
      const own = new URL(p.link).pathname
      if (own !== url) redirects.push({ from: own, to: url })
      report({ number, wpId: p.wpId, slug: p.slug, url, role: p === primary ? 'issue' : 'merged' })
    }
  }

  const existingFrom = new Map(
    (await query<{ from: string; to: string }>('select "from", "to" from redirects')).map((r) => [r.from, r.to]),
  )
  let redirected = 0
  for (const r of redirects) {
    const have = existingFrom.get(r.from)
    if (have === r.to) continue
    if (have !== undefined) {
      errors.push(`redirect ${r.from} already points at ${have}, not ${r.to}`)
      continue
    }
    try {
      await payload.create({
        collection: 'redirects',
        data: { ...r, permanent: true, source: 'migration' },
        context: ctx,
        overrideAccess: true,
      })
      redirected++
    } catch (e) {
      errors.push(`redirect ${r.from}: ${(e as Error).message}`)
    }
  }

  const merged = [...byNumber.values()].filter((p) => p.length > 1)
  console.log(
    `${issues.length} issue posts → ${byNumber.size} issues (${merged
      .map((p) => `N°${issueNumber(p[0].title, p[0].slug)} merges ${p.length}`)
      .join(', ')}): ${created} created, ${updated} updated, ${unchanged} unchanged; ` +
      `${redirects.length} redirects wanted, ${redirected} created`,
  )
  if (errors.length) {
    for (const e of errors) console.log(`  error: ${e}`)
    console.log(`import finished with ${errors.length} error(s)`)
    process.exit(1)
  }
  console.log('import finished without errors')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
