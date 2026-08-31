import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArticleCard } from '@/components/ArticleCard'
import { Breadcrumbs, type Crumb } from '@/components/Breadcrumbs'
import { Pagination } from '@/components/Pagination'
import { SectionHeader } from '@/components/SectionHeader'
import { getCategoryByPath, getCategoryPage, getSiteSettings } from '@/lib/queries'
import { PAGE_SIZE, categoryPageUrl, categoryUrl } from '@/lib/routes'
import { buildMetadata, ogImageUrl } from '@/lib/seo'
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
    <div className="vh-container py-6">
      <Breadcrumbs items={crumbs} />

      <h1 className="sr-only">
        {category.name}
        {page > 1 ? ` — page ${page}` : ''}
      </h1>

      <SectionHeader title={category.name} href={categoryUrl(category as never)} moreLabel={null} />

      {category.description ? (
        <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-ink-soft/80">
          {category.description}
        </p>
      ) : null}

      {result.docs.length === 0 ? (
        <p className="mt-8 text-[14px] text-meta">Aucun article dans cette catégorie pour le moment.</p>
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
        hrefFor={(n) => categoryPageUrl(category as never, n)}
      />
    </div>
  )
}
