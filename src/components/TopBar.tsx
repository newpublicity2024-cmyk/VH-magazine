import Link from 'next/link'
import { Fragment } from 'react'

import { SocialLinks } from '@/components/SocialLinks'
import { UTILITY_NAV } from '@/lib/nav'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

/**
 * The utility strip above the masthead (spec §4.1, DESIGN-SPEC-R3 §4.1): partner and
 * service links plus the socials, on black as part of the masthead (D1).
 *
 * Desktop only — on mobile these links live in the drawer, as on the live site. The
 * dividers are empty spans, not "|" text, so screen readers do not read a pipe between
 * every item.
 */
export function TopBar({ social }: { social?: Social | null }) {
  return (
    <div data-nav="topbar" className="vh-topbar hidden lg:block">
      <div className="vh-container flex h-8 items-center justify-between gap-6">
        <nav aria-label="Liens utiles">
          <ul className="flex flex-wrap items-center">
            {UTILITY_NAV.map((item, i) => (
              <Fragment key={item.label}>
                {i > 0 ? <li aria-hidden="true" className="vh-topbar-sep" /> : null}
                <li>
                  <Link
                    href={item.href || '/'}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer', prefetch: false } : {})}
                    className="type-micro vh-hover-line text-night-ink-2 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              </Fragment>
            ))}
          </ul>
        </nav>

        <SocialLinks social={social} className="gap-4 text-night-ink-2" iconClassName="h-4 w-4" />
      </div>
    </div>
  )
}
