import 'dotenv/config'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

import { getPool, query } from '../lib/db'

/**
 * Parity pass (2026-11-24) — vh.ma's view counters, so "Les plus lus" ranks as it does there.
 *
 *   DATABASE_URL=postgres://localhost/vh_migration \
 *     pnpm tsx src/migrate/import-view-counts.ts --dir /Users/mc/work/hostinger-ftp/migration
 *
 * Input: manifests/wprest/post-meta.jsonl (migration tools/crawl-post-meta.mjs: every post page of
 * vh.ma, its hidden Soledad counter). The count is what the page shows — exact below 1,000, rounded
 * to 0.1K above (9,3K → 9300); exact counts need the WordPress database (LAUNCH owner item 8).
 * A post's page is matched by its URL's last segment: an article's slug, or a /sommaire/ issue's.
 *
 * Set with SQL, as the site's own view counter does (/api/view): a counter is not editorial
 * content, and a Payload update per article would write 8,000 versions and purge every page.
 * Idempotent; refuses any database but vh_migration. Articles vh.ma shows no counter for keep 0.
 */

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

type Row = { url: string; status?: number; views?: number | null; error?: string }

async function main() {
  const dir = arg('dir')
  const file = path.join(dir ?? '', 'manifests', 'wprest', 'post-meta.jsonl')
  if (!dir || !existsSync(file)) throw new Error('--dir must point at the migration folder (manifests/wprest/post-meta.jsonl)')
  const dbName = new URL(process.env.DATABASE_URL || 'postgres://unset/unset').pathname.slice(1)
  if (dbName !== 'vh_migration') throw new Error(`refusing to import into "${dbName}" — only vh_migration`)

  const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row)
  const articleViews = new Map<string, number>()
  const issueViews = new Map<string, number>()
  let unreadable = 0
  for (const r of rows) {
    if (r.status !== 200 || r.views == null) {
      unreadable++
      continue
    }
    const seg = new URL(r.url).pathname.split('/').filter(Boolean)
    const slug = decodeURIComponent(seg.at(-1) ?? '')
    ;(seg[0] === 'sommaire' ? issueViews : articleViews).set(slug, r.views)
  }

  const set = async (table: 'articles' | 'magazine_issues', m: Map<string, number>) => {
    const slugs = [...m.keys()]
    const views = slugs.map((s) => m.get(s)!)
    const changed = await query<{ n: string }>(
      `with v as (select unnest($1::text[]) as slug, unnest($2::numeric[]) as views),
            u as (update ${table} t set view_count = v.views from v
                   where t.slug = v.slug and t.view_count is distinct from v.views returning 1)
       select count(*)::text as n from u`,
      [slugs, views],
    )
    const matched = await query<{ n: string }>(
      `select count(*)::text as n from ${table} where slug = any($1::text[])`,
      [slugs],
    )
    return { counted: slugs.length, matched: Number(matched[0].n), changed: Number(changed[0].n) }
  }
  const a = await set('articles', articleViews)
  const i = await set('magazine_issues', issueViews)
  const top = await query<{ slug: string; view_count: string }>(
    'select slug, view_count::text from articles order by view_count desc, published_at desc limit 5',
  )
  console.log(
    `view counts from ${rows.length} vh.ma pages (${unreadable} without a readable counter):\n` +
      `  articles: ${a.counted} counted, ${a.matched} matched, ${a.changed} changed\n` +
      `  issues:   ${i.counted} counted, ${i.matched} matched, ${i.changed} changed\n` +
      `  top articles: ${top.map((t) => `${t.slug} ${t.view_count}`).join(' · ')}`,
  )
  await getPool().end()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
