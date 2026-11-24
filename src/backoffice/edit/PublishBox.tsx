'use client'

import { useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'

import { lexicalPlainText, missingForReview, unplayableLinks, wordCount } from '../../lib/review'

const NEWSROOM_TZ = 'Africa/Casablanca'

const when = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: NEWSROOM_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * The sidebar's « Publier » box, as in WordPress: where the article stands, when it goes
 * out, and what is still missing.
 *
 * Read-only — it writes nothing. The status comes from the form and the document info
 * (`hasPublishedDoc`: a live version exists); the checklist is `missingForReview`, the SAME
 * function the server uses to refuse an incomplete « Soumettre pour relecture », so the
 * ticks and the refusal can never disagree.
 */
export default function PublishBox() {
  const { user } = useAuth()
  const { hasPublishedDoc } = useDocumentInfo()
  const [title, category, featuredImage, body, reviewState, status, publishedAt] = useFormFields(
    ([f]) => [
      f?.title?.value,
      f?.category?.value,
      f?.featuredImage?.value,
      f?.body?.value,
      f?.reviewState?.value,
      f?._status?.value,
      f?.publishedAt?.value,
    ],
  )

  const journalist = user?.role === 'journalist'
  const missing = new Set(
    missingForReview({ title, category, featuredImage, body }).map((m) => m.check),
  )
  const words = wordCount(lexicalPlainText(body))
  const scheduled = when(publishedAt)

  let state: { label: string; tone: 'draft' | 'pending' | 'live' | 'edit' }
  if (status === 'published') state = { label: 'Publié', tone: 'live' }
  else if (reviewState === 'pending') state = { label: 'En attente de relecture', tone: 'pending' }
  else if (hasPublishedDoc) state = { label: 'Publié · modifications non publiées', tone: 'edit' }
  else state = { label: 'Brouillon', tone: 'draft' }

  const checks: Array<{ key: string; label: string; done: boolean }> = [
    { key: 'title', label: 'Un titre', done: !missing.has('title') },
    {
      key: 'body',
      label: words > 0 ? `Le texte (${words} mot${words > 1 ? 's' : ''})` : 'Le texte',
      done: !missing.has('body'),
    },
    { key: 'category', label: 'Une rubrique', done: !missing.has('category') },
    { key: 'featuredImage', label: 'L’image à la une', done: !missing.has('featuredImage') },
  ]
  // Only when it fails: a line that is always ticked would teach writers to skip the list.
  const badLinks = unplayableLinks(body).length
  if (badLinks > 0) {
    checks.push({
      key: 'links',
      label: `${badLinks} lien${badLinks > 1 ? 's' : ''} vidéo non reconnu${badLinks > 1 ? 's' : ''}`,
      done: false,
    })
  }
  const ready = checks.every((c) => c.done)

  return (
    <div className="vhb-publishbox" data-publishbox>
      <h3 className="vhb-publishbox__title">Publier</h3>
      <dl className="vhb-publishbox__facts">
        <div>
          <dt>État</dt>
          <dd>
            <span className={`vhb-pill vhb-pill--${state.tone}`} data-state={state.tone}>
              {state.label}
            </span>
          </dd>
        </div>
        <div>
          <dt>Visibilité</dt>
          <dd>{status === 'published' || hasPublishedDoc ? 'Public' : 'Pas encore sur le site'}</dd>
        </div>
        <div>
          <dt>Publication</dt>
          <dd>
            {scheduled
              ? status === 'published' || hasPublishedDoc
                ? `Le ${scheduled}`
                : `Datée du ${scheduled}`
              : journalist
                ? 'Quand la rédaction en chef publie'
                : 'Immédiatement, à la publication'}
          </dd>
        </div>
        {journalist && (
          <div>
            <dt>Auteur</dt>
            <dd>{user?.name || user?.email}</dd>
          </div>
        )}
      </dl>

      <p className="vhb-publishbox__subtitle">
        {ready ? 'Prêt' : journalist ? 'Avant de soumettre' : 'Avant de publier'}
      </p>
      <ul className="vhb-checklist" aria-label="Éléments requis">
        {checks.map((c) => (
          <li key={c.key} className={c.done ? 'is-done' : ''} data-check={c.key} data-done={c.done}>
            <span className="vhb-checklist__mark" aria-hidden="true" />
            <span>{c.label}</span>
            <span className="vhb-sr">{c.done ? ' — fait' : ' — à faire'}</span>
          </li>
        ))}
      </ul>
      {journalist && (
        <p className="vhb-publishbox__hint">
          {reviewState === 'pending'
            ? 'La rédaction en chef a reçu votre article. Vous pouvez encore le modifier : vos changements s’enregistrent.'
            : 'Quand tout est coché, cliquez sur « Soumettre pour relecture » en haut de la page.'}
        </p>
      )}
    </div>
  )
}
