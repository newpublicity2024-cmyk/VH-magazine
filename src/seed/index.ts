import 'dotenv/config'
import { getPayload } from 'payload'
import type { Payload } from 'payload'

import config from '../payload.config'
import { slugify } from '../fields/slug'
import { ARTICLES, BANNERS, CATEGORIES, DOSSIERS, ISSUES } from './content'
import { articleImage, bannerImage, coverImage } from './placeholder'

/**
 * Seed the local database with the spec §5 homepage content.
 *
 * Idempotent by design: every upsert keys on a natural unique field (category
 * slug, article slug, issue number, banner key), so running it twice changes
 * nothing and re-running after an edit repairs rather than duplicates. That
 * matters because the gates run against seeded data — a seed that drifted on
 * each invocation would make the count gates flap.
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@vh.ma'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'vhmagazine'

/** DD/MM/YYYY (as published on vh.ma) → ISO 8601. */
function toIso(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/')
  return new Date(`${y}-${m}-${d}T09:00:00.000Z`).toISOString()
}

/** Minimal Lexical document — the body is not what this round renders. */
function lexicalBody(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        format: '' as const,
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        children: [{ type: 'text', text, format: 0, style: '', detail: 0, mode: 'normal', version: 1 }],
      })),
    },
  }
}

async function upsertMedia(
  payload: Payload,
  filename: string,
  alt: string,
  // Lazy: rendering a placeholder costs ~200ms in sharp, and re-seeding an
  // already-populated database would otherwise redo ~45 of them for nothing.
  // The generator only runs on an actual miss.
  makeBuffer: () => Promise<Buffer>,
): Promise<number> {
  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
  })
  if (existing.docs.length > 0) return existing.docs[0].id as number

  const buffer = await makeBuffer()
  const doc = await payload.create({
    collection: 'media',
    data: { alt },
    file: {
      data: buffer,
      mimetype: 'image/jpeg',
      name: filename,
      size: buffer.length,
    },
  })
  return doc.id as number
}

