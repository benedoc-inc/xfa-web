import type { Rule, Condition, Question } from '../types/schema'

export type FormValues = Record<string, string>

export interface FieldState {
  hidden: boolean
  disabled: boolean
  computed: boolean
}

export interface RulesResult {
  states: Record<string, FieldState>
  computed: FormValues
}

function tryXFAExpression(expr: string, values: FormValues): boolean | null {
  // fieldName.rawValue == "value"
  const eq = expr.match(/^(\w+)\.rawValue\s*==\s*["']([^"']*)["']$/)
  if (eq) return (values[eq[1]] ?? '') === eq[2]

  // fieldName.rawValue != "value"
  const neq = expr.match(/^(\w+)\.rawValue\s*!=\s*["']([^"']*)["']$/)
  if (neq) return (values[neq[1]] ?? '') !== neq[2]

  // fieldName.rawValue === "value"
  const seq = expr.match(/^(\w+)\.rawValue\s*===\s*["']([^"']*)["']$/)
  if (seq) return (values[seq[1]] ?? '') === seq[2]

  return null
}

function evaluateCondition(cond: Condition, sourceValue: string, values: FormValues): boolean {
  if (cond.logic && cond.children?.length) {
    const results = cond.children.map(c => evaluateCondition(c, sourceValue, values))
    switch (cond.logic) {
      case 'and': return results.every(Boolean)
      case 'or': return results.some(Boolean)
      case 'not': return !results[0]
    }
  }

  if (cond.expression) {
    return tryXFAExpression(cond.expression, values) ?? false
  }

  const compareValue = String(cond.value ?? '')
  const numSource = parseFloat(sourceValue)
  const numCompare = parseFloat(compareValue)

  switch (cond.operator) {
    case 'equals': return sourceValue === compareValue
    case 'not_equals': return sourceValue !== compareValue
    case 'greater_than': return numSource > numCompare
    case 'less_than': return numSource < numCompare
    case 'greater_or_equal': return numSource >= numCompare
    case 'less_or_equal': return numSource <= numCompare
    case 'contains': return sourceValue.includes(compareValue)
    case 'not_contains': return !sourceValue.includes(compareValue)
    case 'in': return (cond.values ?? []).map(String).includes(sourceValue)
    case 'not_in': return !(cond.values ?? []).map(String).includes(sourceValue)
    case 'is_empty': return !sourceValue.trim()
    case 'is_not_empty': return !!sourceValue.trim()
    case 'matches': {
      try { return new RegExp(compareValue).test(sourceValue) } catch { return false }
    }
    default: return false
  }
}

function tryEvaluateArithmetic(expression: string, questions: Question[], values: FormValues): string | null {
  // Sum(field1, field2, ...)
  const sumMatch = expression.match(/^Sum\(([^)]+)\)$/i)
  if (sumMatch) {
    const parts = sumMatch[1].split(',').map(s => s.trim())
    const total = parts.reduce((acc, part) => {
      const v = parseFloat(values[part] ?? '0')
      return acc + (isNaN(v) ? 0 : v)
    }, 0)
    return String(total)
  }

  // Substitute field IDs/names with their numeric values, then eval arithmetic
  let expr = expression
  for (const q of questions) {
    const num = parseFloat(values[q.id] ?? '0')
    const safe = isNaN(num) ? 0 : num
    expr = expr.replace(new RegExp(`\\b${q.id}\\b`, 'g'), String(safe))
    expr = expr.replace(new RegExp(`\\b${q.name}\\b`, 'g'), String(safe))
  }

  if (/^[\d\s+\-*/().]+$/.test(expr)) {
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${expr})`)() as unknown
      if (typeof result === 'number' && isFinite(result)) return String(result)
    } catch { /* ignore */ }
  }

  return null
}

export function applyRules(
  rules: Rule[],
  values: FormValues,
  questions: Question[],
  initialHidden: Record<string, boolean>,
): RulesResult {
  const hidden: Record<string, boolean> = { ...initialHidden }
  const disabled: Record<string, boolean> = {}
  const computed: FormValues = {}

  const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  for (const rule of sorted) {
    const sourceValue = values[rule.source] ?? ''
    const conditionMet = rule.condition
      ? evaluateCondition(rule.condition, sourceValue, values)
      : true

    if (!conditionMet) continue

    for (const action of (rule.actions ?? [])) {
      switch (action.type) {
        case 'show':
          hidden[action.target] = false
          break
        case 'hide':
          hidden[action.target] = true
          break
        case 'enable':
          disabled[action.target] = false
          break
        case 'disable':
          disabled[action.target] = true
          break
        case 'set_value':
          if (action.value !== undefined) computed[action.target] = String(action.value)
          break
        case 'calculate': {
          if (action.expression) {
            const result = tryEvaluateArithmetic(action.expression, questions, { ...values, ...computed })
            if (result !== null) computed[action.target] = result
          } else if (action.value !== undefined) {
            computed[action.target] = String(action.value)
          }
          break
        }
      }
    }
  }

  const states: Record<string, FieldState> = {}
  for (const q of questions) {
    states[q.id] = {
      hidden: hidden[q.id] ?? q.hidden,
      disabled: disabled[q.id] ?? q.read_only,
      computed: q.id in computed,
    }
  }

  return { states, computed }
}
