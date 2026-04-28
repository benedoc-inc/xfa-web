import type { FieldProps } from './types'
import { formatFieldName } from '../../utils/formatFieldName'

export default function SelectField({ question, value, onChange, disabled, errors }: FieldProps) {
  const options = question.options ?? []
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {question.label || formatFieldName(question.name)}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {question.description && (
        <p className="text-xs text-gray-500 mb-1">{question.description}</p>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 ${
          errors.length ? 'border-red-400' : 'border-gray-300'
        }`}
      >
        <option value="">— Select —</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {errors.map((e, i) => (
        <p key={i} className="mt-1 text-xs text-red-600">{e}</p>
      ))}
    </div>
  )
}
