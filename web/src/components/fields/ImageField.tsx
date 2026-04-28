import type { FieldProps } from './types'

export default function ImageField({ question }: FieldProps) {
  const imageData = question.properties?.['image_data'] as string | undefined
  const contentType = (question.properties?.['content_type'] as string | undefined) || 'image/jpeg'
  if (!imageData) return null
  // XFA base64 data may contain whitespace — strip before use in data URI
  const clean = imageData.replace(/\s+/g, '')
  return (
    <img
      src={`data:${contentType};base64,${clean}`}
      alt={question.label || question.name}
      className="max-w-full h-auto"
    />
  )
}
