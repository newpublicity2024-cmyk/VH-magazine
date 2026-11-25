'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The two-column row of every page with a side panel, scrolling as vh.ma's does.
 *
 * vh.ma's theme runs its sticky-sidebar script (theia) on BOTH columns — `penci-sticky-ct` on the
 * content, `penci-sticky-sb` on the sidebar. Measured on its home page at 1440×900 (2026-11-25,
 * Chromium with real wheel events): the 3,046 px main column scrolls normally until its bottom
 * reaches the window's bottom, then holds there while the 5,522 px sidebar keeps scrolling; when
 * the row ends, both leave together. Scrolling back up, the held column moves with the page until
 * its top is in view, then holds at the top. So the shorter column never leaves blank space beside
 * the taller one (the user's recording of ours showed exactly that blank space).
 *
 * Same rule here, per column, side by side only (≥ 1024 px): a column as tall as the row never
 * moves; a column shorter than the window holds under the sticky bar; any other keeps an offset
 * that changes only when an edge would leave the window, clamped to the row. Applied as a
 * transform, written after the scroll's layout reads: no reflow, and no layout shift (transforms
 * are not layout shifts). A transform makes a column the containing block of its `position: fixed`
 * descendants — keep fixed UI (the reading-progress bar) outside the columns.
 */
export function StickyColumns({ className, children }: { className: string; children: ReactNode }) {
  const grid = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = grid.current
    if (!row) return
    const columns = Array.from(row.children).filter((c): c is HTMLElement => c instanceof HTMLElement)
    const offsets = new Map<HTMLElement, number>(columns.map((c) => [c, 0]))
    const sideBySide = window.matchMedia('(min-width: 1024px)')
    let frame = 0

    const update = () => {
      frame = 0
      if (!sideBySide.matches) {
        for (const c of columns) {
          offsets.set(c, 0)
          c.style.transform = ''
        }
        return
      }
      // Reads first.
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-height')) || 56
      const rowTop = row.getBoundingClientRect().top + window.scrollY
      const rowHeight = row.offsetHeight
      const viewTop = window.scrollY + bar + 24
      const viewBottom = window.scrollY + window.innerHeight
      const next = columns.map((col) => {
        const height = col.offsetHeight
        let o = offsets.get(col) ?? 0
        if (height >= rowHeight - 1) o = 0
        else if (height <= viewBottom - viewTop) o = viewTop - rowTop
        else if (rowTop + o + height < viewBottom) o = viewBottom - height - rowTop
        else if (rowTop + o > viewTop) o = viewTop - rowTop
        return Math.round(Math.max(0, Math.min(rowHeight - height, o)))
      })
      // Then writes.
      columns.forEach((col, i) => {
        if (next[i] === offsets.get(col)) return
        offsets.set(col, next[i])
        col.style.transform = next[i] ? `translateY(${next[i]}px)` : ''
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    sideBySide.addEventListener('change', schedule)
    // Lazy images, the newsletter's states, fonts: any height change re-evaluates the offsets.
    const resized = new ResizeObserver(schedule)
    resized.observe(row)
    for (const c of columns) resized.observe(c)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      sideBySide.removeEventListener('change', schedule)
      resized.disconnect()
      if (frame) cancelAnimationFrame(frame)
      for (const c of columns) c.style.transform = ''
    }
  }, [])

  return (
    <div ref={grid} data-sticky-columns className={className}>
      {children}
    </div>
  )
}
