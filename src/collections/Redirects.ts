import type { CollectionConfig } from 'payload'

import { anyone, hiddenFromJournalists, isAdminOrEditor } from '../access'

/**
 * 301/302 map. Populated two ways:
 *   - automatically, by hooks/redirects.ts, when a published article's URL changes;
 *   - by hand, for the WordPress URLs that will not survive the migration.
 *
 * NOTE: nothing consumes this collection yet. Middleware that reads it is a
 * later-round task — the collection and its auto-population land now so the
 * schema is settled in one migration and no URL change goes unrecorded in the
 * meantime.
 */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'Redirection', plural: 'Redirections' },
  admin: {
    useAsTitle: 'from',
    defaultColumns: ['from', 'to', 'permanent', 'source'],
    group: 'Réglages',
    hideAPIURL: true,
    hidden: hiddenFromJournalists,
    description: 'Ancienne URL → nouvelle URL. Créées automatiquement au changement de slug.',
  },
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      label: 'Ancienne URL',
      required: true,
      index: true,
      unique: true,
      admin: { description: 'Chemin absolu, avec slash final : /moteur/ancien-slug/' },
    },
    {
      name: 'to',
      type: 'text',
      label: 'Nouvelle URL',
      required: true,
      index: true,
    },
    {
      name: 'permanent',
      type: 'checkbox',
      label: 'Permanente (301)',
      defaultValue: true,
    },
    {
      name: 'source',
      type: 'select',
      label: 'Origine',
      defaultValue: 'manual',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Manuelle', value: 'manual' },
        { label: 'Automatique (changement de slug)', value: 'auto' },
        { label: 'Migration WordPress', value: 'migration' },
      ],
    },
  ],
}
