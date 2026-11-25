import type { ReactNode } from 'react'

import { Sidebar, type SidebarPlace } from '@/components/Sidebar'
import { StickyColumns } from '@/components/StickyColumns'

/**
 * A page's main column with the side panel beside it — the two-column grid every page that has a
 * panel shares (main column, then the 300 px panel 48 px away; below the main column under
 * 1024 px). Everything that belongs to the page — its list, its empty state, its pagination —
 * goes in `children`, so nothing ends up after the panel's full height.
 *
 * Side by side, the columns scroll as vh.ma's do (StickyColumns): the shorter one holds in view
 * while the taller one scrolls, so neither leaves blank space beside the other. `items-start`
 * gives each column its own height (stretched, both would be the row's and nothing could hold).
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
    <StickyColumns className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div data-region="main-column" className={`min-w-0 ${mainClassName}`}>
        {children}
      </div>
      <Sidebar place={place} />
    </StickyColumns>
  )
}
