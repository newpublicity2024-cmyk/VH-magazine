import type { Field } from 'payload'

/** Per-document SEO overrides. Empty fields fall back to the document's own title/excerpt. */
export const seoField: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  admin: { position: 'sidebar' },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Titre SEO',
      admin: { description: 'Par défaut : le titre du document.' },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Méta description',
      maxLength: 200,
      admin: { description: 'Par défaut : le chapô.' },
    },
    {
      name: 'canonicalURL',
      type: 'text',
      label: 'URL canonique (override)',
      admin: { description: 'Laisser vide : la page est sa propre canonique.' },
    },
    {
      name: 'noIndex',
      type: 'checkbox',
      label: 'Ne pas indexer',
      defaultValue: false,
    },
  ],
}
