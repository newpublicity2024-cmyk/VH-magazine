import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CoverGrid } from '@/components/CoverGrid'
import { SectionTitle } from '@/components/SectionHeader'
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

export default async function LesUnesPage() {
  const issues = await buildSafe(() => getAllIssues(), [], '/magazine-maroc/')
  return (
    <div className="vh-container py-6">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Les Unes de VH', href: STATIC_ROUTES.lesUnes }]} />
      <h1 className="sr-only">Les Unes de VH</h1>
      <SectionTitle title="Toutes nos unes" />
      <div data-issue-grid>
        <CoverGrid issues={issues} />
      </div>
    </div>
  )
}
