import type { FormSchema } from '../types/schema'

export interface ParseResult {
  schema: FormSchema
  values: Record<string, string>
  pdf_data: string
}

export async function parseForm(file: File, password?: string): Promise<ParseResult> {
  const body = new FormData()
  body.append('pdf', file)
  if (password) body.append('password', password)

  const res = await fetch('/api/parse', { method: 'POST', body })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Parse failed (${res.status})`)
  }
  return res.json() as Promise<ParseResult>
}

export async function exportForm(
  pdfData: string,
  values: Record<string, string>,
  password?: string,
  files?: Record<string, File>,
): Promise<Blob> {
  const hasFiles = files && Object.keys(files).length > 0

  let body: BodyInit
  let headers: HeadersInit | undefined

  if (hasFiles) {
    const form = new FormData()
    form.append('pdf_data', pdfData)
    form.append('values', JSON.stringify(values))
    if (password) form.append('password', password)
    for (const [fieldId, file] of Object.entries(files!)) {
      form.append(fieldId, file, file.name)
    }
    body = form
    // Let browser set Content-Type with boundary automatically.
  } else {
    body = JSON.stringify({ pdf_data: pdfData, values, password })
    headers = { 'Content-Type': 'application/json' }
  }

  const res = await fetch('/api/export', { method: 'POST', headers, body })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Export failed (${res.status})`)
  }
  return res.blob()
}

export async function exportXML(
  pdfData: string,
  values: Record<string, string>,
  password?: string,
): Promise<Blob> {
  const res = await fetch('/api/export-xml', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf_data: pdfData, values, password }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `XML export failed (${res.status})`)
  }
  return res.blob()
}

// Parse an XFA datasets XML file and return a values map keyed by question ID.
// Handles both <field name="X"><value>V</value></field> and <X>V</X> formats.
export function importXML(xmlText: string, schema: FormSchema): Record<string, string> {
  const nameToId: Record<string, string> = {}
  for (const q of schema.questions) {
    if (!(q.name in nameToId)) nameToId[q.name] = q.id
  }

  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const values: Record<string, string> = {}

  // Format 1: <field name="NAME"><value>V</value></field>
  for (const field of Array.from(doc.getElementsByTagName('field'))) {
    const name = field.getAttribute('name')
    if (!name) continue
    const id = nameToId[name]
    if (!id) continue
    const valueEl = field.getElementsByTagName('value')[0]
    if (valueEl) values[id] = valueEl.textContent?.trim() ?? ''
  }

  // Format 2: <NAME>V</NAME> — used when format 1 yielded nothing
  if (Object.keys(values).length === 0) {
    for (const el of Array.from(doc.getElementsByTagName('*'))) {
      const localName = el.localName
      const id = nameToId[localName]
      if (id && el.children.length === 0) {
        const text = el.textContent?.trim() ?? ''
        if (text) values[id] = text
      }
    }
  }

  return values
}
