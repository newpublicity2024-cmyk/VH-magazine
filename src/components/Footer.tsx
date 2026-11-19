import Image from 'next/image'
import Link from 'next/link'

import { ChevronDownIcon } from '@/components/icons'
import { SocialLinks } from '@/components/SocialLinks'
import { FOOTER_KEYWORDS, UTILITY_NAV, type NavItem } from '@/lib/nav'
import { SITE } from '@/lib/site'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

const COLUMNS: { title: string; label: string; items: NavItem[] }[] = [
  { title: 'VH Magazine', label: 'Liens utiles (pied de page)', items: UTILITY_NAV },
  { title: 'Thématiques', label: 'Thématiques', items: FOOTER_KEYWORDS },
]

function Links({ items }: { items: NavItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href || '/'}
            {...(item.external ? { target: '_blank', rel: 'noopener noreferrer', prefetch: false } : {})}
            className="type-copy-sm vh-hover-line text-night-ink"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * Footer (spec §4.3, DESIGN-SPEC-R3 §4.8): black band, white logo, socials, two link
 * columns, copyright. On phones the columns are accordions (<details>), closed by default.
 * The two layouts are separate subtrees toggled by display, so each one is either fully
 * present or absent from the accessibility tree at a given width.
 */
export function Footer({ social }: { social?: Social | null }) {
  const year = new Date().getUTCFullYear()

  return (
    <footer data-section="footer" className="vh-footer mt-16 lg:mt-24">
      <div className="vh-container pt-12 pb-8 lg:pt-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.3fr)_1fr_1fr]">
          <div>
            <Link href="/" aria-label="VH Magazine — accueil" className="inline-block">
              <Image
                data-logo="footer"
                src="/vh-logo-white.svg"
                alt="VH Magazine"
                width={236}
                height={64}
                loading="lazy"
                className="h-12 w-auto"
              />
            </Link>
            <p className="type-copy-sm mt-4 max-w-xs text-night-ink-2">{SITE.tagline}</p>
            <SocialLinks social={social} className="mt-6 gap-5 text-night-ink" iconClassName="h-5 w-5" />
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.label} className="hidden md:block">
              <h2 className="type-label mb-4 text-night-ink-2">{col.title}</h2>
              <Links items={col.items} />
            </nav>
          ))}

          <nav aria-label="Pied de page" className="md:hidden">
            {COLUMNS.map((col) => (
              <details key={col.title} data-footer-group className="vh-footer-group">
                <summary className="type-label text-night-ink">
                  {col.title}
                  <ChevronDownIcon className="vh-chevron h-4 w-4 text-night-ink-2" />
                </summary>
                <div className="py-5">
                  <Links items={col.items} />
                </div>
              </details>
            ))}
          </nav>
        </div>

        <p className="type-meta mt-12 pt-6 text-night-ink-2 hairline-dark-t">
          @{year} - Tous droits réservés magazine VH Maroc — {SITE.legalName}
        </p>
      </div>
    </footer>
  )
}
