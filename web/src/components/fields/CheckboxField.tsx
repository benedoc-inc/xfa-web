import type { FieldProps } from './types'
import { formatFieldName } from '../../utils/formatFieldName'

export default function CheckboxField({ question, value, onChange, disabled, errors }: FieldProps) {
  const checked = value === '1' || value === 'true' || value === 'yes'
  const label = question.label || formatFieldName(question.name)
  return (
    <div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked ? '1' : '0')}
          disabled={disabled}
          className="mt-0.5 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">
            {label}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </span>
          {question.description && (
            <p className="text-xs text-gray-500 mt-0.5">{question.description}</p>
          )}
        </div>
      </label>
      {errors.map((e, i) => (
        <p key={i} className="mt-1 text-xs text-red-600">{e}</p>
      ))}
    </div>
  )
}
