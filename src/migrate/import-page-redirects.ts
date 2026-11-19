import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '../payload.config'
import { query } from '../lib/db'
import { WP_PAGE_DECISIONS } from './wp-pages'

/**
 * Round 2b — the WordPress pages' redirects (LAUNCH.md step 7, gate GATES-LAUNCH L7).
 *
 *   DATABASE_URL=postgres://localhost/vh_migration \
 *     pnpm tsx src/migrate/import-page-redirects.ts --dir <migration dir>
 *
 * Reads the REST survey's pages (manifests/wprest/pages.jsonl), refuses to run while any
 * surveyed page lacks a decision in wp-pages.ts, and creates one permanent `migration`
 * redirect per page decided `redirect`. Re-runnable: keyed by `from`; an existing row with
 * a different target is updated, not duplicated.
 *
 * Refuses any database but vh_migration, like import-articles.ts: the dev seed lives in
 * vh_magazine and production is only ever written by a reviewed push.
 */

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

async function main() {
  const dir = arg('dir')
  if (!dir) throw new Error('usage: import-page-redirects.ts --dir <migration dir>')
  const dbName = new URL(process.env.DATABASE_URL || 'postgres://unset/unset').pathname.slice(1)
  if (dbName !== 'vh_migration') throw new Error(`refusing to write into "${dbName}" — only vh_migration`)

  const pages = readFileSync(path.join(dir, 'manifests', 'wprest', 'pages.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { id: number; link: string })
  const decided = new Map(WP_PAGE_DECISIONS.map((d) => [d.id, d]))
  const undecided = pages.filter((p) => !decided.has(p.id))
  if (undecided.length) {
    throw new Error(`no decision in wp-pages.ts for: ${undecided.map((p) => `${p.id} ${p.link}`).join(', ')}`)
  }
  for (const p of pages) {
    const d = decided.get(p.id)!
    if (d.path !== new URL(p.link).pathname) throw new Error(`page ${p.id}: decided path ${d.path}, survey ${p.link}`)
  }

  const payload = await getPayload({ config })
  const ctx = { skipRedirects: true }
  let created = 0
  let updated = 0
  let unchanged = 0
  for (const d of WP_PAGE_DECISIONS) {
    if (d.action !== 'redirect') continue
    const [row] = await query<{ id: number; to: string; permanent: boolean }>(
      'select id, "to", permanent from redirects where "from" = $1',
      [d.path],
    )
    const data = { from: d.path, to: d.to, permanent: true, source: 'migration' as const }
    if (!row) {
      await payload.create({ collection: 'redirects', data, context: ctx, overrideAccess: true })
      created++
    } else if (row.to !== d.to || !row.permanent) {
      await payload.update({ collection: 'redirects', id: row.id, data, context: ctx, overrideAccess: true })
      updated++
    } else {
      unchanged++
    }
  }
  console.log(
    `pages: ${pages.length} surveyed, all decided; redirects: ${created} created, ${updated} updated, ${unchanged} unchanged`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
