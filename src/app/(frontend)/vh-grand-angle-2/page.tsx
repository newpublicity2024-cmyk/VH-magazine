import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Listing, ListingHeader } from '@/components/Listing'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Pagination } from '@/components/Pagination'
import { WithSidebar } from '@/components/WithSidebar'
import { buildSafe } from '@/lib/build-safe'
import { getCategoryByPath, getCategoryPage, getGrandAngleDossiers, getSiteSettings } from '@/lib/queries'
import { PAGE_SIZE, STATIC_ROUTES, categoryUrl, pagedUrl } from '@/lib/routes'
import { buildMetadata, ogImageUrl } from '@/lib/seo'
import { GRAND_ANGLE_HEADING } from '@/lib/vh-headings'

/**
 * "Grand Angle" — the primary-nav destination (spec §4.2), at the live site's
 * own URL. On WordPress it is an Elementor hub (page 3975) over the grand-angle
 * category, whose articles live at /grand-angle/{slug}/ and, for its dossier
 * children, /grand-angle/{child}/{slug}/. Here it lists that whole tree, newest
 * first, paginated like a category page.
 *
 * The live page is hand-arranged: a curated run of dossiers, not the category's latest
 * posts. Since the parity pass (2026-11-24) that run is the `grand-angle` global, imported
 * from vh.ma; this route shows it, in order, on one page. Not curated → the category tree,
 * newest first, paginated like a category page.
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

  const [category, curated, listing] = await Promise.all([
    buildSafe(() => getCategoryByPath([CATEGORY]), null, STATIC_ROUTES.grandAngle),
    buildSafe(() => getGrandAngleDossiers(), [], STATIC_ROUTES.grandAngle),
    buildSafe(
      () => getCategoryPage(CATEGORY, page, PAGE_SIZE),
      { docs: [], totalDocs: 0, totalPages: 0, page },
      STATIC_ROUTES.grandAngle,
    ),
  ])
  // The curated run is a single page, as on vh.ma.
  const result = curated.length ? { docs: curated, totalDocs: curated.length, totalPages: 1, page: 1 } : listing

  // Beyond the end is a 404, never an empty indexable page (the curated run has one page).
  if (page > 1 && (curated.length > 0 || result.docs.length === 0)) notFound()

  return (
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs
        items={[
          { label: 'Accueil', href: '/' },
          { label: TITLE, href: STATIC_ROUTES.grandAngle },
        ]}
      />

      <ListingHeader title={TITLE} page={page} vh={GRAND_ANGLE_HEADING}>
        <p className="type-copy mt-4 max-w-[45rem] text-ink-2">{DESCRIPTION}</p>
        {category ? (
          <p className="type-copy-sm mt-3">
            <Link href={categoryUrl(category as never)} className="vh-text-link">
              Toutes les archives de la catégorie Grand Angle ›
            </Link>
          </p>
        ) : null}
      </ListingHeader>

      <WithSidebar place="listing">
        {result.docs.length === 0 ? (
          <p className="type-copy text-ink-2">Aucun dossier pour le moment.</p>
        ) : (
          <Listing articles={result.docs} page={page} />
        )}

        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          hrefFor={(n) => pagedUrl(STATIC_ROUTES.grandAngle, n)}
        />
      </WithSidebar>
    </div>
  )
}
