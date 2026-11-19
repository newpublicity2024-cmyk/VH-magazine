import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

import { ArticleCard } from '@/components/ArticleCard'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Pagination } from '@/components/Pagination'
import { SectionTitle } from '@/components/SectionHeader'
import { formatDate, isoDate } from '@/lib/format'
import { STATIC_ROUTES, articleUrlFromPath, searchUrl } from '@/lib/routes'
import { getLatestArticles } from '@/lib/queries'
import { searchArticles } from '@/lib/search'
import { typoFr } from '@/lib/typo-fr'
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

  // No result (or no query yet): offer the latest articles rather than a dead end.
  const latest = result.hits.length === 0 ? await getLatestArticles(6).catch(() => []) : []

  return (
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Recherche', href: STATIC_ROUTES.recherche }]} />

      <header className="mx-auto max-w-[45rem]">
        <h1 className="type-h1-page text-ink">Recherche</h1>
        <form role="search" action={STATIC_ROUTES.recherche} method="get" className="mt-6 flex gap-2">
          <label htmlFor="vh-q" className="sr-only">
            Rechercher un article
          </label>
          <input
            id="vh-q"
            name="q"
            type="search"
            defaultValue={term}
            placeholder="Rechercher un article…"
            className="vh-input type-search min-h-14"
          />
          <button type="submit" className="vh-button-solid type-button min-h-14 shrink-0">
            Chercher
          </button>
        </form>

        {term ? (
          <p data-search-summary className="type-copy mt-6 text-ink-2">
            {result.total === 0
              ? `Aucun résultat pour « ${term} ».`
              : `${result.total} résultat${result.total > 1 ? 's' : ''} pour « ${term} ».`}
          </p>
        ) : null}
      </header>

      {result.hits.length > 0 ? (
        <div className="mx-auto mt-10 max-w-[45rem]">
          <ul data-search-results className="vh-rows">
            {result.hits.map((hit) => {
              // Rebuild the nested path from the joined parent/child slugs so a result
              // links to the same URL the article route serves.
              const path = [hit.parent_slug, hit.category_slug].filter(Boolean).join('/')
              const href = articleUrlFromPath(path, hit.slug)
              return (
                <li key={hit.id} className="vh-card flex gap-4 py-6 sm:gap-6">
                  <div className="vh-card-media aspect-[4/3] w-28 shrink-0 sm:w-40">
                    {hit.thumb_url ? (
                      <Image
                        src={hit.thumb_url}
                        alt=""
                        width={160}
                        height={160}
                        sizes="160px"
                        loading="lazy"
                        data-fade
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {hit.category_name ? (
                      <p className="type-kicker mb-2 text-accent">{hit.category_name}</p>
                    ) : null}
                    <h2 className="type-title text-ink">
                      <Link href={href} className="vh-card-link">
                        {typoFr(hit.title)}
                      </Link>
                    </h2>
                    {hit.excerpt || hit.snippet ? (
                      <p className="type-copy vh-clamp-2 mt-2 hidden text-ink-2 sm:block">
                        {typoFr((hit.excerpt || hit.snippet) as string)}
                      </p>
                    ) : null}
                    <time data-date dateTime={isoDate(hit.published_at)} className="type-meta mt-3 block text-meta">
                      {formatDate(hit.published_at)}
                    </time>
                  </div>
                </li>
              )
            })}
          </ul>
          <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(n) => searchUrl(term, n)} />
        </div>
      ) : latest.length > 0 ? (
        <section className="mt-16" aria-labelledby="latest-heading">
          <SectionTitle title="Derniers articles" id="latest-heading" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((a) => (
              <ArticleCard key={a.id} article={a} kicker />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
