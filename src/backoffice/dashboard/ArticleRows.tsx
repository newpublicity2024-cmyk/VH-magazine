import type { Article } from '@/payload-types'

import {
  authorNameOf,
  categoryNameOf,
  editHref,
  Icons,
  publicUrlOf,
  relativeTime,
  titleOf,
  dateTimeLabel,
} from './shared'

type Row = {
  article: Article
  /** What the date in the row means. */
  when: 'edited' | 'published'
  showAuthor: boolean
  actionLabel: string
  /** A live article with newer unpublished changes. */
  pendingChanges?: boolean
}

/**
 * One list of articles, the same shape in every widget: the title is the link into the
 * editor, the meta line says who / where / when, and one button names the next action.
 */
export function ArticleRows({ rows, viewLink }: { rows: Row[]; viewLink?: boolean }) {
  return (
    <ul className="vhb-rows">
      {rows.map(({ article, when, showAuthor, actionLabel, pendingChanges }) => {
        const category = categoryNameOf(article)
        const author = showAuthor ? authorNameOf(article) : null
        const url = viewLink ? publicUrlOf(article) : null
        return (
          <li key={article.id} className="vhb-row">
            <div className="vhb-row__main">
              <a
                className={`vhb-row__title${article.title?.trim() ? '' : ' vhb-row__title--untitled'}`}
                href={editHref(article)}
              >
                {titleOf(article)}
              </a>
              <span className="vhb-row__meta">
                {author && <span>{author}</span>}
                {category && <span className="vhb-chip">{category}</span>}
                {pendingChanges && (
                  <span className="vhb-chip vhb-chip--warm">Modifications non publiées</span>
                )}
                <span>
                  {when === 'published'
                    ? `Publié le ${dateTimeLabel(article.publishedAt)}`
                    : `Modifié ${relativeTime(article.updatedAt)}`}
                </span>
              </span>
            </div>
            <span className="vhb-row__actions">
              {url && (
                <a className="vhb-btn vhb-btn--ghost" href={url} target="_blank" rel="noreferrer">
                  <Icons.external />
                  Voir
                </a>
              )}
              <a className="vhb-btn vhb-btn--soft" href={editHref(article)}>
                {actionLabel}
              </a>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
