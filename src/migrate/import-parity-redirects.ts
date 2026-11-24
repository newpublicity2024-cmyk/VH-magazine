import 'dotenv/config'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '../payload.config'

/**
 * Parity pass (2026-11-24) — redirects vh.ma answers that the REST survey cannot list.
 *
 *   DATABASE_URL=postgres://localhost/vh_migration \
 *     pnpm tsx src/migrate/import-parity-redirects.ts --dir /Users/mc/work/hostinger-ftp/migration
 *
 * Input: manifests/wprest/parity-redirects.jsonl (migration tools/survey-parity-redirects.mjs):
 * WordPress's former slugs that vh.ma's own pages still link to (the homepage's second dossier
 * among them), attachment pages forwarding to their file, oEmbed cards, and /category/sommaire/ →
 * /magazine-maroc/. The survey only lists a `from` that is not one of this site's URLs, so a row
 * can never shadow a page. Idempotent: an existing row is left alone when it agrees and repointed
 * (vh.ma being the source of truth until cutover) when it does not. Refuses any database but
 * vh_migration.
 */

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const dir = arg('dir')
  const file = path.join(dir ?? '', 'manifests', 'wprest', 'parity-redirects.jsonl')
  if (!dir || !existsSync(file)) throw new Error('--dir must point at the migration folder (manifests/wprest/parity-redirects.jsonl)')
  const dbName = new URL(process.env.DATABASE_URL || 'postgres://unset/unset').pathname.slice(1)
  if (dbName !== 'vh_migration') throw new Error(`refusing to import into "${dbName}" — only vh_migration`)

  const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { from: string; to: string })
  const payload = await getPayload({ config })
  const ctx = { skipRedirects: true }
  let created = 0
  let repointed = 0
  let unchanged = 0
  for (const r of rows) {
    if (!r.from.startsWith('/') || !r.to.startsWith('/') || r.from === r.to) throw new Error(`bad row ${JSON.stringify(r)}`)
    const found = await payload.find({ collection: 'redirects', where: { from: { equals: r.from } }, limit: 1, depth: 0, overrideAccess: true })
    const have = found.docs[0]
    if (!have) {
      await payload.create({
        collection: 'redirects',
        data: { from: r.from, to: r.to, permanent: true, source: 'migration' } as never,
        context: ctx,
        overrideAccess: true,
      })
      created++
    } else if (have.to !== r.to || have.permanent === false) {
      await payload.update({ collection: 'redirects', id: have.id, data: { to: r.to, permanent: true } as never, context: ctx, overrideAccess: true })
      repointed++
    } else unchanged++
  }
  console.log(`parity redirects: ${rows.length} from vh.ma — ${created} created, ${repointed} repointed, ${unchanged} unchanged`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
