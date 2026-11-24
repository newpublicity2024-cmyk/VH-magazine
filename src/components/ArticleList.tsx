import { ArticleCard } from '@/components/ArticleCard'
import { SidebarWidget } from '@/components/SidebarWidget'
import type { RankedArticle } from '@/lib/queries'

/**
 * The two sidebar lists — "Les plus lus" (§5.4.5, ranked, decision D8) and "Derniers
 * articles" (§5.4.6). A ranked list is an <ol>, so the order is conveyed to assistive
 * tech by the list itself and the big numerals can stay decorative.
 */
export function ArticleList({
  title,
  widgetKey,
  articles,
  ranked = false,
}: {
  title: string
  widgetKey: string
  articles: RankedArticle[]
  ranked?: boolean
}) {
  const List = ranked ? 'ol' : 'ul'
  return (
    <SidebarWidget title={title} widgetKey={widgetKey}>
      <List className="vh-rows">
        {articles.map((article, i) => (
          <li key={article.id} className="py-4 first:pt-0">
            {ranked ? (
              <ArticleCard article={article} variant="rank" rank={i + 1} href={article.href} />
            ) : (
              <ArticleCard article={article} variant="horizontal" href={article.href} />
            )}
          </li>
        ))}
      </List>
    </SidebarWidget>
  )
}
