import Link from 'next/link'

export type Crumb = { label: string; href: string }

/**
 * Breadcrumb trail (spec §6.10). The same `items` array feeds the visible trail
 * and the BreadcrumbList JSON-LD, so what a reader sees and what a crawler reads
 * cannot diverge — building them separately is how those two drift apart.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav data-breadcrumbs aria-label="Fil d'Ariane" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-[11px] text-meta">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.href} className="flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="text-ink-soft">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="transition-colors hover:text-vh-red">
                  {item.label}
                </Link>
              )}
              {!last ? <span aria-hidden="true">›</span> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
