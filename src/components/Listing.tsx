import { ArticleCard } from '@/components/ArticleCard'
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

/** The listing header (DESIGN-SPEC-R3 §5.3): page title over VH's heavy rule. */
export function ListingHeader({ title, page, children }: { title: string; page: number; children?: React.ReactNode }) {
  return (
    <header className="mb-10">
      <div className="vh-label-rule">
        <h1 className="type-h1-page text-ink">
          {title}
          {page > 1 ? <span className="text-meta"> — page {page}</span> : null}
        </h1>
      </div>
      {children}
    </header>
  )
}
