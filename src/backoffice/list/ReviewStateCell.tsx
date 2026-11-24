'use client'

import type { DefaultCellComponentProps } from 'payload'

/** « Relecture » column: a badge while an article waits for an editor, nothing otherwise. */
export default function ReviewStateCell({ cellData, rowData }: DefaultCellComponentProps) {
  const pending =
    cellData === 'pending' && (rowData as { _status?: string } | undefined)?._status !== 'published'
  if (!pending) return <span className="vhb-cell-muted">—</span>
  return <span className="vhb-pill vhb-pill--pending">À relire</span>
}
