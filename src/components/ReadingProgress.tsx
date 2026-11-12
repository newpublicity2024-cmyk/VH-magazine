'use client'

import { useEffect, useRef } from 'react'

/**
 * Reading progress (DESIGN-SPEC-R3 §3.6): a 2 px accent bar under the sticky bar.
 *
 * Where the engine supports scroll-driven animations the CSS does all the work
 * (`animation-timeline: scroll(root)`) and this component adds no listener. Elsewhere it
 * sets `--progress` from the scroll position. It is information, not decoration, so it
 * stays under reduced motion.
 */
export function ReadingProgress() {
  const fill = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')) return
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      fill.current?.style.setProperty('--progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div data-reading-progress aria-hidden="true" className="vh-progress">
      <div ref={fill} data-progress-fill className="vh-progress-fill" />
    </div>
  )
}
