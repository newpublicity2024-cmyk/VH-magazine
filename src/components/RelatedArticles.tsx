import { ArticleCard } from '@/components/ArticleCard'
import { SectionTitle } from '@/components/SectionHeader'
import type { Article } from '@/payload-types'

/** "Vous aimerez aussi" — vh.ma's name for it (spec §7 called it "Articles similaires"). Renders nothing when there is nothing to show. */
export function RelatedArticles({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null
  return (
    <section data-related className="mt-16" aria-labelledby="related-heading">
      <SectionTitle title="Vous aimerez aussi" id="related-heading" />
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  )
}
