import type { Question } from '../../types/schema'

export interface FieldProps {
  question: Question
  value: string
  onChange: (value: string) => void
  onFileChange?: (file: File | null) => void
  disabled: boolean
  errors: string[]
}
