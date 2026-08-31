import Link from 'next/link'

/**
 * Server-rendered pagination (spec §7). Real <a href> links, not buttons, so
 * pages are crawlable and each has a shareable URL.
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number
  totalPages: number
  hrefFor: (page: number) => string
}) {
  if (totalPages <= 1) return null

  // A window around the current page — 8,170 articles would otherwise render
  // ~680 links on a category page.
  const from = Math.max(1, page - 2)
  const to = Math.min(totalPages, page + 2)
  const pages = []
  for (let i = from; i <= to; i += 1) pages.push(i)

  const cls = 'border px-3 py-1.5 text-[12px] transition-colors'

  return (
    <nav data-pagination aria-label="Pagination" className="mt-8 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1.5">
        {page > 1 ? (
          <li>
            <Link rel="prev" href={hrefFor(page - 1)} className={`${cls} border-rule hover:border-ink`}>
              Précédent
            </Link>
          </li>
        ) : null}

        {from > 1 ? (
          <li>
            <Link href={hrefFor(1)} className={`${cls} border-rule hover:border-ink`}>1</Link>
          </li>
        ) : null}
        {from > 2 ? <li aria-hidden="true" className="px-1 text-meta">…</li> : null}

        {pages.map((n) => (
          <li key={n}>
            <Link
              href={hrefFor(n)}
              aria-current={n === page ? 'page' : undefined}
              className={`${cls} ${
                n === page ? 'border-ink bg-ink text-white' : 'border-rule hover:border-ink'
              }`}
            >
              {n}
            </Link>
          </li>
        ))}

        {to < totalPages - 1 ? <li aria-hidden="true" className="px-1 text-meta">…</li> : null}
        {to < totalPages ? (
          <li>
            <Link href={hrefFor(totalPages)} className={`${cls} border-rule hover:border-ink`}>
              {totalPages}
            </Link>
          </li>
        ) : null}

        {page < totalPages ? (
          <li>
            <Link rel="next" href={hrefFor(page + 1)} className={`${cls} border-rule hover:border-ink`}>
              Suivant
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
