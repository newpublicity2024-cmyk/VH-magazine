import type { WidgetServerProps } from 'payload'

import type { Article, User } from '@/payload-types'

import {
  Card,
  categoryNameOf,
  editHref,
  EmptyState,
  Icons,
  liveWhere,
  numberLabel,
  publicUrlOf,
  titleOf,
} from './shared'

const LIMIT = 8

/**
 * « Les plus lus »: the live articles with the most views, as a meter list (dataviz: several
 * values, one per named row, compared on one baseline — ranked bars in one hue, never a pie).
 * The figure is printed at the end of every row, so the bar is the comparison and the number
 * is the reading. Views come from /api/view, one per reader per article.
 */
export default async function Popular({ req }: WidgetServerProps) {
  const { payload } = req
  const user = req.user as User | null
  if (!user) return null

  const { docs } = await payload.find({
    collection: 'articles',
    where: { and: [liveWhere(user), { viewCount: { greater_than: 0 } }] },
    sort: '-viewCount',
    limit: LIMIT,
    depth: 2,
    user,
    overrideAccess: false,
  })
  const rows = docs as Article[]
  const max = rows[0]?.viewCount ?? 0

  return (
    <Card id="vh-popular" title="Les plus lus" icon={<Icons.flame />}>
      {rows.length === 0 ? (
        <EmptyState
          title="Pas encore de lectures"
          hint="Les articles les plus lus apparaîtront ici."
        />
      ) : (
        <ol className="vhb-meters">
          {rows.map((a) => {
            const url = publicUrlOf(a)
            const views = a.viewCount ?? 0
            return (
              <li key={a.id} className="vhb-meter" data-views={views}>
                <span className="vhb-meter__name">
                  <a href={editHref(a)}>{titleOf(a)}</a>
                  <span className="vhb-meter__meta">
                    {categoryNameOf(a)}
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Voir « ${titleOf(a)} » sur le site`}
                      >
                        <Icons.external />
                      </a>
                    )}
                  </span>
                </span>
                <span className="vhb-meter__track" aria-hidden="true">
                  <span
                    className="vhb-meter__fill"
                    style={{ width: `${max ? Math.max(2, (views / max) * 100) : 0}%` }}
                  />
                </span>
                <span className="vhb-meter__value">{numberLabel(views)} vues</span>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
