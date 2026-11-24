import type { CollectionConfig, Field } from 'payload'

import {
  canDeleteArticles,
  canMutateOwnArticles,
  canReadArticles,
  isAdminOrEditorFieldLevel,
} from '../access'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { editorialOnly } from '../fields/visibility'
import { applyArticleWorkflow, markDraftWrite, revalidateArticle } from '../hooks/articleWorkflow'
import { syncArticleRedirects } from '../hooks/redirects'
import { revalidateAfterDelete } from '../hooks/revalidate'
import { REVIEW_LABELS, REVIEW_STATES } from '../lib/review'

/**
 * The editorial core. Powers every homepage block (spec §5) plus the article and
 * category pages.
 *
 * Videos are articles, not a separate collection — that is how the live site is
 * organised (the "Vidéos" block reads the `video` category) and it keeps one
 * URL scheme, one search index and one "Derniers articles" list. `isVideo` drives
 * the play affordance and the embed; the category drives placement.
 *
 * Back office (GATES-BACKOFFICE.md): the edit screen is laid out like WordPress's — title,
 * text and chapô in the main column; a « Publier » box, rubric, keywords and cover image in
 * the sidebar. A journalist sees only what they decide; slug, SEO, author, date and views are
 * editorial (`editorialOnly`) and set automatically. Every rule behind the screen lives in
 * hooks/articleWorkflow.ts.
 */

/** Editorial-only variants of the shared fields: same config, hidden from journalists. */
const editorialField = (field: Field): Field =>
  ({ ...field, admin: { ...(field.admin ?? {}), condition: editorialOnly } }) as Field

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'Article', plural: 'Articles' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'category', '_status', 'reviewState', 'publishedAt'],
    group: 'Rédaction',
    hideAPIURL: true,
    listSearchableFields: ['title', 'slug'],
    // « Aperçu »: the latest version — draft included — as the site would show it. Relative,
    // so it opens on the admin's own origin, where the editor's session cookie lives.
    preview: (doc) => (doc?.id ? `/apercu/${doc.id}/` : null),
    components: {
      beforeListTable: ['/backoffice/list/StatusLinks#default'],
      // Journalists get « Soumettre pour relecture »; editors keep Payload's own button.
      edit: { PublishButton: '/backoffice/edit/PublishControl#default' },
    },
  },
  access: {
    read: canReadArticles,
    create: ({ req: { user } }) => Boolean(user),
    update: canMutateOwnArticles,
    delete: canDeleteArticles,
  },
  versions: {
    drafts: {
      // WordPress autosaves; so does lallafatema. Every autosave is a draft write, which
      // touches only the version table and therefore never purges the site cache
      // (revalidateArticle). The « Enregistrer le brouillon » button stays for writers who
      // like to press it.
      autosave: { interval: 2000, showSaveDraftButton: true },
    },
    maxPerDoc: 20,
  },
  hooks: {
    beforeOperation: [markDraftWrite],
    // Journalists may write but not publish, own every article they write, and must hand in
    // a complete article for review; publishing dates the article. See articleWorkflow.ts.
    beforeChange: [applyArticleWorkflow],
    // Order matters: record the URL change before invalidating the cache, so a
    // request that arrives on the freshly-purged page already has its redirect.
    afterChange: [syncArticleRedirects, revalidateArticle],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    {
      name: 'writerGuide',
      type: 'ui',
      admin: { components: { Field: '/backoffice/edit/WriterGuide#default' } },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Titre',
      required: true,
      admin: { placeholder: 'Saisissez le titre' },
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Texte de l’article',
      admin: {
        description:
          'Collez un lien YouTube sur une ligne vide pour insérer la vidéo. Le bouton « + » ajoute une image, une galerie photos ou un tableau.',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Chapô',
      maxLength: 320,
      admin: {
        description:
          'Deux ou trois phrases qui donnent envie de lire. Il apparaît sous le titre et sert de description dans Google.',
      },
    },

    // ── Sidebar, in WordPress order ─────────────────────────────────────────
    {
      name: 'publishBox',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '/backoffice/edit/PublishBox#default' },
      },
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
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      label: 'Mots-clés',
      admin: { position: 'sidebar' },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Image à la une',
      required: true,
      admin: { position: 'sidebar', description: 'Format paysage 16:9 pour les cartes.' },
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
      name: 'reviewState',
      type: 'select',
      label: 'Relecture',
      defaultValue: 'none',
      options: REVIEW_STATES.map((value) => ({ label: REVIEW_LABELS[value], value })),
      admin: {
        position: 'sidebar',
        // Journalists set it with « Soumettre pour relecture »; editors may clear it here.
        condition: editorialOnly,
        components: { Cell: '/backoffice/list/ReviewStateCell#default' },
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      label: 'Auteur',
      // A privilege boundary, so field access AND the workflow hook (which forces a
      // journalist's own id on every write) — `condition` below only hides it.
      access: { update: isAdminOrEditorFieldLevel },
      admin: { position: 'sidebar', condition: editorialOnly },
      defaultValue: ({ user }) => user?.id,
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Date de publication',
      index: true,
      // Not `required`: a draft has no date until it is published (« Publier
      // immédiatement »). The workflow hook guarantees every published article has one, and
      // Payload validates `required` in the browser BEFORE that hook could stamp it.
      admin: {
        position: 'sidebar',
        condition: editorialOnly,
        date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' },
        description: 'Laisser vide : la date sera celle de la publication.',
      },
    },
    {
      name: 'viewCount',
      type: 'number',
      label: 'Vues',
      defaultValue: 0,
      index: true,
      // Ranks "Les plus lus"; incremented by /api/view with SQL on the main row.
      admin: { position: 'sidebar', readOnly: true, condition: editorialOnly },
    },
    // Globally unique, matching WordPress: the article route resolves on the
    // final path segment, so two articles sharing a slug under different
    // rubrics would be ambiguous.
    editorialField(
      slugField('title', {
        unique: true,
        followSourceUntilPublished: true,
        description:
          'Suit le titre jusqu’à la première publication. Le modifier ensuite crée une redirection.',
      }),
    ),
    editorialField(seoField),
  ],
}
