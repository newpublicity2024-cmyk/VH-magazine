import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { STATIC_ROUTES } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 86400

export const metadata: Metadata = buildMetadata({
  title: 'Team VH',
  description: "L'équipe de VH Magazine, menée par Rafik Lahlou, fondateur du magazine.",
  path: STATIC_ROUTES.teamVh,
})

export default function TeamPage() {
  return (
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Team VH', href: STATIC_ROUTES.teamVh }]} />
      <div className="mx-auto max-w-[45rem]">
        <h1 className="type-h1-page text-ink">Team VH</h1>
        <div className="vh-prose mt-8">
          <p>
            VH Magazine est né en 2002 de l’envie de raconter le Maroc au masculin : l’art de vivre,
            le lifestyle, la mode, les moteurs et les gens qui font bouger le pays.
          </p>
          <h2>Rafik Lahlou</h2>
          <p>
            Fondateur de VH et de RM Automobiles, co-fondateur de MajicCasa, grand passionné de
            l’automobile, lanceur de projets et d’idées.
          </p>
          <h2>La rédaction</h2>
          <p>
            Une équipe de journalistes, photographes et chroniqueurs qui signent chaque mois les
            enquêtes, portraits et essais du magazine.
          </p>
        </div>
      </div>
    </div>
  )
}
