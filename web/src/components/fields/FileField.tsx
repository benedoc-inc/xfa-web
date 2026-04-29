import { useRef } from 'react'
import type { FieldProps } from './types'
import { formatFieldName } from '../../utils/formatFieldName'

export default function FileField({ question, value, onChange, onFileChange, disabled, errors }: FieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onChange(file.name)
    onFileChange?.(file)
  }

  const filename = value || ''

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
        className={`flex items-center gap-3 border rounded-md px-3 py-2 text-sm ${
          disabled ? 'bg-gray-50 opacity-60' : 'bg-white cursor-pointer hover:bg-gray-50'
        } ${errors.length ? 'border-red-400' : 'border-gray-300'}`}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span className={filename ? 'text-gray-900' : 'text-gray-400'}>
          {filename || 'Choose file…'}
        </span>
        {filename && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(''); onFileChange?.(null); if (inputRef.current) inputRef.current.value = '' }}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />
      <p className="mt-1 text-xs text-gray-400">
        File will be attached to the exported PDF
      </p>
      {errors.map((e, i) => (
        <p key={i} className="mt-1 text-xs text-red-600">{e}</p>
      ))}
    </div>
  )
}
