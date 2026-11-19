import Image from 'next/image'
import Link from 'next/link'

/**
 * The black masthead with the centred logo (DESIGN-SPEC-R3 §4.2, decisions D1 and D7).
 *
 * Desktop only and not sticky: it scrolls away and the sticky bar below it takes over,
 * cross-fading in the compact mark. Its height never changes, so nothing below jumps.
 */
export function Masthead() {
  return (
    <div data-masthead className="vh-masthead hidden lg:block">
      <div className="vh-container flex justify-center py-6">
        <Link href="/" aria-label="VH Magazine — accueil" className="block">
          <Image
            data-logo="masthead"
            src="/vh-logo-white.svg"
            alt="VH Magazine"
            width={236}
            height={64}
            priority
            className="h-16 w-auto"
          />
        </Link>
      </div>
    </div>
  )
}
