import type { Question } from '../types/schema'
import type { FieldState, FormValues } from '../engine/rules'
import type { SectionBlock } from '../utils/sectionIndex'
import { FieldRenderer } from './fields'
import { formatFieldName } from '../utils/formatFieldName'

const INSTRUCTION_LABEL_THRESHOLD = 300

interface Props {
  sectionName: string
  sectionLabel?: string
  sectionTooltip?: string
  blocks: SectionBlock[]
  states: Record<string, FieldState>
  values: FormValues
  computed: FormValues
  onChange: (id: string, value: string) => void
  onFileChange?: (id: string, file: File | null) => void
  onPrev?: () => void
  onNext?: () => void
  prevLabel?: string
  nextLabel?: string
  duplicateLabels?: Set<string>
}

const HTML_RE = /<[a-z][\s\S]*?>/i

function DisplayBlock({ label }: { label: string }) {
  if (!label) return null
  if (HTML_RE.test(label)) {
    return (
      <div
        className="bg-amber-50 border-l-4 border-amber-300 px-4 py-3 rounded-r text-sm text-gray-700 prose prose-sm max-w-none"
        // XFA form-authored HTML, not user input
        dangerouslySetInnerHTML={{ __html: label }}
      />
    )
  }
  return (
    <div className="bg-amber-50 border-l-4 border-amber-300 px-4 py-3 rounded-r text-sm text-gray-700 whitespace-pre-line">
      {label}
    </div>
  )
}

function validateField(q: Question, value: string): string | null {
  if (q.required && !value.trim()) return q.validation?.error_message || 'This field is required.'
  if (!value || !q.validation) return null
  const v = q.validation
  if (v.min_length !== undefined && value.length < v.min_length) return `Minimum ${v.min_length} characters.`
  if (v.max_length !== undefined && value.length > v.max_length) return `Maximum ${v.max_length} characters.`
  if (v.min_value !== undefined && parseFloat(value) < v.min_value) return `Minimum value is ${v.min_value}.`
  if (v.max_value !== undefined && parseFloat(value) > v.max_value) return `Maximum value is ${v.max_value}.`
  if (v.pattern) {
    try { if (!new RegExp(v.pattern).test(value)) return v.error_message || 'Invalid format.' } catch { /* skip */ }
  }
  return null
}

export default function SectionView({
  sectionName,
  sectionLabel,
  sectionTooltip,
  blocks,
  states,
  values,
  computed,
  onChange,
  onFileChange,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  duplicateLabels,
}: Props) {
  const effectiveValues = { ...values, ...computed }

  const allQuestions = blocks.flatMap(b => b.questions)
  const allVisible = allQuestions.filter(q => !(states[q.id]?.hidden))
  const interactiveCount = allVisible.filter(
    q => q.type !== 'display' && q.type !== 'image' && q.type !== 'separator' && q.type !== 'button' && q.type !== 'file',
  ).length

  function renderQuestion(q: Question, parentSectionName: string) {
    const state = states[q.id] ?? { hidden: false, disabled: false, computed: false }
    const val = effectiveValues[q.id] ?? ''

    if (q.type === 'display' || q.type === 'image') {
      if (q.type === 'image') {
        return (
          <FieldRenderer
            key={q.id}
            question={q}
            value={val}
            onChange={v => onChange(q.id, v)}
            disabled={true}
            errors={[]}
          />
        )
      }
      return <DisplayBlock key={q.id} label={(q.label ?? '').replace(/[\u2028\u2029]/g, '\n')} />
    }

    if (q.type === 'button') return null

    const isInstruction = (q.label?.length ?? 0) > INSTRUCTION_LABEL_THRESHOLD
    const rawLabel = isInstruction
      ? formatFieldName(q.name)
      : (duplicateLabels?.has(q.label ?? '') && q.label)
        ? `${formatFieldName(parentSectionName)} · ${q.label}`
        : q.label
    const displayLabel = rawLabel?.replace(/[\u2028\u2029]/g, '\n')

    const validation = validateField(q, val)
    return (
      <div key={q.id}>
        {isInstruction && <DisplayBlock label={q.label ?? ''} />}
        <FieldRenderer
          question={{ ...q, label: displayLabel }}
          value={val}
          onChange={v => onChange(q.id, v)}
          onFileChange={f => onFileChange?.(q.id, f)}
          disabled={state.disabled || state.computed}
          errors={validation ? [validation] : []}
        />
        {state.computed && (
          <p className="mt-1 text-xs text-gray-400">Calculated automatically</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 min-h-0">
      <div>
        <h2 title={sectionTooltip} className="text-lg font-semibold text-gray-900 cursor-default">{sectionLabel || formatFieldName(sectionName)}</h2>
        {sectionTooltip && <p className="text-xs text-gray-400 mt-0.5">{sectionTooltip}</p>}
        <p className="text-xs text-gray-400 mt-0.5">{interactiveCount} input{interactiveCount !== 1 ? 's' : ''} in this section</p>
      </div>

      {allVisible.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">No visible fields in this section.</p>
      )}

      <div className="space-y-5">
        {blocks.map(block => {
          const blockVisible = block.questions.filter(q => !(states[q.id]?.hidden))
          const hasContent = blockVisible.length > 0 || block.content.length > 0
          if (!hasContent && block.depth > 0) return null

          return (
            <div key={block.sectionName} id={`section-${block.sectionName}`} className={block.depth > 0 ? 'space-y-5' : undefined}>
              {block.depth === 1 && (
                <div className="pt-4 border-t border-gray-100">
                  <h3 title={block.sectionTooltip} className="text-sm font-semibold text-gray-700 cursor-default">{block.sectionLabel}</h3>
                  {block.sectionTooltip && <p className="text-xs text-gray-400 mt-0.5">{block.sectionTooltip}</p>}
                </div>
              )}
              {block.depth >= 2 && (
                <div className="pt-2">
                  <h4 title={block.sectionTooltip} className="text-xs font-medium text-gray-500 uppercase tracking-wide cursor-default">{block.sectionLabel}</h4>
                  {block.sectionTooltip && <p className="text-xs text-gray-400 mt-0.5">{block.sectionTooltip}</p>}
                </div>
              )}
              {block.content.map((line, i) => (
                <p key={i} className="text-xs text-gray-500">{line}</p>
              ))}
              <div className="space-y-5">
                {blockVisible.map(q => renderQuestion(q, block.sectionName))}
              </div>
            </div>
          )
        })}
      </div>

      {(onPrev || onNext) && (
        <div className="flex justify-between pt-4 border-t border-gray-100">
          <button
            onClick={onPrev}
            disabled={!onPrev}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-0 disabled:cursor-default transition-colors flex items-center gap-1"
          >
            ← {prevLabel ? formatFieldName(prevLabel) : 'Previous'}
          </button>
          <button
            onClick={onNext}
            disabled={!onNext}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-0 disabled:cursor-default transition-colors flex items-center gap-1"
          >
            {nextLabel ? formatFieldName(nextLabel) : 'Next'} →
          </button>
        </div>
      )}
    </div>
  )
}
