import type { FieldProps } from './types'
import { formatFieldName } from '../../utils/formatFieldName'

export default function SignatureField({ question, disabled }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {question.label || formatFieldName(question.name)}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {question.description && (
        <p className="text-xs text-gray-500 mb-1">{question.description}</p>
      )}
      <div
        className={`flex items-center gap-2 border border-dashed rounded-md px-4 py-3 text-sm ${
          disabled ? 'bg-gray-50 opacity-60' : 'bg-white'
        } border-gray-300`}
      >
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span className="text-gray-400 italic text-xs">Signature field — complete in the original PDF viewer</span>
      </div>
    </div>
  )
}
