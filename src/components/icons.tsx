/**
 * Inline SVG icons.
 *
 * Hand-written rather than pulled from an icon package: the site needs six
 * glyphs, and a dependency would ship a runtime and a tree-shaking problem for
 * what amounts to a few hundred bytes of path data. Each is `aria-hidden` —
 * the accessible name always lives on the surrounding link or button, so screen
 * readers never announce a decorative glyph twice.
 */

type IconProps = { className?: string }

const base = (className = 'h-4 w-4') => ({
  className,
  viewBox: '0 0 24 24',
  'aria-hidden': true as const,
  focusable: 'false' as const,
})

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="currentColor">
      <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z" />
    </svg>
  )
}

export function TwitterIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="currentColor">
      <path d="M18.9 3H21l-6.6 7.5L22 21h-6.1l-4.8-6.2L5.6 21H3.5l7-8L2 3h6.2l4.3 5.7L18.9 3zm-1.1 16.2h1.2L7.3 4.7H6l11.8 14.5z" />
    </svg>
  )
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="currentColor">
      <path d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  )
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}
