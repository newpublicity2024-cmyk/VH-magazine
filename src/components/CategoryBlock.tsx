import Link from 'next/link'

import { ArticleCard } from '@/components/ArticleCard'
import { SectionHeader } from '@/components/SectionHeader'
import type { Article } from '@/payload-types'

/**
 * SectionHeader + a grid of cards + "Voir plus" (spec §6.5, DESIGN-SPEC-R3 §4.5–4.6, §5.1).
 *
 * `layout="lead"` opens with one `lead` card across the block and the rest in a row of
 * three (Actu); `tone="dark"` paints the section black edge to edge with its own
 * container (Vidéos and People, decision D5). Column counts are passed in, not guessed.
 */
export function CategoryBlock({
  title,
  href,
  articles,
  columns = 2,
  variant = 'default',
  layout = 'grid',
  tone = 'light',
  sectionKey,
  priorityFirst = false,
  moreLabel = 'Voir plus',
}: {
  title: string
  href: string
  articles: Article[]
  columns?: 2 | 3 | 5
  variant?: 'default' | 'video'
  layout?: 'grid' | 'lead'
  tone?: 'light' | 'dark'
  /** The data-section marker the ordering gate reads. */
  sectionKey: string
  priorityFirst?: boolean
  moreLabel?: string
}) {
  const dark = tone === 'dark'
  const grid = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }[columns]
  const [first, ...rest] = articles

  const body = (
    <>
      <SectionHeader title={title} href={href} id={`${sectionKey}-heading`} />

      {layout === 'lead' && first ? (
        <div className="mt-6">
          <ArticleCard article={first} variant="lead" priority={priorityFirst} tone={tone} />
          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-3">
            {rest.map((article) => (
              <ArticleCard key={article.id} article={article} tone={tone} />
            ))}
          </div>
        </div>
      ) : (
        <div className={`mt-6 grid gap-x-4 gap-y-8 sm:gap-x-6 ${grid}`}>
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              variant={variant}
              tone={tone}
              priority={priorityFirst && index === 0}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <Link data-button href={href} className="vh-button type-button">
          {moreLabel}
        </Link>
      </div>
    </>
  )

  return dark ? (
    <section data-section={sectionKey} data-tone="dark" aria-labelledby={`${sectionKey}-heading`} className="vh-dark">
      <div className="vh-container">{body}</div>
    </section>
  ) : (
    <section data-section={sectionKey} aria-labelledby={`${sectionKey}-heading`}>
      {body}
    </section>
  )
}
