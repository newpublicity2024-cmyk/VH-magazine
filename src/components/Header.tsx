'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { MainNav } from '@/components/MainNav'
import { MobileDrawer } from '@/components/MobileDrawer'
import { SearchOverlay } from '@/components/SearchOverlay'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

/**
 * The sticky bar (DESIGN-SPEC-R3 §4.2): compact VH mark · primary nav · search on
 * desktop; menu · logo · search on mobile.
 *
 * `position: sticky` from the first paint and a fixed 56 px height, so pinning and the
 * compact swap move nothing (gate R3-G6). Once the masthead has scrolled away the bar
 * turns `data-compact`: the mark fades in and the dark material + hairline + shadow
 * appear. The material is painted on ::before so the bar itself is not a backdrop root
 * and its fixed-position overlays stay relative to the viewport.
 */
export function Header({ social }: { social?: Social | null }) {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const masthead = document.querySelector<HTMLElement>('[data-masthead]')
    let frame = 0
    const measure = () => {
      frame = 0
      const tall = masthead && masthead.offsetHeight > 0
      const threshold = tall ? masthead.offsetTop + masthead.offsetHeight : 1
      setCompact(window.scrollY >= threshold)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <header data-sticky-header data-compact={compact} className="vh-bar">
      <div className="vh-container vh-bar-inner">
        <div className="flex items-center gap-2">
          <MobileDrawer social={social} />
          <Link
            href="/"
            data-compact-mark
            aria-label="VH Magazine — accueil"
            aria-hidden={!compact}
            tabIndex={compact ? 0 : -1}
            className="vh-compact-mark hidden lg:block"
          >
            <Image
              data-logo="compact"
              src="/vh-mark-white.svg"
              alt=""
              width={118}
              height={64}
              loading="lazy"
              className="h-7 w-auto"
            />
          </Link>
        </div>

        <div className="flex justify-center">
          <Link href="/" aria-label="VH Magazine — accueil" className="block lg:hidden">
            <Image
              data-logo="bar"
              src="/vh-logo-white.svg"
              alt="VH Magazine"
              width={236}
              height={64}
              loading="lazy"
              className="h-8 w-auto"
            />
          </Link>
          <MainNav />
        </div>

        <div className="flex items-center justify-end">
          <SearchOverlay />
        </div>
      </div>
    </header>
  )
}
