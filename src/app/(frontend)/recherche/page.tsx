import Link from 'next/link'
import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Pagination } from '@/components/Pagination'
import { SectionTitle } from '@/components/SectionHeader'
import { formatDate, isoDate } from '@/lib/format'
import { STATIC_ROUTES, articleUrlFromPath, searchUrl } from '@/lib/routes'
import { searchArticles } from '@/lib/search'
import { buildMetadata } from '@/lib/seo'

/** Results depend entirely on the query string, so there is nothing to cache. */
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string; page?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams
  const term = (q || '').trim()
  return buildMetadata({
    title: term ? `Recherche : ${term}` : 'Recherche',
    description: 'Rechercher un article sur VH Magazine.',
    path: STATIC_ROUTES.recherche,
    // A results page must never be indexed: it is thin, infinite in variety,
    // and every crawled query string is a near-duplicate of the last.
    noIndex: true,
  })
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams
  const term = (sp.q || '').trim()
  const page = Number(sp.page) > 1 ? Number(sp.page) : 1

  const result = term
    ? await searchArticles(term, page)
    : { hits: [], total: 0, page: 1, totalPages: 0 }

  return (
    <div className="vh-container py-6">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Recherche', href: STATIC_ROUTES.recherche }]} />
      <h1 className="font-display text-2xl font-bold text-ink">Recherche</h1>

      <form role="search" action={STATIC_ROUTES.recherche} method="get" className="mt-5 max-w-xl">
        <label htmlFor="vh-q" className="sr-only">Rechercher un article</label>
        <div className="flex">
          <input
            id="vh-q"
            name="q"
            type="search"
            defaultValue={term}
            placeholder="Rechercher…"
            className="w-full border border-rule px-3 py-2.5 text-[14px] outline-none focus:border-ink"
          />
          <button
            type="submit"
            className="shrink-0 bg-ink px-5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-vh-red"
          >
            Chercher
          </button>
        </div>
      </form>

      {term ? (
        <p data-search-summary className="mt-5 text-[13px] text-meta">
          {result.total === 0
            ? `Aucun résultat pour « ${term} ».`
            : `${result.total} résultat${result.total > 1 ? 's' : ''} pour « ${term} ».`}
        </p>
      ) : null}

      {result.hits.length > 0 ? (
        <>
          <div className="mt-6">
            <SectionTitle title="Résultats" />
          </div>
          <ul data-search-results className="divide-y divide-rule border-y border-rule">
            {result.hits.map((hit) => {
              // Rebuild the nested path from the joined parent/child slugs so a
              // result links to the same URL the article route serves.
              const path = [hit.parent_slug, hit.category_slug].filter(Boolean).join('/')
              const href = articleUrlFromPath(path, hit.slug)
              return (
                <li key={hit.id} className="py-4">
                  <h2 className="text-[16px] font-semibold leading-snug text-ink">
                    <Link href={href} className="transition-colors hover:text-vh-red">{hit.title}</Link>
                  </h2>
                  {hit.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-[13px] text-ink-soft/80">{hit.excerpt}</p>
                  ) : null}
                  <time data-date dateTime={isoDate(hit.published_at)} className="mt-1 block text-[11px] text-meta">
                    {formatDate(hit.published_at)}
                  </time>
                </li>
              )
            })}
          </ul>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            hrefFor={(n) => searchUrl(term, n)}
          />
        </>
      ) : null}
    </div>
  )
}
