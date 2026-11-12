import Link from 'next/link'

import { typoFr } from '@/lib/typo-fr'

export type Crumb = { label: string; href: string }

/**
 * Breadcrumb trail (spec §6.10, DESIGN-SPEC-R3 §4.9). The same `items` feed the visible
 * trail and the BreadcrumbList JSON-LD, so what a reader sees and what a crawler reads
 * cannot diverge. The current page is text, not a link.
 */
export function Breadcrumbs({ items, tone = 'light' }: { items: Crumb[]; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark'
  return (
    <nav data-breadcrumbs aria-label="Fil d'Ariane" className="mb-6">
      <ol className={`type-meta flex flex-wrap items-center gap-2 ${dark ? 'text-night-ink-2' : 'text-meta'}`}>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.href} className="flex min-w-0 items-center gap-2">
              {last ? (
                <span aria-current="page" className={`vh-clamp-2 ${dark ? 'text-night-ink' : 'text-ink-2'}`}>
                  {typoFr(item.label)}
                </span>
              ) : (
                <Link href={item.href} className="vh-hover-line">
                  {item.label}
                </Link>
              )}
              {!last ? <span aria-hidden="true">›</span> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
