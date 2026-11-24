import type { WidgetServerProps } from 'payload'

import type { Article, User } from '@/payload-types'

import { ArticleRows } from './ArticleRows'
import { ARTICLES, Card, draftsWhere, EmptyState, Icons, isEditorial, whereHref } from './shared'

const LIMIT = 6

/**
 * Journalists: « Mes brouillons » — pick up where you left off.
 * Editors: « Brouillons de l'équipe » — what is being written (not yet handed in).
 *
 * A draft can also be an unpublished EDIT of a live article (Payload keeps the live main row
 * and the newer draft version side by side). Those are marked, the WordPress way, so nobody
 * mistakes a live piece for an unpublished one.
 */
export default async function Drafts({ req }: WidgetServerProps) {
  const { payload } = req
  const user = req.user as User | null
  if (!user) return null
  const editorial = isEditorial(user)
  const where = draftsWhere(user)

  const { docs, totalDocs } = await payload.find({
    collection: 'articles',
    draft: true,
    where,
    sort: '-updatedAt',
    limit: LIMIT,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const drafts = docs as Article[]

  // Which of these are live already? Main rows only — no `draft`.
  const liveIds = new Set<number | string>()
  if (drafts.length) {
    const live = await payload.find({
      collection: 'articles',
      where: {
        and: [{ id: { in: drafts.map((d) => d.id) } }, { _status: { equals: 'published' } }],
      },
      limit: LIMIT,
      depth: 0,
      select: { title: true },
      user,
      overrideAccess: false,
    })
    for (const d of live.docs) liveIds.add(d.id)
  }

  return (
    <Card
      id="vh-drafts"
      title={editorial ? 'Brouillons de l’équipe' : 'Mes brouillons'}
      icon={<Icons.draft />}
      action={
        totalDocs > 0 ? (
          <a className="vhb-link" href={whereHref(ARTICLES, where, 'sort=-updatedAt')}>
            Tout voir ({totalDocs})
          </a>
        ) : undefined
      }
    >
      {drafts.length === 0 ? (
        <EmptyState
          title={editorial ? 'Aucun brouillon en cours' : 'Aucun brouillon'}
          hint={
            editorial
              ? 'Les articles en cours d’écriture apparaîtront ici.'
              : 'Commencez un article : il s’enregistre tout seul et vous le retrouverez ici.'
          }
          action={
            editorial ? undefined : (
              <a className="vhb-btn vhb-btn--primary" href={`${ARTICLES}/create`}>
                <Icons.pen />
                Écrire un article
              </a>
            )
          }
        />
      ) : (
        <ArticleRows
          rows={drafts.map((article) => ({
            article,
            when: 'edited',
            showAuthor: editorial,
            actionLabel: editorial ? 'Ouvrir' : 'Continuer',
            pendingChanges: liveIds.has(article.id),
          }))}
        />
      )}
    </Card>
  )
}
