'use client'

import { useEffect } from 'react'

/**
 * Image fade-in on load (DESIGN-SPEC-R3 §3.6) for every <img data-fade>, with one
 * listener set instead of a client component per card.
 *
 * Nothing is hidden until this has run (`html[data-fade-ready]` gates the CSS), so a
 * reader without JS sees every image. Images already complete are marked loaded first;
 * the rest fade from canvas-2 when their bytes arrive. Images added later (client
 * navigation) are picked up by a MutationObserver. The LCP image never carries data-fade.
 */
export function ImageFader() {
  useEffect(() => {
    const done = (img: HTMLImageElement) => img.setAttribute('data-loaded', '')
    const watch = (img: HTMLImageElement) => {
      if (img.hasAttribute('data-loaded')) return
      if (img.complete) return done(img)
      img.addEventListener('load', () => done(img), { once: true })
      img.addEventListener('error', () => done(img), { once: true })
    }
    document.querySelectorAll<HTMLImageElement>('img[data-fade]').forEach(watch)
    document.documentElement.setAttribute('data-fade-ready', '')

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return
          if (node.matches('img[data-fade]')) watch(node as HTMLImageElement)
          node.querySelectorAll<HTMLImageElement>('img[data-fade]').forEach(watch)
        })
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