async function run() {
  const payload = await getPayload({ config })
  const log = (m: string) => console.log(`  ${m}`)

  // ── Admin user ──────────────────────────────────────────────────────────
  const existingAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: ADMIN_EMAIL } },
    limit: 1,
  })
  if (existingAdmin.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Administrateur', role: 'admin' },
    })
    log(`admin created: ${ADMIN_EMAIL}`)
  } else {
    log(`admin exists: ${ADMIN_EMAIL}`)
  }

  // ── Categories (parents first, so children can resolve their parent) ────
  const categoryIds = new Map<string, number>()
  const ordered = [...CATEGORIES].sort((a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)))

  for (const cat of ordered) {
    const found = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })
    const data = {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      parent: cat.parent ? categoryIds.get(cat.parent) : undefined,
    }
    if (found.docs.length > 0) {
      const doc = await payload.update({
        collection: 'categories',
        id: found.docs[0].id,
        data,
      })
      categoryIds.set(cat.slug, doc.id as number)
    } else {
      const doc = await payload.create({ collection: 'categories', data })
      categoryIds.set(cat.slug, doc.id as number)
    }
  }
  log(`categories: ${categoryIds.size}`)

  // ── Articles ────────────────────────────────────────────────────────────
  let created = 0
  let updated = 0

  for (const art of ARTICLES) {
    const slug = art.slug || slugify(art.title)
    const categoryId = categoryIds.get(art.category)
    if (!categoryId) throw new Error(`article "${art.title}" references unknown category ${art.category}`)

    const imageId = await upsertMedia(
      payload,
      `article-${slug}.jpg`,
      art.title,
      () => articleImage(slug, art.title),
    )

    const data = {
      title: art.title,
      slug,
      excerpt: art.excerpt,
      category: categoryId,
      featuredImage: imageId,
      publishedAt: toIso(art.date),
      viewCount: art.views,
      isVideo: Boolean(art.isVideo),
      videoUrl: art.videoUrl,
      body: lexicalBody([art.excerpt, 'Contenu de démonstration — le corps réel arrivera avec la migration.']),
      _status: 'published' as const,
    }

    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: slug } },
      limit: 1,
    })

    if (found.docs.length > 0) {
      await payload.update({
        collection: 'articles',
        id: found.docs[0].id,
        data,
        // Seeding must never manufacture redirects: the hook would see a
        // published doc changing and record a rename that never happened.
        context: { skipRedirects: true },
      })
      updated += 1
    } else {
      await payload.create({ collection: 'articles', data, context: { skipRedirects: true } })
      created += 1
    }
  }
  log(`articles: ${created} created, ${updated} updated`)

  // A permanent DRAFT article. It exists so the sitemap gate has something real
  // to prove absent: without it, "no drafts in the sitemap" would pass on a
  // database that simply contains no drafts.
  {
    const draftSlug = 'brouillon-controle-sitemap'
    const moteurId = categoryIds.get('moteur')
    const anyMedia = await payload.find({ collection: 'media', limit: 1 })
    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: draftSlug } },
      limit: 1,
      draft: true,
    })
    if (found.docs.length === 0 && moteurId && anyMedia.docs.length > 0) {
      await payload.create({
        collection: 'articles',
        data: {
          title: 'Brouillon — contrôle sitemap',
          slug: draftSlug,
          excerpt: 'Article non publié, utilisé comme contrôle négatif par la gate G31.',
          category: moteurId,
          featuredImage: anyMedia.docs[0].id,
          publishedAt: new Date().toISOString(),
          _status: 'draft',
        },
        context: { skipRedirects: true },
      })
      log('draft control article created (G31)')
    }
  }

  // ── Magazine issues ─────────────────────────────────────────────────────
  for (const issue of ISSUES) {
    const slug = `vh-${issue.number}`
    const coverId = await upsertMedia(
      payload,
      `cover-${slug}.jpg`,
      `Couverture ${issue.title}`,
      () => coverImage(slug, `VH N°${issue.number}`),
    )
    const data = {
      number: issue.number,
      title: issue.title,
      slug,
      cover: coverId,
      summary: issue.summary,
      publishedAt: toIso(issue.date),
    }
    const found = await payload.find({
      collection: 'magazine-issues',
      where: { number: { equals: issue.number } },
      limit: 1,
    })
    if (found.docs.length > 0) {
      await payload.update({ collection: 'magazine-issues', id: found.docs[0].id, data })
    } else {
      await payload.create({ collection: 'magazine-issues', data })
    }
  }
  log(`magazine issues: ${ISSUES.length}`)

  // ── Banners ─────────────────────────────────────────────────────────────
  for (const banner of BANNERS) {
    const imageId = await upsertMedia(
      payload,
      `banner-${banner.key}.jpg`,
      banner.title,
      () => bannerImage(banner.key, banner.title),
    )
    const data = {
      key: banner.key as never,
      title: banner.title,
      image: imageId,
      linkUrl: banner.linkUrl,
      body: banner.body,
      active: true,
    }
    const found = await payload.find({
      collection: 'banners',
      where: { key: { equals: banner.key } },
      limit: 1,
    })
    if (found.docs.length > 0) {
      await payload.update({ collection: 'banners', id: found.docs[0].id, data })
    } else {
      await payload.create({ collection: 'banners', data })
    }
  }
  log(`banners: ${BANNERS.length}`)

  // ── Globals: curated homepage slots ─────────────────────────────────────
  const cigars = await payload.find({
    collection: 'articles',
    where: { 'category.slug': { equals: 'vitoles-volutes' } },
    sort: '-publishedAt',
    limit: 5,
    depth: 0,
  })

  const dossierRows = []
  for (const d of DOSSIERS) {
    const imageId = await upsertMedia(
      payload,
      `dossier-${slugify(d.title)}.jpg`,
      d.title,
      () => bannerImage(slugify(d.title), d.title),
    )
    dossierRows.push({ ...d, image: imageId })
  }

  await payload.updateGlobal({
    slug: 'homepage',
    data: {
      chroniquesCigare: cigars.docs.map((d) => d.id),
      dossiers: dossierRows,
    },
  })
  log(`homepage global: ${cigars.docs.length} chroniques, ${dossierRows.length} dossiers`)

  const ogId = await upsertMedia(
    payload,
    'og-default.jpg',
    'VH Magazine',
    () => bannerImage('og-default', 'VH Magazine — Art de vivre'),
  )
  await payload.updateGlobal({ slug: 'site-settings', data: { defaultOgImage: ogId } })
  log('site settings: default OG image set')

  console.log('\nSeed complete.')
  process.exit(0)
}

run().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
