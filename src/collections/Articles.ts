import type { CollectionConfig } from 'payload'

import { canMutateOwnArticles, canReadArticles, isAdminOrEditor } from '../access'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { syncArticleRedirects } from '../hooks/redirects'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/**
 * The editorial core. Powers every homepage block (spec §5) plus the article and
 * category pages that land next round.
 *
 * Videos are articles, not a separate collection — that is how the live site is
 * organised (the "Vidéos" block reads the `video` category) and it keeps one
 * URL scheme, one search index and one "Derniers articles" list. `isVideo` drives
 * the play affordance and the embed; the category drives placement.
 */
export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'Article', plural: 'Articles' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', '_status'],
    group: 'Contenu',
  },
  access: {
    read: canReadArticles,
    create: ({ req: { user } }) => Boolean(user),
    update: canMutateOwnArticles,
    delete: isAdminOrEditor,
  },
  versions: {
    drafts: { autosave: false },
    maxPerDoc: 20,
  },
  hooks: {
    // Journalists may write but not publish. `_status` is synthesised by the
    // drafts feature and takes no field-level access control, so the guard has
    // to live here: force any publish attempt by a journalist back to draft
    // rather than rejecting the save and losing their work.
    beforeChange: [
      ({ data, req: { user } }) => {
        if (user?.role === 'journalist' && data?._status === 'published') {
          return { ...data, _status: 'draft' }
        }
        return data
      },
    ],
    // Order matters: record the URL change before invalidating the cache, so a
    // request that arrives on the freshly-purged page already has its redirect.
    afterChange: [syncArticleRedirects, revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    { name: 'title', type: 'text', label: 'Titre', required: true },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Chapô',
      maxLength: 320,
      admin: { description: 'Résumé court. Sert de méta description par défaut.' },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Image à la une',
      required: true,
      admin: { description: 'Format paysage 16:9 pour les cartes.' },
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Corps de l’article',
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Rubrique',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Détermine l’URL de l’article, y compris la rubrique parente.',
      },
    },
    {
      // WordPress files a post under several categories; its URL uses one. The others still list
      // it — on their category pages and in homepage blocks (People, Vidéos, Chroniques cigare…).
      name: 'secondaryCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      label: 'Autres rubriques',
      admin: {
        position: 'sidebar',
        description: 'L’article apparaît aussi dans ces rubriques, sans changer son URL.',
      },
    },
    {
      // The byline, as vh.ma prints it (distinct from `author`, the account that edits it).
      name: 'signature',
      type: 'relationship',
      relationTo: 'authors',
      label: 'Signature',
      admin: { position: 'sidebar' },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      label: 'Mots-clés',
      admin: { position: 'sidebar' },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      label: 'Auteur',
      admin: { position: 'sidebar' },
      defaultValue: ({ user }) => user?.id,
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Date de publication',
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy' },
      },
    },
    {
      name: 'isVideo',
      type: 'checkbox',
      label: 'Contenu vidéo',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'videoUrl',
      type: 'text',
      label: 'URL de la vidéo (YouTube)',
      admin: {
        position: 'sidebar',
        condition: (data) => Boolean(data?.isVideo),
      },
    },
    {
      name: 'viewCount',
      type: 'number',
      label: 'Vues',
      defaultValue: 0,
      index: true,
      // Ranks "Les plus lus". Seeded for now; the real counter is a later round.
      admin: { position: 'sidebar', readOnly: true },
    },
    // Globally unique, matching WordPress: the article route resolves on the
    // final path segment, so two articles sharing a slug under different
    // rubrics would be ambiguous.
    slugField('title', { unique: true }),
    seoField,
  ],
}
