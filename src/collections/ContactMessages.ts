import type { CollectionConfig } from 'payload'

import { hiddenFromJournalists, isAdminOrEditor } from '../access'

/**
 * Contact form submissions (spec §7).
 *
 * The /contact/ page is a later round; the collection lands now so the schema
 * settles in one migration. Closed to public reads and writes for the same
 * reason as the newsletter — the form will submit through a server action.
 */
export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  labels: { singular: 'Message', plural: 'Messages de contact' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['name', 'email', 'subject', 'createdAt'],
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
    { name: 'name', type: 'text', label: 'Nom', required: true },
    { name: 'email', type: 'email', label: 'Adresse e-mail', required: true },
    { name: 'subject', type: 'text', label: 'Objet', required: true },
    { name: 'message', type: 'textarea', label: 'Message', required: true },
  ],
}
