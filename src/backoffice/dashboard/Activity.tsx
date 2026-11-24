import type { WidgetServerProps } from 'payload'

import type { User } from '@/payload-types'

import {
  ARTICLES,
  Card,
  Icons,
  isEditorial,
  liveWhere,
  newsroomDay,
  newsroomMidnight,
  numberLabel,
  whereHref,
} from './shared'

const DAYS = 30

/** Round a maximum up to a clean axis top: 1, 2, 5, 10, 20, 50… */
function niceCeil(n: number): number {
  if (n <= 1) return 1
  const p = 10 ** Math.floor(Math.log10(n))
  for (const m of [1, 2, 5, 10]) if (n <= m * p) return m * p
  return 10 * p
}

const dayLabel = (ymd: string, opts: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...opts }).format(
    new Date(`${ymd}T12:00:00Z`),
  )

/**
 * « Publications — 30 derniers jours »: articles that went live per newsroom day.
 *
 * Form (dataviz): change over time of ONE series → columns, one hue, no legend (the title
 * names the series). Bars are capped at 24 px with a 4 px rounded data end and a square
 * baseline; the grid is a recessive hairline; only the peak carries a direct label; every bar
 * is keyboard-focusable and shows its exact value in a tooltip; the same numbers are in a
 * table view. Server-rendered HTML/CSS — no chart library, no client JavaScript.
 *
 * Counts live main rows by `publishedAt`, in Casablanca days.
 */
export default async function Activity({ req }: WidgetServerProps) {
  const { payload } = req
  const user = req.user as User | null
  if (!user) return null

  const now = new Date()
  const since = newsroomMidnight(now, DAYS - 1)
  const where = liveWhere(user, since)
  const { docs } = await payload.find({
    collection: 'articles',
    where,
    pagination: false,
    depth: 0,
    select: { publishedAt: true },
    user,
    overrideAccess: false,
  })

  const days: string[] = []
  for (let i = DAYS - 1; i >= 0; i -= 1)
    days.push(newsroomDay(new Date(now.getTime() - i * 86_400_000)))
  const counts = new Map(days.map((d) => [d, 0]))
  for (const doc of docs) {
    if (!doc.publishedAt) continue
    const d = newsroomDay(new Date(doc.publishedAt))
    if (counts.has(d)) counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  const series = days.map((d) => ({ day: d, value: counts.get(d) ?? 0 }))
  const total = series.reduce((s, p) => s + p.value, 0)
  const peak = series.reduce((m, p) => (p.value > m.value ? p : m), series[0])
  const top = niceCeil(peak.value)
  const ticks = top <= 2 ? [0, top] : [0, top / 2, top]
  const mean = total / DAYS

  return (
    <Card
      id="vh-activity"
      title="Publications — 30 derniers jours"
      icon={<Icons.chart />}
      action={
        <a className="vhb-link" href={whereHref(ARTICLES, where, 'sort=-publishedAt')}>
          Voir la liste
        </a>
      }
    >
      <p className="vhb-chart__summary" data-total={total}>
        {total === 0 ? (
          'Aucun article mis en ligne ces 30 derniers jours.'
        ) : (
          <>
            <strong>{numberLabel(total)}</strong> article{total > 1 ? 's' : ''} mis en ligne
            {isEditorial(user) ? '' : ' (les vôtres)'} ·{' '}
            {mean.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} par jour en moyenne
          </>
        )}
      </p>
      <div
        className="vhb-chart"
        role="group"
        aria-label={`Articles publiés par jour, du ${dayLabel(days[0], { day: 'numeric', month: 'long' })} au ${dayLabel(days[days.length - 1], { day: 'numeric', month: 'long' })}`}
      >
        <div className="vhb-chart__axis" aria-hidden="true">
          {[...ticks].reverse().map((t) => (
            <span key={t} className="vhb-chart__tick" style={{ bottom: `${(t / top) * 100}%` }}>
              {numberLabel(t)}
            </span>
          ))}
        </div>
        <div className="vhb-chart__plot">
          {ticks.map((t) => (
            <span
              key={t}
              className="vhb-chart__grid"
              style={{ bottom: `${(t / top) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          {series.map((p, i) => {
            const label = `${dayLabel(p.day, { weekday: 'short', day: 'numeric', month: 'short' })} : ${p.value} article${p.value > 1 ? 's' : ''}`
            const isPeak = p === peak && p.value > 0
            const edge =
              i < 4 ? ' vhb-chart__col--start' : i > DAYS - 5 ? ' vhb-chart__col--end' : ''
            return (
              <div
                key={p.day}
                className={`vhb-chart__col${edge}`}
                // A named graphic: role img may carry a label; a bare div may not (axe).
                role="img"
                tabIndex={0}
                aria-label={label}
                data-day={p.day}
                data-value={p.value}
              >
                {p.value > 0 && (
                  <span
                    className="vhb-chart__bar"
                    style={{ height: `${(p.value / top) * 100}%` }}
                  />
                )}
                {isPeak && (
                  <span
                    className="vhb-chart__peak"
                    style={{ bottom: `${(p.value / top) * 100}%` }}
                    aria-hidden="true"
                  >
                    {p.value}
                  </span>
                )}
                <span className="vhb-chart__tip" role="tooltip">
                  {label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="vhb-chart__xlabels" aria-hidden="true">
          {series.map((p, i) => (
            <span key={p.day}>
              {(i % 7 === 0 && i <= DAYS - 4) || i === DAYS - 1
                ? dayLabel(p.day, { day: 'numeric', month: 'short' })
                : ''}
            </span>
          ))}
        </div>
      </div>
      <details className="vhb-chart__table">
        <summary>Voir les chiffres jour par jour</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Jour</th>
              <th scope="col">Articles publiés</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((p) => (
              <tr key={p.day}>
                <td>{dayLabel(p.day, { weekday: 'long', day: 'numeric', month: 'long' })}</td>
                <td>{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  )
}
