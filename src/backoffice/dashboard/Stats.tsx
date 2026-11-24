import type { Where, WidgetServerProps } from 'payload'

import type { User } from '@/payload-types'

import {
  ARTICLES,
  countLatest,
  countLive,
  draftsWhere,
  Icons,
  isEditorial,
  liveWhere,
  newsroomMidnight,
  numberLabel,
  pendingWhere,
  whereHref,
} from './shared'

type Tile = {
  key: string
  icon: React.ReactNode
  label: string
  hint: string
  where: Where
  /** Latest versions (work in progress) or live main rows (what readers see). */
  source: 'latest' | 'live'
  sort?: string
  /** Something waits for this reader: draw the eye when non-zero. */
  attention?: boolean
}

/**
 * A row of numbers that answer « where do I stand? », not « how big is the database ».
 * A journalist sees their own work, an editor the newsroom's — by access, not by filter.
 *
 * Each tile counts with one `Where` and links to the list with that same `Where`
 * (`whereHref`). « Work » tiles count latest versions, as the list view does; « live » tiles
 * count main rows, which is what « en ligne » means — the list shows those rows except any
 * whose newest version is an unpublished edit. One clock for the whole row.
 */
export default async function Stats({ req }: WidgetServerProps) {
  const { payload } = req
  const user = req.user as User | null
  if (!user) return null
  const editorial = isEditorial(user)
  const now = new Date()
  const today = newsroomMidnight(now, 0)
  const week = newsroomMidnight(now, 6)

  const defs: Tile[] = editorial
    ? [
        {
          key: 'pending',
          icon: <Icons.inbox />,
          label: 'À relire',
          hint: 'Soumis par les journalistes',
          where: pendingWhere(user),
          source: 'latest',
          attention: true,
        },
        {
          key: 'drafts',
          icon: <Icons.draft />,
          label: 'Brouillons de l’équipe',
          hint: 'En cours d’écriture',
          where: draftsWhere(user),
          source: 'latest',
        },
        {
          key: 'today',
          icon: <Icons.check />,
          label: 'Publiés aujourd’hui',
          hint: 'Depuis minuit (Casablanca)',
          where: liveWhere(user, today),
          source: 'live',
          sort: '-publishedAt',
        },
        {
          key: 'week',
          icon: <Icons.chart />,
          label: 'Publiés en 7 jours',
          hint: 'Aujourd’hui compris',
          where: liveWhere(user, week),
          source: 'live',
          sort: '-publishedAt',
        },
        {
          key: 'live',
          icon: <Icons.eye />,
          label: 'Articles en ligne',
          hint: 'Visibles par les lecteurs',
          where: liveWhere(user),
          source: 'live',
          sort: '-publishedAt',
        },
      ]
    : [
        {
          key: 'drafts',
          icon: <Icons.draft />,
          label: 'Mes brouillons',
          hint: 'En cours d’écriture',
          where: draftsWhere(user),
          source: 'latest',
        },
        {
          key: 'pending',
          icon: <Icons.inbox />,
          label: 'En relecture',
          hint: 'Soumis à la rédaction en chef',
          where: pendingWhere(user),
          source: 'latest',
          attention: true,
        },
        {
          key: 'week',
          icon: <Icons.chart />,
          label: 'Publiés en 7 jours',
          hint: 'Mes articles',
          where: liveWhere(user, week),
          source: 'live',
          sort: '-publishedAt',
        },
        {
          key: 'live',
          icon: <Icons.eye />,
          label: 'Mes articles en ligne',
          hint: 'Visibles par les lecteurs',
          where: liveWhere(user),
          source: 'live',
          sort: '-publishedAt',
        },
      ]

  const values = await Promise.all(
    defs.map((t) => (t.source === 'latest' ? countLatest : countLive)(payload, user, t.where)),
  )

  return (
    <section className="vhb-stats" data-widget="vh-stats" aria-label="Chiffres">
      {defs.map((t, i) => (
        <a
          key={t.key}
          className={`vhb-stat${t.attention && values[i] > 0 ? ' vhb-stat--attention' : ''}`}
          href={whereHref(ARTICLES, t.where, t.sort ? `sort=${t.sort}` : '')}
          data-stat={t.key}
          data-value={values[i]}
        >
          <span className="vhb-stat__icon">{t.icon}</span>
          <span className="vhb-stat__label">{t.label}</span>
          <strong className="vhb-stat__value">{numberLabel(values[i])}</strong>
          <span className="vhb-stat__hint">{t.hint}</span>
        </a>
      ))}
    </section>
  )
}
