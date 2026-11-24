import type { CollectionConfig } from 'payload'

import { anyone, hiddenFromJournalists, isAdminOrEditor } from '../access'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/** Printed issues — the "Les Unes" archive and the homepage "Toutes nos unes" row (spec §5.13). */
export const MagazineIssues: CollectionConfig = {
  slug: 'magazine-issues',
  labels: { singular: 'Numéro', plural: 'Numéros du magazine' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['number', 'title', 'publishedAt'],
    group: 'Rédaction',
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
  defaultSort: '-number',
  fields: [
    {
      name: 'number',
      type: 'number',
      label: 'Numéro',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'title', type: 'text', label: 'Titre', required: true },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: 'Couverture',
      required: true,
      admin: { description: 'Format portrait 3:4.' },
    },
    { name: 'summary', type: 'textarea', label: 'Sommaire' },
    {
      name: 'pdf',
      type: 'upload',
      relationTo: 'media',
      label: 'PDF du numéro',
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Date de parution',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' },
      },
    },
    slugField('title', { reserved: true }),
    seoField,
  ],
}
