'use server'

import { getPayloadClient } from '@/lib/payload'

/**
 * Newsletter signup (spec §5.4.3).
 *
 * Runs with `overrideAccess: true` on purpose: the collection denies public
 * creates so the REST API cannot be used to stuff the mailing list, and this
 * action is the single sanctioned write path.
 *
 * Resubmitting an existing address is a SUCCESS, not an error. The reader
 * cannot tell the difference and does not care, and reporting "already
 * subscribed" would leak whether a given address is on the list — a small but
 * free disclosure to avoid.
 */

export type NewsletterState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function subscribeToNewsletter(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const email = String(formData.get('email') || '')
    .trim()
    .toLowerCase()
  const source = String(formData.get('source') || 'homepage-sidebar')

  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Merci de saisir une adresse e-mail valide.' }
  }

  try {
    const payload = await getPayloadClient()

    const existing = await payload.find({
      collection: 'newsletter-subscribers',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'newsletter-subscribers',
        data: { email, source, confirmed: false },
        overrideAccess: true,
      })
    }

    return { status: 'success', message: 'Merci pour votre inscription!' }
  } catch (error) {
    console.error('newsletter subscribe failed', error)
    return {
      status: 'error',
      message: 'Une erreur est survenue. Merci de réessayer dans un instant.',
    }
  }
}

export type ContactState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

/**
 * Contact form submission (spec §7).
 *
 * The honeypot (rider) is a field no human sees and no human fills. When it
 * arrives non-empty the submission is discarded and reported as SUCCESS — a bot
 * told "rejected" learns to try again without the trap, so silence is the only
 * response that costs it anything.
 */
export async function submitContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const honeypot = String(formData.get('website') || '').trim()
  if (honeypot) {
    return { status: 'success', message: 'Merci, votre message a bien été envoyé.' }
  }

  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const subject = String(formData.get('subject') || '').trim()
  const message = String(formData.get('message') || '').trim()

  if (!name || !message) {
    return { status: 'error', message: 'Merci de renseigner votre nom et votre message.' }
  }
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Merci de saisir une adresse e-mail valide.' }
  }
  if (message.length > 5000) {
    return { status: 'error', message: 'Votre message est trop long (5000 caractères maximum).' }
  }

  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'contact-messages',
      data: { name, email, subject: subject || 'Sans objet', message },
      overrideAccess: true,
    })
    return { status: 'success', message: 'Merci, votre message a bien été envoyé.' }
  } catch (error) {
    console.error('contact submission failed', error)
    return { status: 'error', message: 'Une erreur est survenue. Merci de réessayer.' }
  }
}
