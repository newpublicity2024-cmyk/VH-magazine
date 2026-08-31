import type { ReactNode } from 'react'

/**
 * Wrapper for the sidebar widgets (spec §6.6).
 *
 * `widgetKey` becomes `data-widget`, a namespace deliberately kept separate from
 * the `data-section` markers the ordering gate reads — the sidebar as a whole is
 * one section, and its widgets must not be mistaken for top-level sections.
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
    <section data-widget={widgetKey} className="mb-8">
      {title ? (
        <h2 className="mb-3 border-b-2 border-ink pb-2 font-display text-sm font-bold uppercase tracking-[0.08em] text-ink">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  )
}
