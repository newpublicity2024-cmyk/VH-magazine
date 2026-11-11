'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { CloseIcon, MenuIcon } from '@/components/icons'
import { SocialLinks } from '@/components/SocialLinks'
import { PRIMARY_NAV, UTILITY_NAV } from '@/lib/nav'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

/**
 * Mobile slide-in drawer (spec §4.2): the full primary nav, the utility links
 * and the socials.
 *
 * The drawer is a modal surface, so it behaves like one: Escape closes it, the
 * background scroll is locked while it is open, focus moves into it on open and
 * returns to the hamburger on close. Without the focus return a keyboard user
 * is dumped at the top of the document every time they close the menu.
 *
 * It is unmounted when closed rather than hidden, so its links never sit in the
 * tab order behind the page — which is also what lets gate G18 assert it is not
 * visible before the hamburger is clicked.
 */
export function MobileDrawer({ social }: { social?: Social | null }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        data-drawer-trigger
        type="button"
        aria-expanded={open}
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className="p-2 text-ink transition-colors hover:text-vh-red lg:hidden"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={close}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            data-drawer
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="absolute inset-y-0 start-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-white outline-none"
          >
            <div className="flex items-center justify-between border-b border-rule px-4 py-3">
              <span className="font-display text-sm font-bold uppercase tracking-[0.08em]">Menu</span>
              <button
                data-drawer-close
                type="button"
                aria-label="Fermer le menu"
                onClick={close}
                className="p-1 text-ink transition-colors hover:text-vh-red"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>

            <nav aria-label="Navigation principale (mobile)" className="px-4 py-4">
              <ul className="space-y-1">
                {PRIMARY_NAV.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={close}
                        className="block py-2 text-sm font-semibold uppercase tracking-[0.06em] text-ink"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="block py-2 text-sm font-semibold uppercase tracking-[0.06em] text-ink">
                        {item.label}
                      </span>
                    )}

                    {item.children?.length ? (
                      <ul className="mb-2 ms-3 space-y-1 border-s border-rule ps-3">
                        {item.children.map((child) => (
                          <li key={child.label}>
                            <Link
                              href={child.href || '/'}
                              onClick={close}
                              className="block py-1.5 text-[12px] leading-snug text-meta"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-auto border-t border-rule px-4 py-4">
              <ul className="space-y-1.5">
                {UTILITY_NAV.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href || '/'}
                      onClick={close}
                      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer', prefetch: false } : {})}
                      className="block text-[11px] uppercase tracking-[0.06em] text-meta"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <SocialLinks social={social} className="mt-4 text-ink" iconClassName="h-5 w-5" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
