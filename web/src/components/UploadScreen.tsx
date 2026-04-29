import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import type { FormSchema } from '../types/schema'
import { parseForm } from '../api/client'

interface Props {
  onParsed: (schema: FormSchema, values: Record<string, string>, pdfData: string, password: string) => void
}

function ParseSkeleton() {
  return (
    <div className="animate-pulse space-y-4 py-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-48" />
      </div>
      {[72, 56, 80, 48, 64].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-2 h-2 bg-gray-200 rounded-full flex-shrink-0" />
          <div className="h-3 bg-gray-200 rounded" style={{ width: `${w}%` }} />
        </div>
      ))}
      <p className="text-xs text-gray-400 text-center pt-2">Parsing form…</p>
    </div>
  )
}

export default function UploadScreen({ onParsed }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function acceptFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.')
      return
    }
    setFile(f)
    setError(null)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) acceptFile(f)
  }

  async function handleSubmit() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await parseForm(file, password || undefined)
      onParsed(result.schema, result.values, result.pdf_data, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse form.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Upload XFA PDF</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload an XFA PDF form to render it as an interactive web form.
        </p>
      </div>

      {loading ? (
        <div className="border border-gray-200 rounded-lg p-8">
          <ParseSkeleton />
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={onFileChange}
          />
          {file ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB · click to replace</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Drop a PDF here or click to browse</p>
              <p className="text-xs text-gray-400">XFA and AcroForm PDFs supported</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Password <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Leave blank if unencrypted"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Parsing form…' : 'Parse Form'}
      </button>
    </div>
  )
}
