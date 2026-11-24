import type { WidgetServerProps } from 'payload'

import type { ContactMessage, User } from '@/payload-types'

import {
  ADMIN,
  Card,
  EmptyState,
  Icons,
  newsroomMidnight,
  numberLabel,
  relativeTime,
} from './shared'

const LIMIT = 5

/**
 * « Lecteurs »: what readers sent — the latest contact messages — and the newsletter list's
 * size. Both collections are readable by editors and admins only, so this widget is in their
 * layout alone; it renders nothing for anyone the access rules turn away.
 */
export default async function Readers({ req }: WidgetServerProps) {
  const { payload } = req
  const user = req.user as User | null
  if (!user) return null

  const week = newsroomMidnight(new Date(), 6).toISOString()
  // Fetch first, render after: a journalist who added this widget by hand is refused by the
  // collections' access rules, and then the widget shows nothing.
  let data
  try {
    data = await Promise.all([
      payload.find({
        collection: 'contact-messages',
        sort: '-createdAt',
        limit: LIMIT,
        depth: 0,
        user,
        overrideAccess: false,
      }),
      payload.count({ collection: 'newsletter-subscribers', user, overrideAccess: false }),
      payload.count({
        collection: 'newsletter-subscribers',
        where: { createdAt: { greater_than_equal: week } },
        user,
        overrideAccess: false,
      }),
    ])
  } catch {
    return null
  }
  const [messages, subscribers, newSubscribers] = data

  return (
    <Card
      id="vh-readers"
      title="Lecteurs"
      icon={<Icons.mail />}
      action={
        <a className="vhb-link" href={`${ADMIN}/collections/contact-messages`}>
          Tous les messages ({messages.totalDocs})
        </a>
      }
    >
      <a
        className="vhb-inline-stat"
        href={`${ADMIN}/collections/newsletter-subscribers`}
        data-stat="subscribers"
        data-value={subscribers.totalDocs}
      >
        <Icons.newsletter />
        <span>
          <strong>{numberLabel(subscribers.totalDocs)}</strong> abonnés à la newsletter
          {newSubscribers.totalDocs > 0 && (
            <> · {numberLabel(newSubscribers.totalDocs)} cette semaine</>
          )}
        </span>
      </a>
      {messages.docs.length === 0 ? (
        <EmptyState
          title="Aucun message"
          hint="Les messages envoyés depuis la page Contact apparaîtront ici."
        />
      ) : (
        <ul className="vhb-rows">
          {(messages.docs as ContactMessage[]).map((m) => (
            <li key={m.id} className="vhb-row">
              <div className="vhb-row__main">
                <a
                  className="vhb-row__title"
                  href={`${ADMIN}/collections/contact-messages/${m.id}`}
                >
                  {m.subject}
                </a>
                <span className="vhb-row__meta">
                  <span>{m.name}</span>
                  <span>{relativeTime(m.createdAt)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
