import { ArticleCard } from '@/components/ArticleCard'
import { SectionHeader } from '@/components/SectionHeader'
import type { VhHeading } from '@/lib/vh-headings'
import type { Article } from '@/payload-types'

/**
 * A listing page body (DESIGN-SPEC-R3 §5.3): page 1 opens with one `lead` card, then
 * every article is a `horizontal` row — 4:3 thumbnail, title, excerpt, date — separated
 * by hairlines; later pages are rows only. It is the main column only: the page sets it
 * beside the side panel (WithSidebar), whose lists are cards too — gates compare a
 * listing's articles with the cards inside `[data-category-grid]`, never the whole page.
 */
export function Listing({ articles, page }: { articles: Article[]; page: number }) {
  const lead = page === 1 ? articles[0] : null
  const rows = lead ? articles.slice(1) : articles

  return (
    <div data-category-grid className="vh-rows">
      {lead ? (
        <div className="pb-8">
          <ArticleCard article={lead} variant="lead" priority />
        </div>
      ) : null}
      {rows.map((article, i) => (
        <div key={article.id} className="py-6">
          <ArticleCard
            article={article}
            variant="horizontal"
            size="lg"
            excerpt
            priority={!lead && i === 0}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * The listing header (DESIGN-SPEC-R3 §5.3): page title over VH's heavy rule — or, for the
 * sections vh.ma heads with a "VH ___" banner (lib/vh-headings.ts), that heading as the h1.
 */
export function ListingHeader({
  title,
  page,
  vh,
  children,
}: {
  title: string
  page: number
  vh?: VhHeading | null
  children?: React.ReactNode
}) {
  return (
    <header className="mb-10">
      {vh ? (
        <SectionHeader as="h1" word={vh.word} strip={vh.strip} suffix={page > 1 ? `— page ${page}` : null} />
      ) : (
        <div className="vh-label-rule">
          <h1 className="type-h1-page text-ink">
            {title}
            {page > 1 ? <span className="text-meta"> — page {page}</span> : null}
          </h1>
        </div>
      )}
      {children}
    </header>
  )
}
