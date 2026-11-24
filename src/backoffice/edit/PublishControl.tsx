'use client'

import {
  FormSubmit,
  PublishButton,
  useAuth,
  useConfig,
  useDocumentInfo,
  useForm,
  useFormFields,
} from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { useCallback } from 'react'

/**
 * The publish slot of the article screen, by role.
 *
 * Editors and admins get Payload's own « Publier ». A journalist cannot publish (the
 * Articles hook would turn the save back into a draft anyway), so showing them that button
 * would only produce a draft and a false sense of having published. They get WordPress's
 * Contributor button instead: « Soumettre pour relecture » saves the draft with
 * `reviewState: 'pending'`, which puts it in the editors' « À relire » queue.
 *
 * The submission is a DRAFT save — exactly what Payload's own « Enregistrer le brouillon »
 * sends (ui/elements/SaveDraftButton), plus the flag — so it never touches the live row.
 * Completeness is judged by the server (articleWorkflow.ts): a missing title, rubric, cover
 * image or text comes back as field errors on those fields.
 */
export default function PublishControl() {
  const { user } = useAuth()
  if (user?.role === 'journalist') return <SubmitForReviewButton />
  return <PublishButton />
}

function SubmitForReviewButton() {
  const {
    config: {
      routes: { api },
    },
  } = useConfig()
  const { id, collectionSlug, setUnpublishedVersionCount, uploadStatus } = useDocumentInfo()
  const { submit } = useForm()
  const pending = useFormFields(([fields]) => fields?.reviewState?.value === 'pending')

  const submitForReview = useCallback(async () => {
    if (!collectionSlug) return
    const action = formatAdminURL({
      apiRoute: api,
      path: `/${collectionSlug}${id ? `/${id}` : ''}?depth=0&fallback-locale=null&draft=true`,
    })
    await submit({
      action,
      method: id ? 'PATCH' : 'POST',
      overrides: { _status: 'draft', reviewState: 'pending' },
      skipValidation: true,
    })
    setUnpublishedVersionCount?.((count: number) => count + 1)
  }, [api, collectionSlug, id, setUnpublishedVersionCount, submit])

  return (
    <FormSubmit
      buttonId="action-submit-review"
      className="vhb-submit-review"
      disabled={uploadStatus === 'uploading'}
      onClick={() => void submitForReview()}
      size="medium"
      type="button"
    >
      {pending ? 'Renvoyer pour relecture' : 'Soumettre pour relecture'}
    </FormSubmit>
  )
}
