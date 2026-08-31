import { FacebookIcon, TwitterIcon } from '@/components/icons'

/**
 * Share links (spec §6.10).
 *
 * Plain anchors to each network's share endpoint rather than their SDKs: the
 * official buttons load hundreds of KB of third-party script and set cookies
 * before anyone clicks, which spec §9's Lighthouse target will not survive.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)

  const links = [
    { label: 'Partager sur Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, Icon: FacebookIcon },
    { label: 'Partager sur X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, Icon: TwitterIcon },
  ]

  return (
    <div data-share className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">Partager</span>
      <ul className="flex items-center gap-2">
        {links.map(({ label, href, Icon }) => (
          <li key={label}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-8 w-8 items-center justify-center border border-rule text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
            >
              <Icon className="h-4 w-4" />
            </a>
          </li>
        ))}
        <li>
          <a
            href={`mailto:?subject=${t}&body=${u}`}
            aria-label="Partager par e-mail"
            className="flex h-8 w-8 items-center justify-center border border-rule text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          </a>
        </li>
      </ul>
    </div>
  )
}
