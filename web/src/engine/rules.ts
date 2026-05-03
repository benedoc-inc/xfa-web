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

// ---------------------------------------------------------------------------
// Expression helpers
// ---------------------------------------------------------------------------

// Splits expr at top-level occurrences of op (not inside parens/quotes).
// Returns null if no split points found.
function splitTopLevel(expr: string, op: string): string[] | null {
  const parts: string[] = []
  let depth = 0
  let inStr: string | null = null
  let last = 0

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (inStr) {
      if (ch === inStr && expr[i - 1] !== '\\') inStr = null
    } else if (ch === '"' || ch === "'") {
      inStr = ch
    } else if (ch === '(') {
      depth++
    } else if (ch === ')') {
      depth--
    } else if (depth === 0 && expr.slice(i, i + op.length) === op) {
      parts.push(expr.slice(last, i).trim())
      i += op.length - 1
      last = i + 1
    }
  }
  if (parts.length === 0) return null
  parts.push(expr.slice(last).trim())
  return parts
}

// Three-valued AND: false if any false; null if any null but no false; else true.
function and3(parts: Array<boolean | null>): boolean | null {
  if (parts.includes(false)) return false
  if (parts.includes(null)) return null
  return true
}

// Three-valued OR: true if any true; null if any null but no true; else false.
function or3(parts: Array<boolean | null>): boolean | null {
  if (parts.includes(true)) return true
  if (parts.includes(null)) return null
  return false
}

// Extract last dot-path component: "Section.Sub.Field" → "Field".
function lastPart(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot >= 0 ? path.slice(dot + 1) : path
}

// Look up field value by direct ID or by name (last path component).
function resolveValue(path: string, values: FormValues, nameToId: Record<string, string>): string | null {
  const direct = path in values ? values[path] : undefined
  if (direct !== undefined) return direct
  const name = lastPart(path)
  if (name in values) return values[name]
  const id = nameToId[name]
  if (id && id in values) return values[id]
  // XFA exclGroup sub-option paths: "GroupName.OptionField" where OptionField is a child
  // checkbox that has no independent values entry. Fall back to the parent group's value.
  // Correct because exclGroup.Option.rawValue == V iff exclGroup.rawValue == V.
  const parentEnd = path.lastIndexOf('.')
  if (parentEnd > 0) {
    const parentName = lastPart(path.slice(0, parentEnd))
    if (parentName in values) return values[parentName]
    const parentId = nameToId[parentName]
    if (parentId && parentId in values) return values[parentId]
  }
  return null
}

// Check if a field is currently hidden (by direct ID or name lookup).
function resolveHidden(name: string, hidden: Record<string, boolean>, nameToId: Record<string, string>): boolean {
  if (name in hidden) return hidden[name]
  const id = nameToId[name]
  if (id && id in hidden) return hidden[id]
  return false
}

// ---------------------------------------------------------------------------
// Core expression evaluator
// Returns boolean | null — null means "couldn't parse, skip the rule".
// ---------------------------------------------------------------------------
function tryXFAExpression(
  expr: string,
  values: FormValues,
  sourceId: string | undefined,
  nameToId: Record<string, string>,
  hidden: Record<string, boolean>,
): boolean | null {
  const e = expr.trim()
  if (!e) return null

  // Skip Adobe Acrobat host/layout API calls — not executable in browser.
  if (e.includes('xfa.host.') || e.includes('xfa.layout.') || e.includes('xfa.event.')) return null
  // Skip scripted function calls and dialog objects.
  if (e.includes('execDialog') || e.includes('dialogObject') || e.includes('.addItem(')) return null

  // Compound OR (lower precedence — split first).
  const orParts = splitTopLevel(e, '||')
  if (orParts) {
    return or3(orParts.map(p => tryXFAExpression(p, values, sourceId, nameToId, hidden)))
  }

  // Compound AND.
  const andParts = splitTopLevel(e, '&&')
  if (andParts) {
    return and3(andParts.map(p => tryXFAExpression(p, values, sourceId, nameToId, hidden)))
  }

  // ---- presence checks ----
  // fieldPath.presence == "visible" | "hidden"
  const presEq = e.match(/^([\w.]+)\.presence\s*===?\s*["'](visible|hidden)["']$/)
  if (presEq) {
    const isHidden = resolveHidden(lastPart(presEq[1]), hidden, nameToId)
    return presEq[2] === 'visible' ? !isHidden : isHidden
  }
  const presNeq = e.match(/^([\w.]+)\.presence\s*!==?\s*["'](visible|hidden)["']$/)
  if (presNeq) {
    const isHidden = resolveHidden(lastPart(presNeq[1]), hidden, nameToId)
    return presNeq[2] === 'visible' ? isHidden : !isHidden
  }

  // ---- rawValue comparisons ----
  // Resolve path to a value string (null = field unknown → skip).
  function rv(path: string): string | null {
    if (/^(?:this|\$)$/.test(path)) return sourceId !== undefined ? (values[sourceId] ?? '') : null
    return resolveValue(path, values, nameToId)
  }

  // == "quoted" or == unquoted_number
  const eqQ = e.match(/^([\w$.]+)\.rawValue\s*===?\s*"([^"]*)"$/) ??
               e.match(/^([\w$.]+)\.rawValue\s*===?\s*'([^']*)'$/)
  if (eqQ) { const v = rv(eqQ[1]); return v !== null ? v === eqQ[2] : null }

  const eqN = e.match(/^([\w$.]+)\.rawValue\s*===?\s*(-?[\d.]+)$/)
  if (eqN) {
    const v = rv(eqN[1])
    if (v === null) return null
    return v === eqN[2] || (!isNaN(parseFloat(v)) && parseFloat(v) === parseFloat(eqN[2]))
  }

  // != "quoted" or != unquoted_number
  const neqQ = e.match(/^([\w$.]+)\.rawValue\s*!==?\s*"([^"]*)"$/) ??
                e.match(/^([\w$.]+)\.rawValue\s*!==?\s*'([^']*)'$/)
  if (neqQ) { const v = rv(neqQ[1]); return v !== null ? v !== neqQ[2] : null }

  const neqN = e.match(/^([\w$.]+)\.rawValue\s*!==?\s*(-?[\d.]+)$/)
  if (neqN) {
    const v = rv(neqN[1])
    if (v === null) return null
    return v !== neqN[2] && (isNaN(parseFloat(v)) || parseFloat(v) !== parseFloat(neqN[2]))
  }

  // != null / == null  (empty/non-empty check)
  const nullEq = e.match(/^([\w$.]+)\.rawValue\s*===?\s*null$/)
  if (nullEq) { const v = rv(nullEq[1]); return v !== null ? v.trim() === '' : null }

  const nullNeq = e.match(/^([\w$.]+)\.rawValue\s*!==?\s*null$/)
  if (nullNeq) { const v = rv(nullNeq[1]); return v !== null ? v.trim() !== '' : null }

  // == "" / != "" (empty string literal)
  const emptyEq = e.match(/^([\w$.]+)\.rawValue\s*===?\s*(?:""'')$/) ??
                  e.match(/^([\w$.]+)\.rawValue\s*===?\s*""$/) ??
                  e.match(/^([\w$.]+)\.rawValue\s*===?\s*''$/)
  if (emptyEq) { const v = rv(emptyEq[1]); return v !== null ? v.trim() === '' : null }

  const emptyNeq = e.match(/^([\w$.]+)\.rawValue\s*!==?\s*""$/) ??
                   e.match(/^([\w$.]+)\.rawValue\s*!==?\s*''$/)
  if (emptyNeq) { const v = rv(emptyNeq[1]); return v !== null ? v.trim() !== '' : null }

  return null
}

