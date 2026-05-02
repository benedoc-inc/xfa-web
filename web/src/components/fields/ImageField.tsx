import type { FieldProps } from './types'

export default function ImageField({ question }: FieldProps) {
  const imageData = question.properties?.['image_data'] as string | undefined
  const imageHRef = question.properties?.['image_href'] as string | undefined
  const contentType = (question.properties?.['content_type'] as string | undefined) || 'image/jpeg'

  if (imageData) {
    // Inline base64 — XFA data may contain whitespace, strip before use in data URI.
    const clean = imageData.replace(/\s+/g, '')
    return (
      <img
        src={`data:${contentType};base64,${clean}`}
        alt={question.label || question.name}
        className="max-w-full h-auto"
      />
    )
  }

  if (imageHRef) {
    // Resource reference that couldn't be resolved server-side (e.g. external $rr: resource).
    // Show a compact placeholder so the user knows an image belongs here.
    return (
      <div
        className="flex items-center justify-center border border-dashed border-gray-200 rounded bg-gray-50 px-4 py-3 text-xs text-gray-400"
        title={imageHRef}
      >
        [image: {imageHRef.replace(/^\$rr:/, '')}]
      </div>
    )
  }

  return null
}
