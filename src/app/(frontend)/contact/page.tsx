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

export default function ContactPage() {
  return (
    <div className="vh-container py-6">
      <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Contact', href: STATIC_ROUTES.contact }]} />
      <h1 className="font-display text-3xl font-bold text-ink">Contact</h1>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          <SectionTitle title="Écrivez-nous" />
          <ContactForm />
        </div>
        <div>
          <SectionTitle title="La rédaction" />
          <address className="space-y-2 text-[14px] not-italic leading-relaxed text-ink-soft/90">
            <p><strong className="text-ink">VH Magazine</strong><br />Les Éditions de la Gazette</p>
            <p>Casablanca, Maroc</p>
            <p>
              <a href="mailto:contact@vh.ma" className="text-vh-red hover:underline">contact@vh.ma</a>
            </p>
          </address>
        </div>
      </div>
    </div>
  )
}
