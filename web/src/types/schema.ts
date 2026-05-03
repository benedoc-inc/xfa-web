export interface FormSchema {
  metadata: FormMetadata
  questions: Question[]
  sections?: FormSection[]
  rules: Rule[]
}

export interface FormSection {
  name: string
  path: string
  label?: string     // human-readable label from XFA subform caption; empty when not specified
  tooltip?: string   // accessibility tooltip (e.g. IMDRF TOC chapter references)
  interactive: boolean
  layout?: string    // position | tb | lr-tb | row | table
  width?: string     // subform w attribute (mm/in/pt)
  height?: string    // subform h attribute (mm/in/pt)
  content?: string[] // static display text from non-interactive sections
  children?: FormSection[]
  questions?: string[] // question IDs in document order
}

export interface FormMetadata {
  title?: string
  description?: string
  version?: string
  form_type: string
  total_pages: number
}

export interface Question {
  id: string
  name: string
  label?: string
  description?: string
  type: ResponseType
  options?: Option[]
  validation?: ValidationRules
  default?: unknown
  required: boolean
  read_only: boolean
  hidden: boolean
  properties?: Record<string, unknown>
  page_number?: number
  section?: string
}

export type ResponseType =
  | 'text'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'number'
  | 'date'
  | 'time'
  | 'email'
  | 'password'
  | 'button'
  | 'signature'
  | 'display'
  | 'image'
  | 'separator'
  | 'file'
  | 'unknown'

export interface Option {
  value: string
  label: string
  description?: string
  selected?: boolean
}

export interface ValidationRules {
  min_length?: number
  max_length?: number
  min_value?: number
  max_value?: number
  pattern?: string
  custom_script?: string
  error_message?: string
}

export interface Rule {
  id: string
  type: RuleType
  source: string
  condition?: Condition
  actions: Action[]
  priority?: number
  description?: string
}

export type RuleType = 'visibility' | 'enable' | 'calculate' | 'validate' | 'set_value' | 'navigate'

export interface Condition {
  operator: Operator
  value?: unknown
  values?: unknown[]
  expression?: string
  logic?: LogicOp
  children?: Condition[]
}

export type Operator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty'
  | 'matches'

export type LogicOp = 'and' | 'or' | 'not'

export interface Action {
  type: ActionType
  target: string
  value?: unknown
  expression?: string
  script?: string
  description?: string
}

export type ActionType =
  | 'show'
  | 'hide'
  | 'enable'
  | 'disable'
  | 'set_value'
  | 'calculate'
  | 'validate'
  | 'navigate'
  | 'execute'
