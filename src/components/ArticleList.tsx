import { ArticleCard } from '@/components/ArticleCard'
import { SidebarWidget } from '@/components/SidebarWidget'
import type { Article } from '@/payload-types'

/**
 * The two sidebar lists — "Les plus lus" (§5.4.5) and "Derniers articles"
 * (§5.4.6). Same shape, different ordering, so one component with a title.
 */
export function ArticleList({
  title,
  widgetKey,
  articles,
}: {
  title: string
  widgetKey: string
  articles: Article[]
}) {
  return (
    <SidebarWidget title={title} widgetKey={widgetKey}>
      <ul className="space-y-4">
        {articles.map((article) => (
          <li key={article.id}>
            <ArticleCard article={article} variant="horizontal" />
          </li>
        ))}
      </ul>
    </SidebarWidget>
  )
}
