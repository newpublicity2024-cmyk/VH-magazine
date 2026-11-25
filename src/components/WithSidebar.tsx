import type { ReactNode } from 'react'

import { Sidebar, type SidebarPlace } from '@/components/Sidebar'

/**
 * A page's main column with the side panel beside it — the two-column grid every page that has a
 * panel shares (main column, then the 300 px panel 48 px away; below the main column under
 * 1024 px). Everything that belongs to the page — its list, its empty state, its pagination —
 * goes in `children`, so nothing ends up after the panel's full height.
 */
export function WithSidebar({
  place,
  children,
  mainClassName = '',
}: {
  place: SidebarPlace
  children: ReactNode
  mainClassName?: string
}) {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div data-region="main-column" className={`min-w-0 ${mainClassName}`}>
        {children}
      </div>
      <Sidebar place={place} />
    </div>
  )
}
