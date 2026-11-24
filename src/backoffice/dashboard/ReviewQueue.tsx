import type { WidgetServerProps } from 'payload'

import type { Article, User } from '@/payload-types'

import { ArticleRows } from './ArticleRows'
import { ARTICLES, Card, EmptyState, Icons, isEditorial, pendingWhere, whereHref } from './shared'

const LIMIT = 6

/**
 * Editors: « À relire » — what journalists have handed in, oldest submission first, because
 * the article that has waited longest is the one to open next.
 * Journalists: « En relecture » — what they have handed in and is not out yet.
 */
export default async function ReviewQueue({ req }: WidgetServerProps) {
  const { payload } = req
  const user = req.user as User | null
  if (!user) return null
  const editorial = isEditorial(user)
  const where = pendingWhere(user)

  const { docs, totalDocs } = await payload.find({
    collection: 'articles',
    draft: true,
    where,
    sort: editorial ? 'updatedAt' : '-updatedAt',
    limit: LIMIT,
    depth: 1,
    user,
    overrideAccess: false,
  })

  return (
    <Card
      id="vh-review"
      title={editorial ? 'À relire' : 'En relecture'}
      icon={<Icons.inbox />}
      action={
        totalDocs > 0 ? (
          <a className="vhb-link" href={whereHref(ARTICLES, where)}>
            Tout voir ({totalDocs})
          </a>
        ) : undefined
      }
    >
      {docs.length === 0 ? (
        <EmptyState
          title={editorial ? 'Rien à relire pour le moment' : 'Aucun article en relecture'}
          hint={
            editorial
              ? 'Les articles soumis par les journalistes apparaîtront ici.'
              : 'Quand un article est prêt, cliquez sur « Soumettre pour relecture » en haut de la page.'
          }
        />
      ) : (
        <ArticleRows
          rows={(docs as Article[]).map((article) => ({
            article,
            when: 'edited',
            showAuthor: editorial,
            actionLabel: editorial ? 'Relire' : 'Ouvrir',
          }))}
        />
      )}
    </Card>
  )
}
