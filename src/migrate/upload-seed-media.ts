import { appendFileSync, existsSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { head, put } from '@vercel/blob'

/**
 * One-off, 2026-11-19 (user go-ahead): the production demo showed no images. Its database (the
 * seed, loaded into the Neon `production` branch from this Mac) names 47 images × 6 renditions,
 * but the seed ran without the Blob adapter, so the files stayed in this repo's local `media/`
 * folder and every Blob URL the deployed site generates answered 404.
 *
 *   BLOB_READ_WRITE_TOKEN=… pnpm tsx src/migrate/upload-seed-media.ts --dir <migration dir> [--dry-run]
 *
 * Uploads exactly the files production's media rows name, at those pathnames, the way Payload's
 * Blob adapter would (public, no random suffix, a year's cache). Before uploading anything:
 *   - every one of the 282 files must exist locally, and each original must have the byte size
 *     production's `media.filesize` records (measured with the Neon MCP, copied below);
 *   - nothing is overwritten: a pathname already in the store is left alone and reported.
 * Each upload is recorded in <dir>/manifests/seed-blob-uploads.jsonl, which blob-orphans.ts reads
 * as expected objects. When the archive replaces the seed (LAUNCH.md step 3), delete them from
 * that manifest.
 */

/** Production media rows (Neon production branch, 2026-11-19): original filename → filesize. */
const ORIGINALS: Record<string, number> = {
  'article-22e-edition-du-festival-de-marrakech-le-grand-retour-2.jpg': 12606,
  'article-40-millions-de-dollars-pour-une-ferrari-electrique-2.jpg': 9841,
  'article-arsene-wenger-en-vedette-du-challenge-leadership-show-2.jpg': 13510,
  'article-asif-el-mal-quand-le-football-rallume-les-reves-des-enfants-2.jpg': 12007,
  'article-carmen-maura-une-vie-de-cinema-2.jpg': 9386,
  'article-ce-que-pensent-les-hommes-2.jpg': 10052,
  'article-charles-leclerc-soffre-un-yacht-signe-riva-2.jpg': 10740,
  'article-collector-a-ne-pas-manquer-2.jpg': 9404,
  'article-elevations-silencieuses-investit-le-mandarin-oriental-2.jpg': 10028,
  'article-fifm-jour-2-les-maitres-du-cinema-se-confient-2.jpg': 11833,
  'article-ford-territory-loutsider-qui-vise-le-marche-marocain-2.jpg': 9540,
  'article-four-seasons-se-lance-dans-la-croisiere-de-luxe-2.jpg': 10387,
  'article-jaguar-type-01-le-pari-du-renouveau-2.jpg': 10286,
  'article-kimpton-marrakech-lhotel-qui-bouscule-la-medina-2.jpg': 10085,
  'article-la-theorie-du-complot-2.jpg': 7979,
  'article-le-ballon-de-la-main-de-dieu-mis-aux-encheres-a-londres-2.jpg': 10061,
  'article-le-luxe-2.jpg': 8324,
  'article-le-maroc-brille-parmi-les-finalistes-du-prix-du-design-de-lima-2028.jpg': 10238,
  'article-le-musee-de-la-memoire-de-casablanca-ouvre-ses-portes-2.jpg': 10842,
  'article-le-wydad-perd-lun-de-ses-presidents-historiques-2.jpg': 10514,
  'article-mahi-binebine-peindre-et-ecrire-le-maroc-2.jpg': 10137,
  'article-mohamed-mourabiti-latelier-comme-territoire-2.jpg': 11063,
  'article-porsche-licone-sous-pression-2.jpg': 8623,
  'article-rallye-de-la-marche-verte-laventure-au-feminin-2.jpg': 10995,
  'article-royal-mansour-tamuda-bay-le-nouveau-refuge-du-nord-2.jpg': 11755,
  'article-starlink-pret-a-embarquer-avec-royal-air-maroc-2.jpg': 12593,
  'article-un-maroc-epatant-dans-un-mondial-eclatant-2.jpg': 11129,
  'article-virginie-efira-parle-cinema-liberte-et-passion-2.jpg': 9857,
  'article-vitoles-volutes-accords-et-cigares-2.jpg': 9676,
  'article-vitoles-volutes-conserver-sans-trahir-2.jpg': 9816,
  'article-vitoles-volutes-lart-du-corona-2.jpg': 9143,
  'article-vitoles-volutes-le-robusto-roi-discret-2.jpg': 9863,
  'article-who-s-who-les-interviews-de-vh-2.jpg': 8873,
  'banner-collector-2.jpg': 8218,
  'banner-collector-sport-2.jpg': 9889,
  'banner-cool-drives-2.jpg': 11496,
  'banner-le-luxe-2.jpg': 5772,
  'banner-podcast-2.jpg': 8980,
  'banner-unes-2.jpg': 9417,
  'banner-whos-who-2.jpg': 10433,
  'cover-vh-206.jpg': 3976,
  'cover-vh-207.jpg': 4351,
  'cover-vh-208.jpg': 4378,
  'cover-vh-209.jpg': 4426,
  'dossier-ce-que-pensent-les-hommes-2.jpg': 12276,
  'dossier-un-maroc-epatant-dans-un-mondial-eclatant-2.jpg': 13372,
  'og-default-2.jpg': 9063,
}
/** The media collection's five size variants, named `<stem>-WxH.jpg` by Payload. */
const SIZES = ['1200x630', '1280x720', '160x160', '480x640', '640x360']
const CACHE_SECONDS = 60 * 60 * 24 * 365

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const dir = arg('dir')
  if (!dir) throw new Error('--dir is required')
  if (!process.env.BLOB_READ_WRITE_TOKEN?.startsWith('vercel_blob_rw_')) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  const dry = process.argv.includes('--dry-run')
  const local = path.resolve(import.meta.dirname, '..', '..', 'media')
  const manifest = path.join(dir, 'manifests', 'seed-blob-uploads.jsonl')

  const files: string[] = []
  for (const original of Object.keys(ORIGINALS)) {
    const stem = original.replace(/\.jpg$/, '')
    files.push(original, ...SIZES.map((s) => `${stem}-${s}.jpg`))
  }
  // Preconditions, all checked before the first upload.
  const problems: string[] = []
  for (const f of files) if (!existsSync(path.join(local, f))) problems.push(`missing locally: ${f}`)
  for (const [f, size] of Object.entries(ORIGINALS)) {
    if (existsSync(path.join(local, f)) && statSync(path.join(local, f)).size !== size) {
      problems.push(`${f}: local ${statSync(path.join(local, f)).size} B, production records ${size} B`)
    }
  }
  if (problems.length) throw new Error(`refusing to upload:\n  ${problems.join('\n  ')}`)
  console.log(`${files.length} files present locally; ${Object.keys(ORIGINALS).length} originals match production's sizes`)

  let uploaded = 0
  let present = 0
  for (const f of files) {
    const exists = await head(f).then(
      () => true,
      (e: Error) => {
        if (/not found|does not exist/i.test(e.message) || e.name === 'BlobNotFoundError') return false
        throw e
      },
    )
    if (exists) {
      present++
      console.log(`  already in the store, left alone: ${f}`)
      continue
    }
    if (dry) continue
    const body = readFileSync(path.join(local, f))
    const res = await put(f, body, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'image/jpeg',
      cacheControlMaxAge: CACHE_SECONDS,
    })
    appendFileSync(manifest, JSON.stringify({ pathname: res.pathname, size: body.length, at: new Date().toISOString() }) + '\n')
    uploaded++
  }
  console.log(`${dry ? 'dry run: would upload' : 'uploaded'} ${dry ? files.length - present : uploaded}, already present ${present}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
