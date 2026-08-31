import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '../access'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/**
 * Editorial taxonomy — and, crucially, part of the URL.
 *
 * `parent` is load-bearing, not decorative: live vh.ma article URLs carry the
 * full WordPress hierarchy, so an article under `vh-moteur` (child of `moteur`)
 * lives at /moteur/vh-moteur/{slug}/ while one under a top-level category lives
 * at /{category}/{slug}/. lib/routes.ts walks this chain to build both shapes.
 *
 * Slugs are reserved-checked because a top-level category shares its namespace
 * with every static route (article URLs are rooted, not prefixed).
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Rubrique', plural: 'Rubriques' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'parent', 'slug'],
    group: 'Classement',
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
    { name: 'name', type: 'text', label: 'Nom', required: true },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Rubrique parente',
      admin: {
        position: 'sidebar',
        description: 'Ajoute un segment à l’URL : moteur → moteur/vh-moteur.',
      },
      // A category that is its own ancestor would make categoryPath() spin; the
      // pure walker caps depth defensively, but block the obvious case here.
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
    },
    slugField('name', { reserved: true }),
    seoField,
  ],
}
