'use client'

import { useEffect, useRef, useState } from 'react'

const DURATION = 2500

/** Show a toast from anywhere: `toast('Lien copié')`. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent('vh:toast', { detail: message }))
}

/**
 * The one toast region (DESIGN-SPEC-R3 §3.6): a dark-material pill, bottom centre, 2.5 s,
 * `role="status"` so the message is announced. Mounted once in the layout and always
 * present, so screen readers are already watching it when a message lands.
 */
export function Toaster() {
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onToast = (event: Event) => {
      setMessage(String((event as CustomEvent).detail ?? ''))
      setOpen(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setOpen(false), DURATION)
    }
    window.addEventListener('vh:toast', onToast)
    return () => {
      window.removeEventListener('vh:toast', onToast)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div data-toast role="status" aria-live="polite" data-state={open ? 'open' : 'closed'} className="vh-toast type-copy-sm">
      {message}
    </div>
  )
}