// ---------------------------------------------------------------------------
// Condition tree evaluator
// Returns boolean | null — null means skip the rule.
// ---------------------------------------------------------------------------
function evaluateCondition(
  cond: Condition,
  sourceValue: string,
  values: FormValues,
  sourceId: string | undefined,
  nameToId: Record<string, string>,
  hidden: Record<string, boolean>,
): boolean | null {
  if (cond.logic && cond.children?.length) {
    const results = cond.children.map(c =>
      evaluateCondition(c, sourceValue, values, sourceId, nameToId, hidden),
    )
    switch (cond.logic) {
      case 'and': return and3(results)
      case 'or': return or3(results)
      case 'not': return results[0] === null ? null : !results[0]
    }
  }

  if (cond.expression) {
    return tryXFAExpression(cond.expression, values, sourceId, nameToId, hidden)
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
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Arithmetic calculate evaluator
// ---------------------------------------------------------------------------
function tryEvaluateArithmetic(expression: string, questions: Question[], values: FormValues): string | null {
  const sumMatch = expression.match(/^Sum\(([^)]+)\)$/i)
  if (sumMatch) {
    const parts = sumMatch[1].split(',').map(s => s.trim())
    const total = parts.reduce((acc, part) => {
      const v = parseFloat(values[part] ?? '0')
      return acc + (isNaN(v) ? 0 : v)
    }, 0)
    return String(total)
  }

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

// ---------------------------------------------------------------------------
// applyRules
// ---------------------------------------------------------------------------
export function applyRules(
  rules: Rule[],
  values: FormValues,
  questions: Question[],
  initialHidden: Record<string, boolean>,
): RulesResult {
  // Build name → id lookup so conditions can reference fields by name.
  const nameToId: Record<string, string> = {}
  for (const q of questions) {
    // Don't overwrite — keep first occurrence for duplicate names.
    if (!(q.name in nameToId)) nameToId[q.name] = q.id
  }

  const hidden: Record<string, boolean> = { ...initialHidden }
  const disabled: Record<string, boolean> = {}
  const computed: FormValues = {}

  // Sort highest priority first; within same priority, show actions lose to
  // hide actions so that a hide+show conflict defaults to hidden.
  const sorted = [...rules].sort((a, b) => {
    const pd = (b.priority ?? 0) - (a.priority ?? 0)
    if (pd !== 0) return pd
    // Within same priority, process hide before show so show wins on conflict.
    const actionRank = (r: Rule) => r.actions.some(a => a.type === 'hide') ? 0 : 1
    return actionRank(a) - actionRank(b)
  })

  for (const rule of sorted) {
    const sourceValue = values[rule.source] ?? ''
    const condResult = rule.condition
      ? evaluateCondition(rule.condition, sourceValue, values, rule.source, nameToId, hidden)
      : (true as boolean | null)

    // null = unparseable → skip; false = condition not met → skip
    if (condResult !== true) continue

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
  // Expose states for non-question targets (section names) so the renderer can
  // propagate section-level hiding to all questions within a hidden section.
  const questionIds = new Set(questions.map(q => q.id))
  for (const [id, isHidden] of Object.entries(hidden)) {
    if (!questionIds.has(id)) {
      states[id] = { hidden: isHidden, disabled: false, computed: false }
    }
  }

  return { states, computed }
}
