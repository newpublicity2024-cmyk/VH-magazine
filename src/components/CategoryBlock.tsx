import Link from 'next/link'

import { ArticleCard } from '@/components/ArticleCard'
import { SectionHeader } from '@/components/SectionHeader'
import type { Article } from '@/payload-types'

/**
 * SectionHeader + a grid of cards + "Voir plus" (spec §6.5).
 *
 * Powers the Actu, Lifestyle, Moteur, Vidéos and People blocks. The column
 * counts differ per block, so they are passed in rather than guessed: Actu and
 * friends are 2×2 inside the narrow main column, while Vidéos and People run
 * full width.
 */
export function CategoryBlock({
  title,
  href,
  articles,
  columns = 2,
  variant = 'default',
  sectionKey,
  priorityFirst = false,
  moreLabel = 'Voir plus',
}: {
  title: string
  href: string
  articles: Article[]
  columns?: 2 | 3 | 5
  variant?: 'default' | 'video'
  /** The data-section marker the ordering gate reads. */
  sectionKey: string
  priorityFirst?: boolean
  moreLabel?: string
}) {
  const grid = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }[columns]

  return (
    <section data-section={sectionKey} aria-labelledby={`${sectionKey}-heading`}>
      <div id={`${sectionKey}-heading`}>
        <SectionHeader title={title} href={href} moreLabel={null} />
      </div>

      <div className={`mt-4 grid gap-x-5 gap-y-6 ${grid}`}>
        {articles.map((article, index) => (
          <ArticleCard
            key={article.id}
            article={article}
            variant={variant}
            priority={priorityFirst && index === 0}
          />
        ))}
      </div>

      <div className="mt-4 flex justify-center">
        <Link
          href={href}
          className="border border-ink px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-white"
        >
          {moreLabel}
        </Link>
      </div>
    </section>
  )
}
