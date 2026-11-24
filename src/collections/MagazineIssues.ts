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
    {
      // Since N°202, vh.ma publishes an issue as an ordinary Actu post (categories sommaire +
      // actualite) instead of a /sommaire/ post. Its page is that article: issueUrl() points
      // there, and /sommaire/<slug>/ 301s to it.
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      label: 'Article du numéro',
      admin: {
        position: 'sidebar',
        description: 'Si le numéro est présenté par un article, son lien mène à cet article.',
      },
    },
    {
      // vh.ma ranks issue posts among "Les plus lus" (N°198 is there). Imported from vh.ma's own
      // counter; read-only like an article's.
      name: 'viewCount',
      type: 'number',
      label: 'Vues',
      defaultValue: 0,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    slugField('title', { reserved: true }),
    seoField,
  ],
}
