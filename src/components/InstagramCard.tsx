import Link from 'next/link'

import { InstagramIcon } from '@/components/icons'

/**
 * Lite Instagram facade (spec §9): a link out instead of ~800 KB of embed script. A real
 * latest-post feed needs Instagram API credentials — an open item, not faked here.
 * On canvas-2, so its secondary line is ink-2, never meta (amendment C4).
 */
export function InstagramCard({ handle = 'vh.magazine' }: { handle?: string }) {
  return (
    <Link
      href={`https://www.instagram.com/${handle}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="pressable flex items-center gap-4 rounded-panel bg-canvas-2 p-4 transition-colors hover:bg-canvas-3"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-band text-white">
        <InstagramIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="type-title-sm block text-ink">@{handle}</span>
        <span className="type-copy-sm block text-ink-2">Suivez VH sur Instagram</span>
      </span>
    </Link>
  )
}
