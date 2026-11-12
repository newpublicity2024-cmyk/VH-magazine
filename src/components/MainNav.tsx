'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { ChevronDownIcon } from '@/components/icons'
import { PRIMARY_NAV, type NavItem } from '@/lib/nav'

/** A section is active on its listing and on the articles filed under it. */
function isActive(item: NavItem, pathname: string): boolean {
  if (!item.href) return (item.children ?? []).some((c) => isActive(c, pathname))
  if (pathname === item.href || pathname.startsWith(item.href)) return true
  const m = item.href.match(/^\/category\/([^/]+)\/$/)
  return Boolean(m && pathname.startsWith(`/${m[1]}/`))
}

/**
 * Desktop primary nav with the "Les Couv's" dropdown (spec §4.2, DESIGN-SPEC-R3 §4.2).
 *
 * The dropdown is a disclosure: a real <button aria-expanded>, opening on hover after a
 * 120 ms intent delay, on click, and on ArrowDown; arrows move between items and Escape
 * closes and returns focus. Its links are always rendered (visibility toggled) so the
 * server HTML carries them for crawlers. `data-nav-item` marks top-level entries for G12.
 */
export function MainNav() {
  const pathname = usePathname() || '/'
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttons = useRef<Record<number, HTMLButtonElement | null>>({})
  const menus = useRef<Record<number, HTMLUListElement | null>>({})

  const later = (fn: () => void) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fn, 120)
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const items = (index: number) => [...(menus.current[index]?.querySelectorAll<HTMLAnchorElement>('a') ?? [])]

  const onKeyDown = (index: number) => (event: KeyboardEvent) => {
    const list = items(index)
    const at = list.indexOf(document.activeElement as HTMLAnchorElement)
    if (event.key === 'Escape') {
      setOpenIndex(null)
      buttons.current[index]?.focus()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpenIndex(index)
      requestAnimationFrame(() => list[(at + 1) % list.length]?.focus())
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpenIndex(index)
      requestAnimationFrame(() => list[(at - 1 + list.length) % list.length]?.focus())
    }
  }

  return (
    <nav data-nav="primary" aria-label="Navigation principale" className="hidden lg:block">
      <ul className="flex items-center gap-5 xl:gap-6">
        {PRIMARY_NAV.map((item, index) => {
          const active = isActive(item, pathname)
          if (!item.children?.length) {
            return (
              <li key={item.label} data-nav-item={item.label}>
                <Link
                  href={item.href || '/'}
                  aria-current={active ? 'page' : undefined}
                  className="vh-nav-link type-nav"
                >
                  {item.label}
                </Link>
              </li>
            )
          }

          const isOpen = openIndex === index
          return (
            <li
              key={item.label}
              data-nav-item={item.label}
              className="relative"
              onMouseEnter={() => later(() => setOpenIndex(index))}
              onMouseLeave={() => later(() => setOpenIndex(null))}
              onKeyDown={onKeyDown(index)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpenIndex(null)
              }}
            >
              <button
                ref={(el) => {
                  buttons.current[index] = el
                }}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`vh-menu-${index}`}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="vh-nav-link type-nav"
              >
                {item.label}
                <ChevronDownIcon className="vh-chevron h-3 w-3" />
              </button>

              <ul
                id={`vh-menu-${index}`}
                ref={(el) => {
                  menus.current[index] = el
                }}
                data-state={isOpen ? 'open' : 'closed'}
                className="vh-menu"
              >
                {item.children.map((child) => (
                  <li key={child.label}>
                    <Link
                      href={child.href || '/'}
                      onClick={() => setOpenIndex(null)}
                      className="vh-menu-item type-copy-sm"
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
