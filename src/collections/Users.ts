import type { CollectionConfig } from 'payload'

import { hiddenFromJournalists, isAdmin, isAdminFieldLevel, isAdminOrSelf } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Utilisateur', plural: 'Utilisateurs' },
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Réglages',
    hideAPIURL: true,
    // A journalist reaches their own profile through « Mon compte » (/admin/account).
    hidden: hiddenFromJournalists,
  },
  access: {
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
    admin: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nom',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Rôle',
      required: true,
      defaultValue: 'journalist',
      // Field-level admin lock: without this a journalist could PATCH their own
      // user document and promote themselves, since isAdminOrSelf grants update.
      access: { create: isAdminFieldLevel, update: isAdminFieldLevel },
      options: [
        { label: 'Administrateur', value: 'admin' },
        { label: 'Rédacteur en chef', value: 'editor' },
        { label: 'Journaliste', value: 'journalist' },
      ],
    },
  ],
}
