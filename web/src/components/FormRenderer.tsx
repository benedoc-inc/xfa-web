import { useCallback, useMemo, useState } from 'react'
import type { FormSchema, Question } from '../types/schema'
import { applyRules } from '../engine/rules'
import type { FormValues } from '../engine/rules'
import { exportForm } from '../api/client'
import { FieldRenderer } from './fields'

interface Props {
  schema: FormSchema
  initialValues: Record<string, string>
  pdfData: string
  password: string
  onBack: () => void
}

export default function FormRenderer({ schema, initialValues, pdfData, password, onBack }: Props) {
  const [userValues, setUserValues] = useState<FormValues>(initialValues)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const initialHidden = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const q of schema.questions) m[q.id] = q.hidden
    return m
  }, [schema.questions])

  const { states, computed } = useMemo(
    () => applyRules(schema.rules, userValues, schema.questions, initialHidden),
    [schema.rules, schema.questions, userValues, initialHidden],
  )

  const effectiveValues: FormValues = useMemo(
    () => ({ ...userValues, ...computed }),
    [userValues, computed],
  )

  const handleChange = useCallback((id: string, value: string) => {
    setUserValues(prev => ({ ...prev, [id]: value }))
  }, [])

  async function handleExport() {
    setIsExporting(true)
    setExportError(null)
    try {
      const blob = await exportForm(pdfData, effectiveValues, password || undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = schema.metadata.title ? `${schema.metadata.title}.pdf` : 'filled_form.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  // Group visible questions by section (falling back to page number)
  const sections = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, Question[]>()
    for (const q of schema.questions) {
      if (states[q.id]?.hidden) continue
      const key = q.section || `Page ${q.page_number || 1}`
      if (!map.has(key)) { map.set(key, []); order.push(key) }
      map.get(key)!.push(q)
    }
    return order.map(k => [k, map.get(k)!] as [string, Question[]])
  }, [schema.questions, states])

  const multiSection = sections.length > 1

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {schema.metadata.title || 'Form'}
          </h1>
          {schema.metadata.description && (
            <p className="mt-1 text-sm text-gray-500">{schema.metadata.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-400 uppercase tracking-wide">
            {schema.metadata.form_type} · {schema.metadata.total_pages} page{schema.metadata.total_pages !== 1 ? 's' : ''} · {schema.questions.length} fields
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Upload another
        </button>
      </div>

      {sections.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">
          No visible fields. Fill in any required fields above to reveal more.
        </p>
      )}

      {sections.map(([sectionName, questions]) => (
        <div key={sectionName}>
          {multiSection && (
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-200">
              {sectionName}
            </h2>
          )}
          <div className="space-y-5">
            {questions.map(q => {
              const state = states[q.id] ?? { hidden: false, disabled: false, computed: false }
              const validation = validateField(q, effectiveValues[q.id] ?? '')
              return (
                <div key={q.id}>
                  <FieldRenderer
                    question={q}
                    value={effectiveValues[q.id] ?? ''}
                    onChange={v => handleChange(q.id, v)}
                    disabled={state.disabled || state.computed}
                    errors={validation ? [validation] : []}
                  />
                  {state.computed && (
                    <p className="mt-1 text-xs text-gray-400">Calculated automatically</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="pt-4 border-t border-gray-200 space-y-3">
        {exportError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {exportError}
          </p>
        )}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? 'Generating PDF…' : 'Download Filled PDF'}
        </button>
      </div>
    </div>
  )
}

function validateField(q: Question, value: string): string | null {
  if (q.required && !value.trim()) return q.validation?.error_message || 'This field is required.'
  if (!value || !q.validation) return null
  const v = q.validation
  if (v.min_length !== undefined && value.length < v.min_length)
    return `Minimum ${v.min_length} characters.`
  if (v.max_length !== undefined && value.length > v.max_length)
    return `Maximum ${v.max_length} characters.`
  if (v.min_value !== undefined && parseFloat(value) < v.min_value)
    return `Minimum value is ${v.min_value}.`
  if (v.max_value !== undefined && parseFloat(value) > v.max_value)
    return `Maximum value is ${v.max_value}.`
  if (v.pattern) {
    try {
      if (!new RegExp(v.pattern).test(value)) return v.error_message || 'Invalid format.'
    } catch { /* ignore bad pattern */ }
  }
  return null
}
