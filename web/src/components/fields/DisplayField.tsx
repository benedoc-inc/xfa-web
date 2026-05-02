import type { CSSProperties } from 'react'
import type { FieldProps } from './types'

const HTML_RE = /<[a-z][\s\S]*?>/i

export default function DisplayField({ question }: FieldProps) {
  const text = question.label || (question.default as string | undefined) || ''
  if (!text) return null

  const style: CSSProperties = {}
  const p = question.properties
  if (p?.['text_align']) style.textAlign = p['text_align'] as CSSProperties['textAlign']
  if (p?.['font_size']) style.fontSize = p['font_size'] as string
  if (p?.['font_weight']) style.fontWeight = p['font_weight'] as CSSProperties['fontWeight']

  if (HTML_RE.test(text)) {
    return (
      <div
        style={style}
        className="prose prose-sm max-w-none text-gray-700"
        // XFA form-authored HTML (exData contentType="text/html"), not user input
        dangerouslySetInnerHTML={{ __html: text }}
      />
    )
  }
  return <p style={style} className="text-sm text-gray-600">{text}</p>
}
