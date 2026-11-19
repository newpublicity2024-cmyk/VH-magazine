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
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Sondage', href: STATIC_ROUTES.sondage }]} />
      <div className="mx-auto max-w-[45rem]">
        <h1 className="type-h1-page text-ink">Sondage VH Magazine</h1>
        <p className="type-copy mt-6 text-ink-2">
          Le sondage sera publié ici prochainement. Merci de votre intérêt.
        </p>
      </div>
    </div>
  )
}
