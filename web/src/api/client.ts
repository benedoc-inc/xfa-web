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
): Promise<Blob> {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf_data: pdfData, values, password }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Export failed (${res.status})`)
  }
  return res.blob()
}
