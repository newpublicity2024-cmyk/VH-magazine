'use client'

import { useAuth } from '@payloadcms/ui'

/**
 * Two sentences at the top of the article form for journalists: what to do, and what
 * happens on its own. Editors and admins know the system and get their screen untouched.
 */
export default function WriterGuide() {
  const { user } = useAuth()
  if (!user || user.role !== 'journalist') return null

  return (
    <aside className="vhb-writer-guide" data-writer-guide aria-label="Mode d’emploi">
      <p className="vhb-writer-guide__title">Écrivez, la machine s’occupe du reste</p>
      <p>
        Saisissez le titre puis le texte ; ajoutez l’image à la une et la rubrique dans la colonne
        de droite. Votre travail s’enregistre automatiquement. L’adresse de la page, la date et le
        référencement sont réglés pour vous.
      </p>
      <p className="vhb-writer-guide__byline">
        Signé : <strong>{user.name || user.email}</strong>
      </p>
    </aside>
  )
}
