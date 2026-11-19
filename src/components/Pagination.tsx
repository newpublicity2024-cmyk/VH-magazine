import Link from 'next/link'

/**
 * Server-rendered pagination (spec §7, DESIGN-SPEC-R3 §4.9): real links, so pages are
 * crawlable and shareable; 40 px squares (D2-A), the current page filled with ink.
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

  // A window around the current page — 8,000 articles would otherwise render ~680 links.
  const from = Math.max(1, page - 2)
  const to = Math.min(totalPages, page + 2)
  const pages = []
  for (let i = from; i <= to; i += 1) pages.push(i)

  const cell =
    'type-copy-sm inline-flex h-10 min-w-10 items-center justify-center px-3 tabular-nums transition-colors'
  const idle = `${cell} text-ink hairline-box hover:bg-canvas-2`

  return (
    <nav data-pagination aria-label="Pagination" className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <li>
            <Link rel="prev" href={hrefFor(page - 1)} className={`${idle} gap-1`}>
              <span aria-hidden="true">‹</span> Précédent
            </Link>
          </li>
        ) : null}

        {from > 1 ? (
          <li>
            <Link href={hrefFor(1)} className={idle}>
              1
            </Link>
          </li>
        ) : null}
        {from > 2 ? (
          <li aria-hidden="true" className="px-1 text-meta">
            …
          </li>
        ) : null}

        {pages.map((n) => (
          <li key={n}>
            <Link
              href={hrefFor(n)}
              aria-current={n === page ? 'page' : undefined}
              className={n === page ? `${cell} bg-ink font-semibold text-white` : idle}
            >
              {n}
            </Link>
          </li>
        ))}

        {to < totalPages - 1 ? (
          <li aria-hidden="true" className="px-1 text-meta">
            …
          </li>
        ) : null}
        {to < totalPages ? (
          <li>
            <Link href={hrefFor(totalPages)} className={idle}>
              {totalPages}
            </Link>
          </li>
        ) : null}

        {page < totalPages ? (
          <li>
            <Link rel="next" href={hrefFor(page + 1)} className={`${idle} gap-1`}>
              Suivant <span aria-hidden="true">›</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
