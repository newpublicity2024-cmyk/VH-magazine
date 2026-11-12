'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, type CSSProperties } from 'react'

import { ChevronDownIcon, CloseIcon, MenuIcon } from '@/components/icons'
import { SocialLinks } from '@/components/SocialLinks'
import { PRIMARY_NAV, UTILITY_NAV } from '@/lib/nav'
import { useOverlay } from '@/lib/use-overlay'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

/**
 * Mobile drawer (spec §4.2, DESIGN-SPEC-R3 §4.3): a full-height dark-material sheet from
 * the left with the primary nav, "Les Couv's" as an accordion, the utility links and the
 * socials.
 *
 * Rendered always and toggled with `inert` + `data-state`, so it slides in over 450 ms
 * and back out over 320 ms instead of popping (R3-G5), and its links are in the server
 * HTML. Closed, it is `visibility: hidden` and inert: not visible, not focusable, not in
 * the accessibility tree — which is what G18 checks before the hamburger is pressed.
 */
export function MobileDrawer({ social }: { social?: Social | null }) {
  const { open, setOpen, close, surfaceRef, triggerRef } = useOverlay<HTMLDivElement>()
  const [couvs, setCouvs] = useState(false)
  const stagger = (i: number) => ({ '--i': Math.min(i, 8) }) as CSSProperties

  return (
    <>
      <button
        ref={triggerRef}
        data-drawer-trigger
        type="button"
        aria-expanded={open}
        aria-controls="vh-drawer"
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className="vh-icon-button-dark lg:hidden"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      <div data-drawer-root data-state={open ? 'open' : 'closed'} inert={!open} className="vh-overlay lg:hidden">
        <div className="vh-scrim vh-scrim-drawer" onClick={close} aria-hidden="true" />

        <div
          ref={surfaceRef}
          id="vh-drawer"
          data-drawer
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          tabIndex={-1}
          className="vh-drawer outline-none"
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-4 hairline-dark-b">
            <Image src="/vh-logo-white.svg" alt="" width={236} height={64} loading="lazy" className="h-7 w-auto" />
            <button
              data-drawer-close
              type="button"
              aria-label="Fermer le menu"
              onClick={close}
              className="vh-icon-button-dark"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>

          <nav aria-label="Navigation principale (mobile)" className="px-6 pt-2">
            <ul>
              {PRIMARY_NAV.map((item, i) => (
                <li key={item.label} className="vh-drawer-item" style={stagger(i)}>
                  {item.children?.length ? (
                    <>
                      <button
                        type="button"
                        aria-expanded={couvs}
                        aria-controls="vh-drawer-couvs"
                        onClick={() => setCouvs((v) => !v)}
                        className="vh-drawer-row type-nav vh-drawer-nav w-full text-left text-night-ink"
                      >
                        {item.label}
                        <ChevronDownIcon className="vh-chevron h-5 w-5 text-night-ink-2" />
                      </button>
                      <ul id="vh-drawer-couvs" hidden={!couvs} className="py-2 hairline-dark-b">
                        {item.children.map((child) => (
                          <li key={child.label}>
                            <Link
                              href={child.href || '/'}
                              onClick={close}
                              className="type-copy block py-3 text-night-ink-2 transition-colors hover:text-white"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <Link
                      href={item.href || '/'}
                      onClick={close}
                      className="vh-drawer-row type-nav vh-drawer-nav text-night-ink transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto px-6 pt-8 pb-8">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
              {UTILITY_NAV.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href || '/'}
                    onClick={close}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer', prefetch: false } : {})}
                    className="type-micro text-night-ink-2 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <SocialLinks social={social} className="mt-8 gap-5 text-night-ink" iconClassName="h-5 w-5" />
          </div>
        </div>
      </div>
    </>
  )
}
