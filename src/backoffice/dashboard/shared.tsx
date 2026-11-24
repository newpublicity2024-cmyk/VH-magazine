import type { Payload, Where } from 'payload'

import type { Article, Category, User } from '@/payload-types'
import { articleUrl } from '@/lib/routes'

/**
 * Shared pieces of the dashboard widgets (`admin.dashboard.widgets` in payload.config.ts).
 *
 * Every widget is a server component receiving Payload's `WidgetServerProps` (`req.payload`,
 * `req.user`) and rendering plain markup styled by src/backoffice/styles (the `vhb-` classes).
 * Anchors, not next/link: these are Payload admin routes and Payload's own nav uses anchors.
 *
 * Two kinds of article query, and the difference is the point:
 *  - LATEST VERSION (`draft: true`): what the newsroom is working on. The review flag and any
 *    unpublished edit live only there, because draft saves never write the main row.
 *  - LIVE (main row, no `draft`): what a reader can open. « En ligne » counts mean this.
 * Every query runs with the viewer's own access (`overrideAccess: false`), so a journalist's
 * numbers are their own by construction, not by a filter someone could forget.
 */

export const ADMIN = '/admin'
export const ARTICLES = `${ADMIN}/collections/articles`

export type Viewer = User

export const isEditorial = (user: Pick<User, 'role'> | null | undefined): boolean =>
  user?.role === 'admin' || user?.role === 'editor'

/** First name only — « Bonjour Karim » reads warmer than the full byline. */
export const firstNameOf = (user: User): string =>
  ((user.name || user.email).trim().split(/\s+/)[0] ?? '').replace(/@.*$/, '')

// ── Where builders ───────────────────────────────────────────────────────────

const mineIfJournalist = (user: User): Where[] =>
  isEditorial(user) ? [] : [{ author: { equals: user.id } }]

/** Waiting for an editor: latest version flagged pending. */
export const pendingWhere = (user: User): Where => ({
  and: [
    { reviewState: { equals: 'pending' } },
    { _status: { equals: 'draft' } },
    ...mineIfJournalist(user),
  ],
})

/**
 * Being written: latest version is a draft not yet handed in. Editors see the team's, minus
 * untitled shells — with autosave, opening « Ajouter » creates a draft at once, and those
 * would otherwise bury the real work. A journalist sees all of their own.
 */
export const draftsWhere = (user: User): Where => ({
  and: [
    { _status: { equals: 'draft' } },
    // `<>` drops NULLs in SQL, so a row the migration never stamped must be admitted explicitly.
    { or: [{ reviewState: { not_equals: 'pending' } }, { reviewState: { exists: false } }] },
    ...mineIfJournalist(user),
    ...(isEditorial(user) ? [{ title: { exists: true } }, { title: { not_equals: '' } }] : []),
  ],
})

/** On the site now (main row), optionally since a moment. */
export const liveWhere = (user: User, since?: Date): Where => ({
  and: [
    { _status: { equals: 'published' } },
    ...mineIfJournalist(user),
    ...(since ? [{ publishedAt: { greater_than_equal: since.toISOString() } }] : []),
  ],
})

/** Count over latest versions: Payload's `count` cannot read drafts, so ask `find` for its total. */
export async function countLatest(payload: Payload, user: User, where: Where): Promise<number> {
  const res = await payload.find({
    collection: 'articles',
    draft: true,
    where,
    limit: 1,
    depth: 0,
    select: { title: true },
    user,
    overrideAccess: false,
  })
  return res.totalDocs
}

/** Count over live main rows. */
export async function countLive(payload: Payload, user: User, where: Where): Promise<number> {
  const res = await payload.count({ collection: 'articles', where, user, overrideAccess: false })
  return res.totalDocs
}

// ── The newsroom's clock: Casablanca, not the server's UTC ───────────────────

export const NEWSROOM_TZ = 'Africa/Casablanca'

function zoneOffsetMs(at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: NEWSROOM_TZ,
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value // "GMT+01:00"
  const m = part?.match(/([+-])(\d{2}):(\d{2})/)
  if (!m) return 0
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000
}

/** Newsroom-local calendar day of a moment, as YYYY-MM-DD. */
export const newsroomDay = (at: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: NEWSROOM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)

/** Midnight, newsroom time, `daysBack` days before `now`'s newsroom day. */
export function newsroomMidnight(now = new Date(), daysBack = 0): Date {
  const day = newsroomDay(new Date(now.getTime() - daysBack * 86_400_000))
  const utcMidnight = Date.parse(`${day}T00:00:00Z`)
  return new Date(utcMidnight - zoneOffsetMs(new Date(utcMidnight)))
}

const hourNow = (now: Date): number =>
  Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: NEWSROOM_TZ,
      hour: 'numeric',
      hour12: false,
    }).format(now),
  )

export const greeting = (now = new Date()): string => (hourNow(now) < 18 ? 'Bonjour' : 'Bonsoir')

