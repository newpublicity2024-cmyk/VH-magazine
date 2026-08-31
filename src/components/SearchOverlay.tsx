'use client'

import { useEffect, useRef, useState } from 'react'

import { CloseIcon, SearchIcon } from '@/components/icons'
import { STATIC_ROUTES } from '@/lib/routes'

/**
 * Search trigger + overlay (spec §4.2 "Chercher").
 *
 * Submits as a real GET form to /recherche?q=… rather than routing in JS, so it
 * works before hydration and produces a shareable, back-button-friendly URL.
 * The results page itself is a later round — the overlay is the piece the
 * homepage owns.
 *
 * Escape closes; focus moves to the input on open and back to the trigger on
 * close, for the same reason as the drawer.
 */
export function SearchOverlay() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    inputRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        data-search-trigger
        type="button"
        aria-label="Chercher"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="p-2 text-ink transition-colors hover:text-vh-red"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/70 pt-28">
          <div className="absolute inset-0" onClick={close} aria-hidden="true" />

          <form
            role="search"
            action={STATIC_ROUTES.recherche}
            method="get"
            className="relative z-10 w-full max-w-2xl px-4"
          >
            <label htmlFor="vh-search-input" className="sr-only">
              Rechercher sur VH Magazine
            </label>
            <div className="flex items-center gap-3 border-b-2 border-white pb-3">
              <SearchIcon className="h-6 w-6 shrink-0 text-white" />
              <input
                ref={inputRef}
                id="vh-search-input"
                name="q"
                type="search"
                required
                placeholder="Rechercher…"
                className="w-full bg-transparent text-2xl text-white outline-none placeholder:text-white/50"
              />
              <button
                type="button"
                aria-label="Fermer la recherche"
                onClick={close}
                className="p-1 text-white/70 transition-colors hover:text-white"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
