import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArticleCard } from '@/components/ArticleCard'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Pagination } from '@/components/Pagination'
import { SectionHeader, SectionTitle } from '@/components/SectionHeader'
import { buildSafe } from '@/lib/build-safe'
import { getCategoryByPath, getCategoryPage, getSiteSettings } from '@/lib/queries'
import { PAGE_SIZE, STATIC_ROUTES, categoryUrl, pagedUrl } from '@/lib/routes'
import { buildMetadata, ogImageUrl } from '@/lib/seo'

/**
 * "Grand Angle" — the primary-nav destination (spec §4.2), at the live site's
 * own URL. On WordPress it is an Elementor hub (page 3975) over the grand-angle
 * category, whose articles live at /grand-angle/{slug}/ and, for its dossier
 * children, /grand-angle/{child}/{slug}/. Here it lists that whole tree, newest
 * first, paginated like a category page.
 *
 * The live page's hand-arranged dossier tiles are editorial content, not data;
 * they belong to the WordPress-pages migration, not to this route.
 */
export const revalidate = 900

const CATEGORY = 'grand-angle'
const TITLE = 'Grand Angle'
const DESCRIPTION = 'Enquêtes, dossiers et grands entretiens : le Grand Angle de VH Magazine.'

type Props = { searchParams: Promise<{ page?: string }> }

/** `?page=abc` and `?page=0` are page 1, not an error. */
function pageNumber(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 1 ? n : 1
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = pageNumber((await searchParams).page)
  const settings = await getSiteSettings().catch(() => null)
  return buildMetadata({
    title: page > 1 ? `${TITLE} — page ${page}` : TITLE,
    description: DESCRIPTION,
    // Same rider as category pages: page n canonicalises to itself.
    path: pagedUrl(STATIC_ROUTES.grandAngle, page),
    image: ogImageUrl(null, (settings?.defaultOgImage as { url?: string } | null) ?? null),
  })
}

export default async function GrandAnglePage({ searchParams }: Props) {
  const page = pageNumber((await searchParams).page)

  const [category, result] = await Promise.all([
    buildSafe(() => getCategoryByPath([CATEGORY]), null, STATIC_ROUTES.grandAngle),
    buildSafe(
      () => getCategoryPage(CATEGORY, page, PAGE_SIZE),
      { docs: [], totalDocs: 0, totalPages: 0, page },
      STATIC_ROUTES.grandAngle,
    ),
  ])

  // Beyond the end is a 404, never an empty indexable page.
  if (page > 1 && result.docs.length === 0) notFound()

  return (
    <div className="vh-container py-6">
      <Breadcrumbs
        items={[
          { label: 'Accueil', href: '/' },
          { label: TITLE, href: STATIC_ROUTES.grandAngle },
        ]}
      />

      <h1 className="sr-only">
        {TITLE} — les dossiers de VH Magazine
        {page > 1 ? ` — page ${page}` : ''}
      </h1>

      {category ? (
        <SectionHeader title={TITLE} href={categoryUrl(category as never)} moreLabel={null} />
      ) : (
        <SectionTitle title={TITLE} />
      )}

      <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-ink-soft/80">{DESCRIPTION}</p>

      {result.docs.length === 0 ? (
        <p className="mt-8 text-[14px] text-meta">Aucun dossier pour le moment.</p>
      ) : (
        <div
          data-category-grid
          className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {result.docs.map((article, i) => (
            <ArticleCard key={article.id} article={article} priority={page === 1 && i === 0} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(n) => pagedUrl(STATIC_ROUTES.grandAngle, n)}
      />
    </div>
  )
}
