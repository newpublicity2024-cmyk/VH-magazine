'use client'

import Link from 'next/link'
import { useState } from 'react'

import { ChevronDownIcon } from '@/components/icons'
import { PRIMARY_NAV } from '@/lib/nav'

/**
 * Desktop primary nav with the "Les Couv's" dropdown (spec §4.2).
 *
 * A client component only because of the dropdown. It opens on hover AND on
 * click/focus: hover alone is unusable from a keyboard and unreachable on a
 * touch-capable laptop, so the parent is a real <button> with aria-expanded and
 * the submenu closes on Escape.
 *
 * `data-nav-item` marks the top-level entries so gate G12 can assert the nav
 * contains exactly the items spec §4.2 lists — no more, no fewer.
 */
export function MainNav() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <nav data-nav="primary" aria-label="Navigation principale" className="hidden lg:block">
      <ul className="flex items-center gap-6">
        {PRIMARY_NAV.map((item, index) => {
          const hasChildren = Boolean(item.children?.length)
          const isOpen = openIndex === index

          if (!hasChildren) {
            return (
              <li key={item.label} data-nav-item={item.label}>
                <Link
                  href={item.href || '/'}
                  className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink transition-colors hover:text-vh-red"
                >
                  {item.label}
                </Link>
              </li>
            )
          }

          return (
            <li
              key={item.label}
              data-nav-item={item.label}
              className="relative"
              onMouseEnter={() => setOpenIndex(index)}
              onMouseLeave={() => setOpenIndex(null)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpenIndex(null)
              }}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="true"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.09em] text-ink transition-colors hover:text-vh-red"
              >
                {item.label}
                <ChevronDownIcon className="h-3 w-3" />
              </button>

              {/* Always rendered, visibility toggled. Mounting only while open
                  would keep these links out of the server HTML entirely, so a
                  crawler — or a reader without JS — would never see them. */}
              <ul
                className={`absolute start-0 top-full z-50 w-72 border border-rule bg-white py-2 shadow-lg ${
                  isOpen ? 'block' : 'hidden'
                }`}
              >
                {item.children?.map((child) => (
                  <li key={child.label}>
                    <Link
                      href={child.href || '/'}
                      onClick={() => setOpenIndex(null)}
                      className="block px-4 py-2 text-[12px] leading-snug text-ink-soft transition-colors hover:bg-wash hover:text-vh-red"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
