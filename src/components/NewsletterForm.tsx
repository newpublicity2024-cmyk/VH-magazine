'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { subscribeToNewsletter, type NewsletterState } from '@/lib/actions'

/**
 * Newsletter signup box (spec §5.4.3), with the three states the spec names:
 * idle, loading ("Please wait...") and success ("Merci pour votre inscription!").
 *
 * Built on useActionState so it degrades to a plain form post without JS — the
 * signup still works, it just reloads. The status region is `aria-live` so the
 * outcome is announced rather than only shown.
 */

const INITIAL: NewsletterState = { status: 'idle', message: '' }

function SubmitButton() {
  // Must be a child of <form> for useFormStatus to see the pending state.
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-vh-red px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-vh-red-dark disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? 'Please wait...' : 'Je m’inscris'}
    </button>
  )
}

export function NewsletterForm({ source = 'homepage-sidebar' }: { source?: string }) {
  const [state, formAction] = useActionState(subscribeToNewsletter, INITIAL)

  return (
    <form data-newsletter-form action={formAction} className="border border-rule p-4">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.08em] text-ink">
        VH Newsletter
      </h2>
      <p className="mt-2 text-[12px] leading-relaxed text-meta">
        Chaque samedi, recevez l’actu culture, bien-être et lifestyle directement dans votre boite
        mail
      </p>

      <input type="hidden" name="source" value={source} />

      <label htmlFor="vh-newsletter-email" className="sr-only">
        Adresse e-mail
      </label>
      <input
        id="vh-newsletter-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Votre adresse e-mail"
        className="mt-3 w-full border border-rule px-3 py-2.5 text-[13px] outline-none focus:border-ink"
      />

      <div className="mt-2.5">
        <SubmitButton />
      </div>

      {/* Always mounted so assistive tech is watching before the result lands;
          only rendered visibly once there is something to say. */}
      <p
        data-newsletter-status
        role="status"
        aria-live="polite"
        className={`mt-2.5 text-[12px] ${
          state.status === 'error' ? 'text-vh-red' : 'text-ink'
        } ${state.status === 'idle' ? 'hidden' : ''}`}
      >
        {state.message}
      </p>
    </form>
  )
}
