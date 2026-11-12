import Link from 'next/link'

import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from '@/components/icons'
import { DEFAULT_SOCIAL } from '@/lib/nav'

type Social = Partial<Record<'facebook' | 'twitter' | 'instagram' | 'youtube', string | null>>

/** Social row, used in the top bar, the footer and the mobile drawer (spec §4). */
export function SocialLinks({
  social,
  className = '',
  iconClassName = 'h-4 w-4',
}: {
  social?: Social | null
  className?: string
  iconClassName?: string
}) {
  const links = [
    { key: 'facebook', label: 'Facebook', Icon: FacebookIcon },
    { key: 'twitter', label: 'X (Twitter)', Icon: TwitterIcon },
    { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
    { key: 'youtube', label: 'YouTube', Icon: YoutubeIcon },
  ] as const

  return (
    <ul className={`flex items-center gap-3 ${className}`}>
      {links.map(({ key, label, Icon }) => {
        const href = social?.[key] || DEFAULT_SOCIAL[key]
        return (
          <li key={key}>
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              // The accessible name lives here, so the icon stays aria-hidden.
              aria-label={`VH Magazine sur ${label}`}
              className="-m-1 block p-1 transition-colors hover:text-white"
            >
              <Icon className={iconClassName} />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
