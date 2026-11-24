import type { WidgetServerProps } from 'payload'

import type { User } from '@/payload-types'

import { Card, Icons, isEditorial } from './shared'

/**
 * How an article gets from an idea to the site, in the reader's own role. These ARE a
 * sequence, so they are numbered. Advisory only — the rules live in the Articles hooks.
 */
export default function Guide({ req }: WidgetServerProps) {
  const user = req.user as User | null
  if (!user) return null
  const editorial = isEditorial(user)

  const steps = editorial
    ? [
        { title: 'Ouvrez l’article', text: 'Depuis « À relire » ou la liste des articles.' },
        {
          title: 'Relisez et complétez',
          text: 'Titre, chapô, image à la une, rubrique. L’aperçu montre l’article tel qu’il paraîtra.',
        },
        {
          title: 'Publiez',
          text: 'Bouton « Publier » en haut à droite. La date est celle de la publication si le champ est vide.',
        },
      ]
    : [
        {
          title: 'Écrivez',
          text: 'Le titre, puis le texte. Tout s’enregistre automatiquement pendant que vous écrivez.',
        },
        {
          title: 'Ajoutez l’image et la rubrique',
          text: 'Dans la colonne de droite : l’image à la une, la rubrique et, si vous voulez, des mots-clés.',
        },
        {
          title: 'Soumettez pour relecture',
          text: 'Bouton en haut à droite. La rédaction en chef relit et publie ; l’article apparaît alors dans « Mes derniers articles publiés ».',
        },
      ]

  return (
    <Card
      id="vh-guide"
      title={editorial ? 'Relire et publier' : 'Comment publier un article'}
      icon={<Icons.pen />}
    >
      <ol className="vhb-steps">
        {steps.map((s, i) => (
          <li key={s.title} className="vhb-step">
            <span className="vhb-step__num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="vhb-step__body">
              <strong className="vhb-step__title">{s.title}</strong>
              <span className="vhb-step__text">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}
