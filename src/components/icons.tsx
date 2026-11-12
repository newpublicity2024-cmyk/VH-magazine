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

export function WhatsappIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.66 15l-1.3 4.76 4.88-1.28A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-2.9.76.78-2.83-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.13c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.54.06a6.7 6.7 0 0 1-3.32-2.9c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.56-.42h-.48c-.16 0-.43.06-.66.3-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.13.16 1.75 2.67 4.24 3.75 1.57.68 2.19.74 2.98.62.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.08.14-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  )
}

export function LinkedinIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3v-11zm6.5 0h3.83v1.5h.05c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13v5.43h-4v-4.82c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.9h-4v-11z" />
    </svg>
  )
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  )
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

/** The play triangle. Its path is what gate G25 counts as a play affordance. */
export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
