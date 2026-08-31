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
      className="bg-ink px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-vh-red disabled:opacity-70"
    >
      {pending ? 'Envoi…' : 'Envoyer'}
    </button>
  )
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactMessage, INITIAL)

  const field = 'w-full border border-rule px-3 py-2.5 text-[14px] outline-none focus:border-ink'

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
        <label htmlFor="vh-name" className="mb-1 block text-[12px] font-semibold text-ink">Nom *</label>
        <input id="vh-name" name="name" required autoComplete="name" className={field} />
      </div>
      <div>
        <label htmlFor="vh-email" className="mb-1 block text-[12px] font-semibold text-ink">E-mail *</label>
        <input id="vh-email" name="email" type="email" required autoComplete="email" className={field} />
      </div>
      <div>
        <label htmlFor="vh-subject" className="mb-1 block text-[12px] font-semibold text-ink">Objet</label>
        <input id="vh-subject" name="subject" className={field} />
      </div>
      <div>
        <label htmlFor="vh-message" className="mb-1 block text-[12px] font-semibold text-ink">Message *</label>
        <textarea id="vh-message" name="message" required rows={6} className={field} />
      </div>

      <SubmitButton />

      <p
        data-contact-status
        role="status"
        aria-live="polite"
        className={`text-[13px] ${state.status === 'error' ? 'text-vh-red' : 'text-ink'} ${
          state.status === 'idle' ? 'hidden' : ''
        }`}
      >
        {state.message}
      </p>
    </form>
  )
}
