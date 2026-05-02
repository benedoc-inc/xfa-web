import type { FormSchema, FormSection, Question } from '../types/schema'

export interface SectionCompletion {
  filled: number
  required: number
  visible: number  // visible interactive fields (excluding display/image/button/file)
}

export interface SectionIndex {
  /** question ID → nearest containing section name */
  questionToSection: Map<string, string>
  /** top-level sections for nav tree (interactive or have interactive descendants) */
  interactiveSections: FormSection[]
  /** DFS-order flat list of all interactive sections, for prev/next navigation */
  flatInteractiveSections: FormSection[]
  /** question labels that appear in more than one question */
  duplicateLabels: Set<string>
}

function hasInteractiveDescendant(sec: FormSection): boolean {
  if (sec.interactive) return true
  return (sec.children ?? []).some(hasInteractiveDescendant)
}

function flattenInteractive(sections: FormSection[]): FormSection[] {
  const result: FormSection[] = []
  for (const sec of sections) {
    if (sec.interactive) result.push(sec)
    if (sec.children?.length) result.push(...flattenInteractive(sec.children))
  }
  return result
}

function findSection(sections: FormSection[], name: string): FormSection | undefined {
  for (const s of sections) {
    if (s.name === name) return s
    if (s.children?.length) {
      const found = findSection(s.children, name)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Returns static content strings for a section (from non-interactive sibling or parent sections).
 * These are header/instruction texts that pdfer collects into FormSection.content.
 */
export function contentForSection(sectionName: string, schema: FormSchema): string[] {
  const rootChildren = schema.sections?.[0]?.children ?? []
  const sec = findSection(rootChildren, sectionName)
  return sec?.content ?? []
}

export function buildSectionIndex(schema: FormSchema): SectionIndex {
  const rootChildren = schema.sections?.[0]?.children ?? []

  const questionToSection = new Map<string, string>()
  function walkQuestions(sections: FormSection[]) {
    for (const sec of sections) {
      for (const qId of sec.questions ?? []) {
        if (!questionToSection.has(qId)) questionToSection.set(qId, sec.name)
      }
      if (sec.children?.length) walkQuestions(sec.children)
    }
  }
  walkQuestions(rootChildren)

  const flatInteractiveSections = flattenInteractive(rootChildren)

  // Top-level sections that are interactive or have interactive descendants
  const interactiveSections = rootChildren.filter(hasInteractiveDescendant)

  const labelCount = new Map<string, number>()
  for (const q of schema.questions) {
    if (q.label) labelCount.set(q.label, (labelCount.get(q.label) ?? 0) + 1)
  }
  const duplicateLabels = new Set<string>()
  for (const [label, count] of labelCount) {
    if (count > 1) duplicateLabels.add(label)
  }

  return { questionToSection, interactiveSections, flatInteractiveSections, duplicateLabels }
}

/**
 * Returns questions for a given section (any level) in tree (document) order.
 */
export function questionsForSection(
  sectionName: string,
  schema: FormSchema,
  index: SectionIndex,
): Question[] {
  const byId = new Map<string, Question>()
  for (const q of schema.questions) byId.set(q.id, q)

  const orderedIds: string[] = []
  const seen = new Set<string>()

  function collectIds(sections: FormSection[]) {
    for (const sec of sections) {
      for (const qId of sec.questions ?? []) {
        if (!seen.has(qId)) {
          seen.add(qId)
          orderedIds.push(qId)
        }
      }
      if (sec.children?.length) collectIds(sec.children)
    }
  }

  const rootChildren = schema.sections?.[0]?.children ?? []
  const sec = findSection(rootChildren, sectionName)
  if (sec) collectIds([sec])

  const result: Question[] = []
  for (const id of orderedIds) {
    const q = byId.get(id)
    if (q) result.push(q)
  }

  // Fallback: questions mapped to this section but not yet collected
  for (const q of schema.questions) {
    if (index.questionToSection.get(q.id) === sectionName && !seen.has(q.id)) {
      result.push(q)
    }
  }

  return result
}
