import type { FieldProps } from './types'
import { formatFieldName } from '../../utils/formatFieldName'

export default function RadioField({ question, value, onChange, disabled, errors }: FieldProps) {
  const options = question.options ?? []
  return (
    <div>
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          {question.label || formatFieldName(question.name)}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </legend>
        {question.description && (
          <p className="text-xs text-gray-500 mb-2">{question.description}</p>
        )}
        <div className="space-y-2">
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
              {opt.description && (
                <span className="text-xs text-gray-400">— {opt.description}</span>
              )}
            </label>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-gray-400">No options defined</p>
          )}
        </div>
      </fieldset>
      {errors.map((e, i) => (
        <p key={i} className="mt-1 text-xs text-red-600">{e}</p>
      ))}
    </div>
  )
}
