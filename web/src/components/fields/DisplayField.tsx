import type { FieldProps } from './types'

const HTML_RE = /<[a-z][\s\S]*?>/i

export default function DisplayField({ question }: FieldProps) {
  const text = question.label || (question.default as string | undefined) || ''
  if (!text) return null
  if (HTML_RE.test(text)) {
    return (
      <div
        className="prose prose-sm max-w-none text-gray-700"
        // XFA form-authored HTML (exData contentType="text/html"), not user input
        dangerouslySetInnerHTML={{ __html: text }}
      />
    )
  }
  return <p className="text-sm text-gray-600">{text}</p>
}
