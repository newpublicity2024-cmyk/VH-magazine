'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { submitContactMessage, type ContactState } from '@/lib/actions'

const INITIAL: ContactState = { status: 'idle', message: '' }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="vh-button-solid type-button"
    >
      {pending ? 'Envoi…' : 'Envoyer'}
    </button>
  )
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactMessage, INITIAL)

  const field = 'vh-input type-copy'

  return (
    <form data-contact-form action={formAction} className="max-w-xl space-y-4">
      {/*
        Honeypot. Hidden from sight and from assistive tech, and removed from the
        tab order, so no human can reach it — anything that fills it is a bot.
        Not `type="hidden"`: bots skip those, which is the whole point.
      */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="vh-website">Ne pas remplir</label>
        <input id="vh-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="vh-name" className="type-copy-sm mb-2 block font-semibold text-ink">Nom *</label>
        <input id="vh-name" name="name" required autoComplete="name" className={field} />
      </div>
      <div>
        <label htmlFor="vh-email" className="type-copy-sm mb-2 block font-semibold text-ink">E-mail *</label>
        <input id="vh-email" name="email" type="email" required autoComplete="email" className={field} />
      </div>
      <div>
        <label htmlFor="vh-subject" className="type-copy-sm mb-2 block font-semibold text-ink">Objet</label>
        <input id="vh-subject" name="subject" className={field} />
      </div>
      <div>
        <label htmlFor="vh-message" className="type-copy-sm mb-2 block font-semibold text-ink">Message *</label>
        <textarea id="vh-message" name="message" required rows={6} className={field} />
      </div>

      <SubmitButton />

      <p
        data-contact-status
        role="status"
        aria-live="polite"
        className={`type-copy-sm text-ink ${state.status === 'error' ? 'font-semibold' : ''} ${
          state.status === 'idle' ? 'hidden' : ''
        }`}
      >
        {state.message}
      </p>
    </form>
  )
}
