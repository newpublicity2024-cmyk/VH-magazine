import type { ReactNode } from 'react'

/**
 * Wrapper for the sidebar widgets (spec §6.6, DESIGN-SPEC-R3 §4.7): the light heading
 * (uppercase label over the heavy rule) and 40 px between widgets, no boxes.
 *
 * `widgetKey` becomes `data-widget`, deliberately separate from the `data-section`
 * markers the ordering gate reads.
 */
export function SidebarWidget({
  title,
  widgetKey,
  children,
}: {
  title?: string
  widgetKey: string
  children: ReactNode
}) {
  return (
    <section data-widget={widgetKey} className="mb-10 last:mb-0">
      {title ? <h2 className="type-label vh-label-rule mb-6 text-ink">{title}</h2> : null}
      {children}
    </section>
  )
}
