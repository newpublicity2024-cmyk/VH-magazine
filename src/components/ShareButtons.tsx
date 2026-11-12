'use client'

import { FacebookIcon, LinkIcon, LinkedinIcon, MailIcon, ShareIcon, TwitterIcon, WhatsappIcon } from '@/components/icons'
import { toast } from '@/components/Toaster'

/**
 * Share row (spec §6.10, DESIGN-SPEC-R3 §4.9): Facebook, X, WhatsApp, LinkedIn, e-mail and
 * Copy link (with a "Lien copié" toast); on touch devices the native share sheet comes
 * first. Plain share-endpoint links, not network SDKs — those ship hundreds of KB of
 * script and set cookies before anyone clicks.
 *
 * The native-share button is in the server HTML and shown by a CSS `pointer: coarse`
 * query, not added after hydration: adding it from JS wrapped the row and shifted the
 * whole article down 28 px (CLS 0.05 on mobile). Without navigator.share it copies.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {

  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  const links = [
    { network: 'facebook', label: 'Partager sur Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, Icon: FacebookIcon },
    { network: 'x', label: 'Partager sur X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, Icon: TwitterIcon },
    { network: 'whatsapp', label: 'Partager sur WhatsApp', href: `https://wa.me/?text=${t}%20${u}`, Icon: WhatsappIcon },
    { network: 'linkedin', label: 'Partager sur LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, Icon: LinkedinIcon },
    { network: 'email', label: 'Partager par e-mail', href: `mailto:?subject=${t}&body=${u}`, Icon: MailIcon },
  ]

  const nativeShare = () => {
    if ('share' in navigator) navigator.share({ title, url }).catch(() => {})
    else copy()
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast('Lien copié')
    } catch {
      toast('Copie impossible — sélectionnez l’adresse dans la barre du navigateur')
    }
  }

  return (
    <div data-share className="flex flex-wrap items-center gap-3">
      <span className="type-micro hidden text-meta sm:inline">Partager</span>
      <ul className="flex flex-wrap items-center gap-2">
        <li className="hidden pointer-coarse:block">
          <button type="button" aria-label="Partager…" onClick={nativeShare} className="vh-icon-button">
            <ShareIcon className="h-4 w-4" />
          </button>
        </li>
        {links.map(({ network, label, href, Icon }) => (
          <li key={network}>
            <a
              data-share-network={network}
              href={href}
              {...(network === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              aria-label={label}
              className="vh-icon-button"
            >
              <Icon className="h-4 w-4" />
            </a>
          </li>
        ))}
        <li>
          <button data-copy-link type="button" aria-label="Copier le lien" onClick={copy} className="vh-icon-button">
            <LinkIcon className="h-4 w-4" />
          </button>
        </li>
      </ul>
    </div>
  )
}
