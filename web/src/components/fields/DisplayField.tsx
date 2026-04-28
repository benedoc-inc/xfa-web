import type { FieldProps } from './types'

export default function DisplayField({ question }: FieldProps) {
  const text = question.label || (question.default as string | undefined) || ''
  if (!text) return null
  return (
    <p className="text-sm text-gray-600">{text}</p>
  )
}
