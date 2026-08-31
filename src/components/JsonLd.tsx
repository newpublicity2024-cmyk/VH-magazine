/**
 * Emit a JSON-LD block.
 *
 * The payload is serialised with `<` escaped: a title containing `</script>`
 * would otherwise close the tag early and inject markup. JSON.stringify does not
 * escape it, so this is the one place it must be done by hand.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      data-jsonld
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
