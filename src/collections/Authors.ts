import type { CollectionConfig } from 'payload'

import { anyone, hiddenFromJournalists, isAdminOrEditor } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/**
 * Bylines, as vh.ma signs its posts ("La Rédaction", David Jérémie, Nadia Sefraoui… — 22 on
 * 2026-11-24). A signature is not an account: it carries no login, survives every archive push,
 * and keeps vh.ma's author archive at /author/<slug>/.
 */
export const Authors: CollectionConfig = {
  slug: 'authors',
  labels: { singular: 'Signature', plural: 'Signatures' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    group: 'Classement',
    hideAPIURL: true,
    hidden: hiddenFromJournalists,
  },
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    { name: 'name', type: 'text', label: 'Nom affiché', required: true },
    {
      name: 'slug',
      type: 'text',
      label: 'Identifiant',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'L’adresse de sa page : /author/<identifiant>/ (celle de vh.ma pour les signatures migrées).' },
    },
  ],
}
