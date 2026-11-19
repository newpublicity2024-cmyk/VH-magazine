import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CoverGrid } from '@/components/CoverGrid'
import { getAllIssues } from '@/lib/queries'
import { STATIC_ROUTES } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'
import { buildSafe } from '@/lib/build-safe'

export const revalidate = 3600

export const metadata: Metadata = buildMetadata({
  title: 'Les Unes de VH',
  description: 'Toutes les couvertures du magazine VH depuis 2002.',
  path: STATIC_ROUTES.lesUnes,
})

/** Les Unes (DESIGN-SPEC-R3 §5.5): covers as objects, grouped by year under sticky labels. */
export default async function LesUnesPage() {
  const issues = await buildSafe(() => getAllIssues(), [], '/magazine-maroc/')
  const years = new Map<number, typeof issues>()
  for (const issue of issues) {
    const y = new Date(issue.publishedAt).getUTCFullYear()
    years.set(y, [...(years.get(y) ?? []), issue])
  }
  const groups = [...years.entries()].sort((a, b) => b[0] - a[0])

  return (
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Les Unes de VH', href: STATIC_ROUTES.lesUnes }]} />
      <header className="vh-label-rule mb-10">
        <h1 className="type-h1-page text-ink">Les Unes de VH</h1>
      </header>
      <div data-issue-grid className="space-y-16">
        {groups.map(([year, list]) => (
          <section key={year} data-year-group aria-labelledby={`unes-${year}`}>
            <h2
              id={`unes-${year}`}
              className="type-band sticky top-[var(--bar-height)] z-10 mb-8 bg-canvas py-3 text-ink hairline-b"
            >
              {year}
            </h2>
            <CoverGrid issues={list} columns={5} />
          </section>
        ))}
      </div>
    </div>
  )
}
