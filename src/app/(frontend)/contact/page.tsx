import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ContactForm } from '@/components/ContactForm'
import { SectionTitle } from '@/components/SectionHeader'
import { STATIC_ROUTES } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 86400

export const metadata: Metadata = buildMetadata({
  title: 'Contact',
  description: 'Contactez la rédaction de VH Magazine.',
  path: STATIC_ROUTES.contact,
})

/** Contact (DESIGN-SPEC-R3 §5.6): the form beside three canvas-2 cards. */
export default function ContactPage() {
  const cards = [
    {
      title: 'La rédaction',
      body: (
        <address className="not-italic">
          VH Magazine — Les Éditions de la Gazette
          <br />
          Casablanca, Maroc
        </address>
      ),
    },
    {
      title: 'Écrire à la rédaction',
      body: (
        <a href="mailto:contact@vh.ma" className="vh-text-link">
          contact@vh.ma
        </a>
      ),
    },
    {
      title: 'Publicité',
      body: (
        <a href={STATIC_ROUTES.kitMedia} target="_blank" rel="noopener noreferrer" className="vh-text-link">
          Télécharger le kit média
        </a>
      ),
    },
  ]

  return (
    <div className="vh-container pt-8 lg:pt-12">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Contact', href: STATIC_ROUTES.contact }]} />
      <header className="vh-label-rule mb-10">
        <h1 className="type-h1-page text-ink">Contact</h1>
      </header>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="contact-form-heading">
          <SectionTitle title="Écrivez-nous" id="contact-form-heading" />
          <ContactForm />
        </section>
        <aside aria-label="Coordonnées" className="space-y-4">
          {cards.map((c) => (
            <div key={c.title} className="rounded-panel bg-canvas-2 p-6">
              <h2 className="type-label text-ink">{c.title}</h2>
              <div className="type-copy mt-3 text-ink-2">{c.body}</div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}
