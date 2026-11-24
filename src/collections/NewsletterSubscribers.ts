import type { CollectionConfig } from 'payload'

import { hiddenFromJournalists, isAdminOrEditor } from '../access'

/**
 * Newsletter signups (spec §5.4.3).
 *
 * `read` is admin/editor only — a public read would expose the whole mailing
 * list through the REST API. Creation happens exclusively through the server
 * action in lib/actions.ts, using `overrideAccess`, so the collection itself
 * stays closed to anonymous writes.
 *
 * `confirmed` is present but unused: double opt-in is a later concern, and
 * backfilling the column later would mean a migration for no reason.
 */
export const NewsletterSubscribers: CollectionConfig = {
  slug: 'newsletter-subscribers',
  labels: { singular: 'Abonné', plural: 'Abonnés newsletter' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'source', 'confirmed', 'createdAt'],
    group: 'Lecteurs',
    hideAPIURL: true,
    hidden: hiddenFromJournalists,
  },
  access: {
    read: isAdminOrEditor,
    create: () => false,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      label: 'Adresse e-mail',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'source',
      type: 'text',
      label: 'Origine',
      defaultValue: 'homepage-sidebar',
      admin: { description: 'Où le formulaire a été soumis.' },
    },
    {
      name: 'confirmed',
      type: 'checkbox',
      label: 'Confirmé (double opt-in)',
      defaultValue: false,
    },
  ],
}
