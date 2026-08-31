import Image from 'next/image'
import Link from 'next/link'

import { SocialLinks } from '@/components/SocialLinks'
import { FOOTER_KEYWORDS, UTILITY_NAV } from '@/lib/nav'
import { SITE } from '@/lib/site'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

/**
 * Footer (spec §4.3): black background, white logo, socials, two link columns,
 * copyright.
 *
 * The copyright year is fixed at build time rather than computed per request —
 * `new Date()` in a server component renders a different year either side of
 * midnight on New Year, which is a hydration mismatch waiting to happen. ISR
 * revalidation refreshes it well within a year.
 */
export function Footer({ social }: { social?: Social | null }) {
  const year = new Date().getUTCFullYear()

  return (
    <footer data-section="footer" className="mt-16 bg-ink text-white">
      <div className="vh-container py-10">
        <div className="grid gap-8 md:grid-cols-[auto_1fr_1fr]">
          <div>
            <Link href="/" aria-label="VH Magazine — accueil">
              <Image
                src="/vh-logo-white.svg"
                alt="VH Magazine"
                width={200}
                height={64}
                loading="lazy"
                className="h-11 w-auto"
              />
            </Link>
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-white/60">
              {SITE.tagline}
            </p>
            <SocialLinks social={social} className="mt-4 text-white" iconClassName="h-5 w-5" />
          </div>

          <nav aria-label="Liens utiles (pied de page)">
            <h2 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-white/80">
              VH Magazine
            </h2>
            <ul className="space-y-1.5">
              {UTILITY_NAV.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href || '/'}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="text-[12px] text-white/70 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Thématiques">
            <h2 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-white/80">
              Thématiques
            </h2>
            <ul className="space-y-1.5">
              {FOOTER_KEYWORDS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href || '/'}
                    className="text-[12px] text-white/70 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-10 border-t border-white/15 pt-5 text-[11px] text-white/50">
          @{year} - Tous droits réservés magazine VH Maroc — {SITE.legalName}
        </p>
      </div>
    </footer>
  )
}
