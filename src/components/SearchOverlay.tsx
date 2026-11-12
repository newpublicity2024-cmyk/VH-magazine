'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { CloseIcon, SearchIcon } from '@/components/icons'
import { STATIC_ROUTES } from '@/lib/routes'
import { useOverlay } from '@/lib/use-overlay'

type Hit = {
  id: number
  title: string
  url: string
  date: string
  category: string | null
  thumb: string | null
}
type Live = { status: 'idle' | 'loading' | 'done' | 'error'; q: string; hits: Hit[] }

const MIN_CHARS = 2
const DEBOUNCE = 150

/**
 * Spotlight-style search (DESIGN-SPEC-R3 §4.4, decision D3): a 640 px light-material
 * panel 15 vh from the top (a full-screen sheet on phones), opened by the search button,
 * "/" or ⌘K / Ctrl-K.
 *
 * From two characters it shows up to six live results from /api/search (debounced, the
 * previous request aborted), then "Voir tous les résultats pour « q »". The form is still
 * a real GET to /recherche/, so Enter works before hydration and without the API.
 */
export function SearchOverlay() {
  const inputRef = useRef<HTMLInputElement>(null)
  const { open, setOpen, close, surfaceRef, triggerRef } = useOverlay<HTMLDivElement>(inputRef)
  const [q, setQ] = useState('')
  const [live, setLive] = useState<Live>({ status: 'idle', q: '', hits: [] })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const t = event.target as HTMLElement | null
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  const term = q.trim()
  useEffect(() => {
    if (term.length < MIN_CHARS) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLive((s) => ({ ...s, status: 'loading' }))
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        const body = (await res.json()) as { hits: Hit[] }
        setLive({ status: 'done', q: term, hits: body.hits })
      } catch {
        if (!controller.signal.aborted) setLive({ status: 'error', q: term, hits: [] })
      }
    }, DEBOUNCE)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term])

  // Under two characters the panel shows nothing, whatever the last request returned.
  const view: Live = term.length >= MIN_CHARS ? live : { status: 'idle', q: term, hits: [] }

  const announce =
    view.status === 'done'
      ? view.hits.length
        ? `${view.hits.length} résultat${view.hits.length > 1 ? 's' : ''} pour « ${view.q} »`
        : `Aucun résultat pour « ${view.q} »`
      : ''

  return (
    <>
      <button
        ref={triggerRef}
        data-search-trigger
        type="button"
        aria-label="Chercher"
        aria-expanded={open}
        aria-controls="vh-search-panel"
        aria-keyshortcuts="/ Control+K Meta+K"
        onClick={() => setOpen(true)}
        className="vh-icon-button-dark"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      <div data-search-root data-state={open ? 'open' : 'closed'} inert={!open} className="vh-overlay vh-overlay-search">
        <div className="vh-scrim vh-scrim-search" onClick={close} aria-hidden="true" />

        <div
          ref={surfaceRef}
          id="vh-search-panel"
          data-search-panel
          role="dialog"
          aria-modal="true"
          aria-label="Rechercher sur VH Magazine"
          tabIndex={-1}
          className="vh-search-panel text-ink outline-none"
        >
          <form role="search" action={STATIC_ROUTES.recherche} method="get" className="flex items-center gap-3 px-5 hairline-b">
            <SearchIcon className="h-5 w-5 shrink-0 text-ink-2" />
            <label htmlFor="vh-search-input" className="sr-only">
              Rechercher sur VH Magazine
            </label>
            <input
              ref={inputRef}
              id="vh-search-input"
              name="q"
              type="search"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="Rechercher un article…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="vh-search-input type-search"
            />
            <kbd className="vh-kbd type-micro hidden sm:inline-flex">Esc</kbd>
            <button type="button" aria-label="Fermer la recherche" onClick={close} className="vh-icon-button sm:hidden">
              <CloseIcon className="h-5 w-5" />
            </button>
          </form>

          <p role="status" aria-live="polite" className="sr-only">
            {announce}
          </p>

          {view.status === 'loading' && view.hits.length === 0 ? (
            <ul aria-hidden="true" className="space-y-1 p-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="vh-hit">
                  <span className="vh-skeleton h-12 w-12" />
                  <span className="vh-skeleton block h-4 w-2/3" />
                </li>
              ))}
            </ul>
          ) : null}

          {view.hits.length > 0 ? (
            <ul className="p-2">
              {view.hits.map((hit) => (
                <li key={hit.id}>
                  <Link data-search-hit href={hit.url} onClick={close} className="vh-hit">
                    <span className="relative block h-12 w-12 overflow-hidden bg-canvas-2">
                      {hit.thumb ? (
                        <Image src={hit.thumb} alt="" width={48} height={48} unoptimized className="h-12 w-12 object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="type-title-sm vh-clamp-2 text-ink">{hit.title}</span>
                      <span className="type-meta mt-1 block text-ink-2">
                        {[hit.category, hit.date].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              <li className="mt-1 hairline-t pt-1">
                <Link
                  data-search-all
                  href={`${STATIC_ROUTES.recherche}?q=${encodeURIComponent(view.q)}`}
                  onClick={close}
                  className="vh-hit type-copy-sm block font-semibold text-accent"
                >
                  Voir tous les résultats pour « {view.q} » ›
                </Link>
              </li>
            </ul>
          ) : null}

          {view.status === 'done' && view.hits.length === 0 ? (
            <p className="type-copy p-6 text-ink-2">Aucun résultat pour « {view.q} ».</p>
          ) : null}
          {view.status === 'error' ? (
            <p className="type-copy p-6 text-ink-2">La recherche instantanée est indisponible — appuyez sur Entrée.</p>
          ) : null}
        </div>
      </div>
    </>
  )
}
