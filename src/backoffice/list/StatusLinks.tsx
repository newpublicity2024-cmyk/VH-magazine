import type { Payload, PayloadRequest, Where } from 'payload'

import type { User } from '@/payload-types'

type Props = {
  payload: Payload
  user?: PayloadRequest['user']
  searchParams?: Record<string, string | string[] | undefined>
}

const BASE = '/admin/collections/articles'

type Link = { key: string; label: string; where: Where | null }

/** Serialise a Where the way the list view's query string carries it (qs brackets). */
function query(where: Where | null): string {
  if (!where) return BASE
  const out: string[] = []
  const walk = (prefix: string, value: unknown): void => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${prefix}[${i}]`, v))
    else if (value !== null && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) walk(`${prefix}[${k}]`, v)
    else out.push(`${prefix}=${encodeURIComponent(String(value))}`)
  }
  walk('where', where)
  return `${BASE}?${out.join('&')}`
}

/** The list URL's `where`, re-serialised, to tell which link is current. */
function currentKey(searchParams: Props['searchParams'], links: Link[]): string {
  const params = Object.entries(searchParams ?? {})
    .filter(([k]) => k.startsWith('where'))
    .map(([k, v]) => `${k}=${encodeURIComponent(String(Array.isArray(v) ? v[0] : v))}`)
    .sort()
    .join('&')
  for (const l of links) {
    const own = l.where ? query(l.where).split('?')[1].split('&').sort().join('&') : ''
    if (own === params) return l.key
  }
  return ''
}

/**
 * WordPress's status links above the articles table:
 * « Tous (n) | Mes articles (n) | Publiés (n) | Brouillons (n) | En attente de relecture (n) ».
 *
 * Each count runs the query its link opens, the way the list view runs it — latest versions
 * (`draft: true`) under the viewer's own access — so the number next to a link is the number
 * of rows behind it. A journalist's « Tous » is everything they may read: the site's
 * published articles plus their own work.
 */
export default async function StatusLinks({ payload, user, searchParams }: Props) {
  const viewer = user as User | null | undefined
  if (!viewer) return null

  const links: Link[] = [
    { key: 'all', label: 'Tous', where: null },
    { key: 'mine', label: 'Mes articles', where: { author: { equals: viewer.id } } },
    { key: 'published', label: 'Publiés', where: { _status: { equals: 'published' } } },
    { key: 'drafts', label: 'Brouillons', where: { _status: { equals: 'draft' } } },
    {
      key: 'pending',
      label: 'En attente de relecture',
      where: { and: [{ reviewState: { equals: 'pending' } }, { _status: { equals: 'draft' } }] },
    },
  ]

  const counts = await Promise.all(
    links.map((l) =>
      payload
        .find({
          collection: 'articles',
          draft: true,
          ...(l.where ? { where: l.where } : {}),
          limit: 1,
          depth: 0,
          select: { title: true },
          user: viewer,
          overrideAccess: false,
        })
        .then((r) => r.totalDocs),
    ),
  )
  const current =
    currentKey(searchParams, links) ||
    (Object.keys(searchParams ?? {}).some((k) => k.startsWith('where')) ? '' : 'all')

  return (
    <nav className="vhb-status-links" aria-label="Filtrer par état" data-status-links>
      <ul>
        {links.map((l, i) => (
          <li key={l.key}>
            <a
              href={query(l.where)}
              data-status={l.key}
              data-count={counts[i]}
              aria-current={current === l.key ? 'page' : undefined}
            >
              {l.label}{' '}
              <span className="vhb-status-links__count">
                ({new Intl.NumberFormat('fr-FR').format(counts[i])})
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
