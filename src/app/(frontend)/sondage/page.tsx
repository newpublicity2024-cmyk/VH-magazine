import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { STATIC_ROUTES } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 86400

export const metadata: Metadata = buildMetadata({
  title: 'Sondage',
  description: 'Donnez votre avis sur VH Magazine.',
  path: STATIC_ROUTES.sondage,
})

export default function SondagePage() {
  return (
    <div className="vh-container py-6">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Sondage', href: STATIC_ROUTES.sondage }]} />
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-ink">Sondage VH Magazine</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft/90">
          Le sondage sera publié ici prochainement. Merci de votre intérêt.
        </p>
      </div>
    </div>
  )
}
