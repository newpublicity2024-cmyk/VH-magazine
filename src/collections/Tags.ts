import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '../access'
import { slugField } from '../fields/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Mot-clé', plural: 'Mots-clés' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug'], group: 'Classement' },
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
    { name: 'name', type: 'text', label: 'Nom', required: true },
    slugField('name'),
  ],
}
