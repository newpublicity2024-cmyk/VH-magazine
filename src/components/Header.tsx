'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { MainNav } from '@/components/MainNav'
import { MobileDrawer } from '@/components/MobileDrawer'
import { SearchOverlay } from '@/components/SearchOverlay'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

/**
 * Main header (spec §4.2): logo, primary nav, search, mobile hamburger.
 *
 * Sticky on scroll with a backdrop blur (spec §10). `position: sticky` is on
 * the element from the first paint rather than toggled on — swapping between
 * static and fixed mid-scroll removes the element from flow and makes the page
 * jump by the header's height. The scroll listener only adds the shadow and
 * blur, so nothing about the layout changes.
 *
 * The listener is passive: it never calls preventDefault, and marking it so
 * keeps it off the scrolling critical path.
 */
export function Header({ social }: { social?: Social | null }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      data-sticky-header
      className={`sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow ${
        scrolled ? 'border-rule shadow-[0_2px_12px_rgba(0,0,0,0.08)]' : 'border-transparent'
      }`}
    >
      <div className="vh-container flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-2">
          <MobileDrawer social={social} />
          <Link href="/" aria-label="VH Magazine — accueil" className="block">
            <Image
              src="/vh-logo.svg"
              alt="VH Magazine"
              width={200}
              height={64}
              priority
              className="h-9 w-auto sm:h-11"
            />
          </Link>
        </div>

        <MainNav />

        <div className="flex items-center">
          <SearchOverlay />
        </div>
      </div>
    </header>
  )
}
