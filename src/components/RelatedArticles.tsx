import { ArticleCard } from '@/components/ArticleCard'
import { SectionTitle } from '@/components/SectionHeader'
import type { Article } from '@/payload-types'

/** "Articles similaires" (spec §7). Renders nothing when there is nothing to show. */
export function RelatedArticles({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null
  return (
    <section data-related className="mt-12" aria-labelledby="related-heading">
      <div id="related-heading">
        <SectionTitle title="Articles similaires" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  )
}
