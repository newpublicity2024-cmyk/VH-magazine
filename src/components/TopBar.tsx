import Link from 'next/link'

import { SocialLinks } from '@/components/SocialLinks'
import { UTILITY_NAV } from '@/lib/nav'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

/**
 * The thin utility strip above the header (spec §4.1): partner and service
 * links separated by pipes, plus the socials.
 *
 * Hidden below `lg` — on mobile these links live in the drawer instead, which
 * is what the live site does and what keeps the strip from wrapping to four
 * lines on a phone. The separators are CSS pseudo-elements rather than literal
 * "|" text nodes so screen readers do not read a pipe between every item.
 */
export function TopBar({ social }: { social?: Social | null }) {
  return (
    <div data-nav="topbar" className="hidden border-b border-rule bg-white lg:block">
      <div className="vh-container flex items-center justify-between gap-6 py-1.5">
        <nav aria-label="Liens utiles">
          <ul className="flex flex-wrap items-center">
            {UTILITY_NAV.map((item) => (
              <li
                key={item.label}
                className="after:mx-2 after:text-rule after:content-['|'] last:after:content-['']"
              >
                <Link
                  href={item.href || '/'}
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer', prefetch: false } : {})}
                  className="text-[10px] font-medium uppercase tracking-[0.06em] text-meta transition-colors hover:text-vh-red"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <SocialLinks social={social} className="text-meta" iconClassName="h-3.5 w-3.5" />
      </div>
    </div>
  )
}
