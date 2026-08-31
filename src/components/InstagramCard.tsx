import Link from 'next/link'

import { InstagramIcon } from '@/components/icons'

/**
 * Lite Instagram facade (spec §9: "Replace Instagram/YouTube heavy embeds with
 * lite facades").
 *
 * A real embed pulls ~800KB of third-party script and blocks the main thread,
 * which would put the Lighthouse target out of reach for one sidebar widget.
 * This links out instead. A genuine latest-post feed needs Instagram API
 * credentials — noted as an open item rather than faked here.
 */
export function InstagramCard({ handle = 'vh.magazine' }: { handle?: string }) {
  return (
    <Link
      href={`https://www.instagram.com/${handle}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 border border-rule p-4 transition-colors hover:border-ink"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-ink text-white transition-colors group-hover:bg-vh-red">
        <InstagramIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">@{handle}</span>
        <span className="block text-[12px] text-meta">Suivez VH sur Instagram</span>
      </span>
    </Link>
  )
}
