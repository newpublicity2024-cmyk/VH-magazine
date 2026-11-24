import 'dotenv/config'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '../payload.config'
import { query } from '../lib/db'
import { candidatePaths } from '../lib/legacy-media'

/**
 * Parity pass (2026-11-24) — vh.ma's homepage curation, into the archive (vh_migration), so every
 * push to production carries it and nothing has to be re-made by hand after one.
 *
 *   DATABASE_URL=postgres://localhost/vh_migration \
 *     pnpm tsx src/migrate/import-homepage.ts --dir /Users/mc/work/hostinger-ftp/migration
 *
 * Input: manifests/wprest/homepage.json (migration tools/survey-homepage.mjs, a GET of vh.ma's /).
 *   banners  podcast          ← THE SHIFT PODCAST (image → YouTube playlist)
 *            collector        ← EN KIOSQUE cover — only the sidebar's fallback: the panel shows
 *                               the latest issue itself (KiosqueCover)
 *            collector-sport  ← "Un collector à ne pas manquer !"
 *            cool-drives      ← "Cool Drives By Rafik Lahlou" (image → Instagram, text)
 *            le-luxe          ← the Grand Angle header above the dossier strips
 *            any other slot   → inactive (vh.ma shows no Who's Who or Les Unes banner)
 *   homepage dossiers (image, title, text, link); Chroniques cigare left empty: the homepage
 *            applies vh.ma's own rule, the latest five posts filed under vitoles-volutes
 *   site settings: the default share image (vh.ma's og:image)
 * Images resolve to Media by legacy path with the /api/legacy-media rules (-WxH folded…).
 * Idempotent; refuses any database but vh_migration.
 */

type Slot = { image: string | null; href: string | null; body?: string | null }
type Survey = {
  fetchedAt: string
  ogImage: string | null
  kiosque: Slot
  podcast: Slot
  collectorSport: Slot
  coolDrives: Slot
  grandAngle: Slot
  dossiers: { image: string; imageHref: string | null; title: string; body: string | null; linkUrl: string; linkLabel: string }[]
}

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const dir = arg('dir')
  const file = path.join(dir ?? '', 'manifests', 'wprest', 'homepage.json')
  if (!dir || !existsSync(file)) throw new Error('--dir must point at the migration folder (manifests/wprest/homepage.json)')
  const dbName = new URL(process.env.DATABASE_URL || 'postgres://unset/unset').pathname.slice(1)
  if (dbName !== 'vh_migration') throw new Error(`refusing to import into "${dbName}" — only vh_migration`)
  const s = JSON.parse(readFileSync(file, 'utf8')) as Survey

  const mediaRows = await query<{ id: number; legacy_path: string }>('select id, legacy_path from media where legacy_path is not null')
  const byPath = new Map(mediaRows.map((r) => [r.legacy_path, r.id]))
  const media = (lp: string | null, what: string): number => {
    for (const c of lp ? candidatePaths(lp) : []) {
      const id = byPath.get(c)
      if (id) return id
    }
    throw new Error(`${what}: image ${lp} is not in Media`)
  }

  const payload = await getPayload({ config })
  const banners: { key: string; title: string; slot: Slot; link?: string }[] = [
    { key: 'podcast', title: 'The Shift Podcast', slot: s.podcast },
    { key: 'collector', title: 'En kiosque', slot: s.kiosque },
    { key: 'collector-sport', title: 'Un collector à ne pas manquer !', slot: s.collectorSport },
    { key: 'cool-drives', title: 'Cool Drives By Rafik Lahlou', slot: s.coolDrives },
    // vh.ma's header image has no link; the dossier images below it link to /le-luxe/.
    { key: 'le-luxe', title: 'Grand Angle', slot: s.grandAngle, link: '/le-luxe/' },
  ]
  const lines: string[] = []
  for (const b of banners) {
    const data = {
      key: b.key as never,
      title: b.title,
      image: media(b.slot.image, `banner ${b.key}`),
      linkUrl: b.slot.href ?? b.link ?? '/',
      body: b.slot.body ?? null,
      active: true,
    }
    const found = await payload.find({ collection: 'banners', where: { key: { equals: b.key } }, limit: 1, depth: 0 })
    const have = found.docs[0]
    if (!have) {
      await payload.create({ collection: 'banners', data, overrideAccess: true })
      lines.push(`banner ${b.key}: created`)
    } else if (
      have.title !== data.title ||
      (typeof have.image === 'object' ? have.image?.id : have.image) !== data.image ||
      have.linkUrl !== data.linkUrl ||
      (have.body ?? null) !== data.body ||
      !have.active
    ) {
      await payload.update({ collection: 'banners', id: have.id, data, overrideAccess: true })
      lines.push(`banner ${b.key}: updated`)
    } else lines.push(`banner ${b.key}: unchanged`)
  }
  const keep = new Set(banners.map((b) => b.key))
  const others = await payload.find({ collection: 'banners', where: { active: { equals: true } }, limit: 50, depth: 0 })
  for (const o of others.docs.filter((d) => !keep.has(d.key as string))) {
    await payload.update({ collection: 'banners', id: o.id, data: { active: false }, overrideAccess: true })
    lines.push(`banner ${o.key}: deactivated (not on vh.ma)`)
  }

  const dossiers = s.dossiers.map((d, i) => ({
    title: d.title,
    body: d.body ?? '',
    image: media(d.image, `dossier ${i + 1}`),
    linkUrl: d.linkUrl,
    linkLabel: d.linkLabel.replace('‘', '’'),
  }))
  await payload.updateGlobal({ slug: 'homepage', data: { dossiers, chroniquesCigare: [] }, overrideAccess: true })
  lines.push(`homepage: ${dossiers.length} dossiers; Chroniques cigare automatic (vitoles-volutes)`)

  if (s.ogImage) {
    await payload.updateGlobal({ slug: 'site-settings', data: { defaultOgImage: media(s.ogImage, 'og:image') }, overrideAccess: true })
    lines.push(`site settings: default share image ${s.ogImage}`)
  }
  console.log(`homepage from vh.ma (surveyed ${s.fetchedAt}):\n  ${lines.join('\n  ')}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
