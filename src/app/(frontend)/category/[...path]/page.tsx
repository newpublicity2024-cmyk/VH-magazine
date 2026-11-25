import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Listing, ListingHeader } from '@/components/Listing'
import { Breadcrumbs, type Crumb } from '@/components/Breadcrumbs'
import { Pagination } from '@/components/Pagination'
import { WithSidebar } from '@/components/WithSidebar'
import { getCategoryByPath, getCategoryPage, getSiteSettings } from '@/lib/queries'
import { PAGE_SIZE, categoryPageUrl, categoryUrl } from '@/lib/routes'
import { buildMetadata, ogImageUrl } from '@/lib/seo'
import { vhHeadingForCategory } from '@/lib/vh-headings'
import type { Category } from '@/payload-types'

/** Listings change less often than the homepage (spec §9). */
export const revalidate = 900

type Props = {
  params: Promise<{ path: string[] }>
  searchParams: Promise<{ page?: string }>
}

/** `?page=abc` and `?page=0` are page 1, not an error. */
function pageNumber(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 1 ? n : 1
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ path }, sp] = await Promise.all([params, searchParams])
  const category = await getCategoryByPath(path)
  if (!category) return { title: 'Catégorie introuvable' }

  const page = pageNumber(sp.page)
  const settings = await getSiteSettings().catch(() => null)

  return buildMetadata({
    title: page > 1 ? `${category.name} — page ${page}` : category.name,
    description: category.description || `Tous les articles ${category.name} de VH Magazine.`,
    // Rider: a paginated page canonicalises to ITSELF, not to page 1. Pointing
    // every page at page 1 tells Google the deeper pages are duplicates and
    // de-indexes the articles that only appear on them.
    path: categoryPageUrl(category as never, page),
    image: ogImageUrl(null, (settings?.defaultOgImage as { url?: string } | null) ?? null),
  })
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ path }, sp] = await Promise.all([params, searchParams])

  const category = await getCategoryByPath(path)
  if (!category) notFound()

  const page = pageNumber(sp.page)
  const result = await getCategoryPage(category.slug as string, page, PAGE_SIZE)

  // A page beyond the end is a 404, not an empty listing: otherwise ?page=9999
  // is an infinite supply of thin, indexable, empty URLs.
  if (page > 1 && result.docs.length === 0) notFound()

  const chain: Category[] = []
  let node: unknown = category
  while (node && typeof node === 'object' && 'slug' in (node as Category)) {
    chain.unshift(node as Category)
    node = (node as Category).parent
  }

  const crumbs: Crumb[] = [
    { label: 'Accueil', href: '/' },
    ...chain.map((c) => ({ label: c.name, href: categoryUrl(c as never) })),
  ]

  return (
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs items={crumbs} />

      <ListingHeader title={category.name} page={page} vh={vhHeadingForCategory(category)}>
        {category.description ? (
          <p className="type-copy mt-4 max-w-[45rem] text-ink-2">{category.description}</p>
        ) : null}
      </ListingHeader>

      <WithSidebar place="listing">
        {result.docs.length === 0 ? (
          <p className="type-copy text-ink-2">Aucun article dans cette catégorie pour le moment.</p>
        ) : (
          <Listing articles={result.docs} page={page} />
        )}

        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          hrefFor={(n) => categoryPageUrl(category as never, n)}
        />
      </WithSidebar>
    </div>
  )
}
