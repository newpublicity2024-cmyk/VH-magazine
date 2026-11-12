import { ArticleCard } from '@/components/ArticleCard'
import { InstagramCard } from '@/components/InstagramCard'
import { NewsletterForm } from '@/components/NewsletterForm'
import type { Article } from '@/payload-types'

/**
 * A listing page body (DESIGN-SPEC-R3 §5.3): page 1 opens with one `lead` card, then
 * every article is a `horizontal` row — 4:3 thumbnail, title, excerpt, date — separated
 * by hairlines; later pages are rows only. A sticky newsletter column sits beside it on
 * desktop. The column holds no article cards, so a listing's cards are exactly its
 * articles (gate G41 compares the two sets).
 */
export function Listing({ articles, page }: { articles: Article[]; page: number }) {
  const lead = page === 1 ? articles[0] : null
  const rows = lead ? articles.slice(1) : articles

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
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

      <aside aria-label="Colonne latérale" className="hidden lg:block">
        <div className="sticky top-[calc(var(--bar-height)+24px)] space-y-10">
          <NewsletterForm source="listing-sidebar" />
          <InstagramCard />
        </div>
      </aside>
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
