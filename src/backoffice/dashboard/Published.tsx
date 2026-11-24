import type { WidgetServerProps } from 'payload'

import type { Article, User } from '@/payload-types'

import { ArticleRows } from './ArticleRows'
import { ARTICLES, Card, EmptyState, Icons, isEditorial, liveWhere, whereHref } from './shared'

const LIMIT = 6

/** What just went out — for a journalist, their own bylines — with a link to the live page. */
export default async function Published({ req }: WidgetServerProps) {
  const { payload } = req
  const user = req.user as User | null
  if (!user) return null
  const editorial = isEditorial(user)
  const where = liveWhere(user)

  const { docs } = await payload.find({
    collection: 'articles',
    where,
    sort: '-publishedAt',
    limit: LIMIT,
    depth: 2, // the category chain builds the public URL (lib/routes.ts)
    user,
    overrideAccess: false,
  })

  return (
    <Card
      id="vh-published"
      title={editorial ? 'Publiés récemment' : 'Mes derniers articles publiés'}
      icon={<Icons.check />}
      action={
        docs.length > 0 ? (
          <a className="vhb-link" href={whereHref(ARTICLES, where, 'sort=-publishedAt')}>
            Tout voir
          </a>
        ) : undefined
      }
    >
      {docs.length === 0 ? (
        <EmptyState
          title="Rien de publié pour l’instant"
          hint={
            editorial
              ? 'Les articles que vous publiez apparaîtront ici.'
              : 'Quand la rédaction en chef publie votre article, il apparaît ici avec son lien.'
          }
        />
      ) : (
        <ArticleRows
          viewLink
          rows={(docs as Article[]).map((article) => ({
            article,
            when: 'published',
            showAuthor: editorial,
            actionLabel: 'Modifier',
          }))}
        />
      )}
    </Card>
  )
}