export const todayLabel = (now = new Date()): string => {
  const s = new Intl.DateTimeFormat('fr-FR', {
    timeZone: NEWSROOM_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** « 24/11/2026 à 14:05 », newsroom time. */
export const dateTimeLabel = (value: string | null | undefined): string => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const date = new Intl.DateTimeFormat('fr-FR', {
    timeZone: NEWSROOM_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
  const time = new Intl.DateTimeFormat('fr-FR', {
    timeZone: NEWSROOM_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  return `${date} à ${time}`
}

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

/** « il y a 5 minutes », « hier ». */
export function relativeTime(value: string | null | undefined, now = new Date()): string {
  if (!value) return ''
  const diff = (new Date(value).getTime() - now.getTime()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return 'à l’instant'
  if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute')
  if (abs < 86_400) return relative.format(Math.round(diff / 3600), 'hour')
  if (abs < 86_400 * 30) return relative.format(Math.round(diff / 86_400), 'day')
  return dateTimeLabel(value)
}

export const numberLabel = (n: number): string => new Intl.NumberFormat('fr-FR').format(n)

// ── Article helpers ──────────────────────────────────────────────────────────

export const titleOf = (a: Pick<Article, 'title'>): string => a.title?.trim() || 'Sans titre'

export const editHref = (a: Pick<Article, 'id'>): string => `${ARTICLES}/${a.id}`

export const categoryNameOf = (a: Article): string | null => {
  const c = a.category
  return c && typeof c === 'object' ? ((c as Category).name ?? null) : null
}

export const authorNameOf = (a: Article): string | null => {
  const u = a.author
  return u && typeof u === 'object' ? (u as User).name || (u as User).email : null
}

/** The public URL, when the category chain is populated (query with depth ≥ 2). */
export const publicUrlOf = (a: Article): string | null => {
  const url = articleUrl(a as never)
  return url === '/' ? null : url
}

/** A list URL with filters — `where[a][equals]=b` pairs Payload's list view reads. */
export function listHref(
  base: string,
  filters: Array<[string, string, string]>,
  extra = '',
): string {
  const parts = filters.map(
    ([field, op, value]) => `where[${field}][${op}]=${encodeURIComponent(value)}`,
  )
  const query = [...parts, ...(extra ? [extra] : [])].join('&')
  return query ? `${base}?${query}` : base
}

/**
 * The list URL for a `Where` object — the SAME object a widget counted with, serialised the
 * way Payload's list view parses its query string (qs brackets). A tile and the list it opens
 * therefore cannot disagree about which articles they mean.
 */
export function whereHref(base: string, where: Where, extra = ''): string {
  const out: string[] = []
  const walk = (prefix: string, value: unknown): void => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${prefix}[${i}]`, v))
    else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(`${prefix}[${k}]`, v)
    } else out.push(`${prefix}=${encodeURIComponent(String(value))}`)
  }
  walk('where', where)
  if (extra) out.push(extra)
  return `${base}?${out.join('&')}`
}

// ── Presentational primitives ────────────────────────────────────────────────

export function Card({
  title,
  icon,
  action,
  children,
  className = '',
  id,
}: {
  title?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section className={`vhb-card ${className}`} data-widget={id} aria-label={title}>
      {(title || action) && (
        <header className="vhb-card__head">
          {title && (
            <h2 className="vhb-card__title">
              {icon && <span className="vhb-card__icon">{icon}</span>}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="vhb-card__body">{children}</div>
    </section>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="vhb-empty">
      <p className="vhb-empty__title">{title}</p>
      {hint && <p className="vhb-empty__hint">{hint}</p>}
      {action}
    </div>
  )
}

// ── Icons: inline SVG, 24×24 stroke, currentColor ────────────────────────────

const svg = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

export const Icons = {
  pen: () => (
    <svg {...svg}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  draft: () => (
    <svg {...svg}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  inbox: () => (
    <svg {...svg}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z" />
    </svg>
  ),
  check: () => (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  ),
  eye: () => (
    <svg {...svg}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  chart: () => (
    <svg {...svg}>
      <path d="M3 3v18h18" />
      <path d="M8 17v-5M13 17V8M18 17v-9" />
    </svg>
  ),
  flame: () => (
    <svg {...svg}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.2 1.5 1.1 2.8 2.5 2.8Z" />
    </svg>
  ),
  mail: () => (
    <svg {...svg}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  ),
  image: () => (
    <svg {...svg}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  home: () => (
    <svg {...svg}>
      <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2Z" />
    </svg>
  ),
  folder: () => (
    <svg {...svg}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  ),
  tag: () => (
    <svg {...svg}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  ),
  book: () => (
    <svg {...svg}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </svg>
  ),
  megaphone: () => (
    <svg {...svg}>
      <path d="m3 11 18-5v12L3 13v-2Z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
  users: () => (
    <svg {...svg}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  ),
  user: () => (
    <svg {...svg}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  settings: () => (
    <svg {...svg}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  ),
  redirect: () => (
    <svg {...svg}>
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
      <path d="m9 10-5 5 5 5" />
    </svg>
  ),
  newsletter: () => (
    <svg {...svg}>
      <path d="M4 4h16v12H5.2L4 17.2Z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  ),
  external: () => (
    <svg {...svg}>
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
}
