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
      className="vh-button-solid type-button w-full"
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="vh-spinner" />
          Please wait...
        </>
      ) : (
        'Je m’inscris'
      )}
    </button>
  )
}

export function NewsletterForm({ source = 'homepage-sidebar' }: { source?: string }) {
  const [state, formAction] = useActionState(subscribeToNewsletter, INITIAL)

  return (
    <form data-newsletter-form action={formAction} className="p-6 hairline-box">
      <h2 className="type-label text-ink">VH Newsletter</h2>
      <p className="type-copy-sm mt-2 text-ink-2">
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
        className="vh-input type-copy mt-4"
      />

      <div className="mt-3">
        <SubmitButton />
      </div>

      {/* Always mounted so assistive tech is watching before the result lands;
          only rendered visibly once there is something to say. */}
      <p
        data-newsletter-status
        role="status"
        aria-live="polite"
        className={`type-copy-sm mt-3 text-ink ${state.status === 'error' ? 'font-semibold' : ''} ${
          state.status === 'idle' ? 'hidden' : ''
        }`}
      >
        {state.message}
      </p>
    </form>
  )
}
