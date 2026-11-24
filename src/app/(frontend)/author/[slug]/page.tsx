import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Listing, ListingHeader } from '@/components/Listing'
import { Pagination } from '@/components/Pagination'
import { getAuthorBySlug, getAuthorPage, getSiteSettings } from '@/lib/queries'
import { PAGE_SIZE, authorUrl, pagedUrl } from '@/lib/routes'
import { buildMetadata, ogImageUrl } from '@/lib/seo'
import { typoFr } from '@/lib/typo-fr'

/**
 * A byline's archive at vh.ma's own URL, /author/<slug>/ (parity pass 2026-11-24): the articles
 * it signs, newest first, 14 a page like a category — WordPress's /author/<slug>/page/N/ is 301ed
 * to ?page=N by the proxy.
 */
export const revalidate = 900

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

/** `?page=abc` and `?page=0` are page 1, not an error. */
function pageNumber(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 1 ? n : 1
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const author = await getAuthorBySlug(decodeURIComponent(slug))
  if (!author) return { title: 'Signature introuvable' }
  const page = pageNumber(sp.page)
  const settings = await getSiteSettings().catch(() => null)
  return buildMetadata({
    title: page > 1 ? `${author.name} — page ${page}` : author.name,
    description: `Les articles signés ${author.name} dans VH Magazine.`,
    path: pagedUrl(authorUrl(author), page),
    image: ogImageUrl(null, (settings?.defaultOgImage as { url?: string } | null) ?? null),
  })
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const author = await getAuthorBySlug(decodeURIComponent(slug))
  if (!author) notFound()
  const page = pageNumber(sp.page)
  const result = await getAuthorPage(author.id as number, page, PAGE_SIZE)
  // Beyond the end is a 404, never an empty indexable page.
  if (page > 1 && result.docs.length === 0) notFound()

  return (
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs
        items={[
          { label: 'Accueil', href: '/' },
          { label: author.name, href: authorUrl(author) },
        ]}
      />
      <ListingHeader title={typoFr(author.name)} page={page}>
        <p className="type-copy mt-4 max-w-[45rem] text-ink-2">
          {typoFr(`${result.totalDocs} article${result.totalDocs > 1 ? 's' : ''} signé${result.totalDocs > 1 ? 's' : ''} ${author.name}.`)}
        </p>
      </ListingHeader>
      {result.docs.length === 0 ? (
        <p className="type-copy text-ink-2">Aucun article signé pour le moment.</p>
      ) : (
        <Listing articles={result.docs} page={page} />
      )}
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(n) => pagedUrl(authorUrl(author), n)} />
    </div>
  )
}
