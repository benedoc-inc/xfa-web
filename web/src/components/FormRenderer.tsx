import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormSchema } from '../types/schema'
import { applyRules } from '../engine/rules'
import type { FormValues } from '../engine/rules'
import { exportForm, exportXML, importXML } from '../api/client'
import { buildSectionIndex, questionsForSection } from '../utils/sectionIndex'
import type { SectionCompletion } from '../utils/sectionIndex'
import SectionNav from './SectionNav'
import SectionView from './SectionView'

interface Props {
  schema: FormSchema
  initialValues: Record<string, string>
  pdfData: string
  password: string
  onBack: () => void
}

export default function FormRenderer({ schema, initialValues, pdfData, password, onBack }: Props) {
  const [userValues, setUserValues] = useState<FormValues>(() => {
    // Seed with schema defaults for any field not already in initialValues.
    const vals = { ...initialValues }
    for (const q of schema.questions) {
      if (!(q.id in vals) && q.default !== undefined && q.default !== null && q.default !== '') {
        vals[q.id] = String(q.default)
      }
    }
    return vals
  })
  const [fileAttachments, setFileAttachments] = useState<Record<string, File>>({})
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isExportingXML, setIsExportingXML] = useState(false)
  const xmlImportRef = useRef<HTMLInputElement>(null)

  const sectionIndex = useMemo(() => buildSectionIndex(schema), [schema])

  const [activeSection, setActiveSection] = useState<string>(
    () => sectionIndex.flatInteractiveSections[0]?.name ?? '',
  )

  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [activeSection])

  const initialHidden = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const q of schema.questions) m[q.id] = q.hidden
    return m
  }, [schema.questions])

  const { states, computed } = useMemo(
    () => applyRules(schema.rules, userValues, schema.questions, initialHidden),
    [schema.rules, schema.questions, userValues, initialHidden],
  )

  const effectiveValues: FormValues = useMemo(
    () => ({ ...userValues, ...computed }),
    [userValues, computed],
  )

  const handleChange = useCallback((id: string, value: string) => {
    setUserValues(prev => ({ ...prev, [id]: value }))
  }, [])

  const handleFileChange = useCallback((id: string, file: File | null) => {
    setFileAttachments(prev => {
      const next = { ...prev }
      if (file) next[id] = file
      else delete next[id]
      return next
    })
  }, [])

  const sectionQuestions = useMemo(
    () => questionsForSection(activeSection, schema, sectionIndex),
    [activeSection, schema, sectionIndex],
  )

  const completion = useMemo<Record<string, SectionCompletion>>(() => {
    const result: Record<string, SectionCompletion> = {}
    for (const sec of sectionIndex.flatInteractiveSections) {
      const qs = questionsForSection(sec.name, schema, sectionIndex)
      let required = 0
      let filled = 0
      let visible = 0
      for (const q of qs) {
        if (states[q.id]?.hidden) continue
        if (q.type === 'display' || q.type === 'image' || q.type === 'button' || q.type === 'file') continue
        visible++
        if (q.required) {
          required++
          if ((effectiveValues[q.id] ?? '').trim()) filled++
        }
      }
      result[sec.name] = { filled, required, visible }
    }
    return result
  }, [sectionIndex, schema, states, effectiveValues])

  const flatSections = sectionIndex.flatInteractiveSections
  const activeSectionIdx = flatSections.findIndex(s => s.name === activeSection)
  const prevSection = flatSections[activeSectionIdx - 1]
  const nextSection = flatSections[activeSectionIdx + 1]

  async function handleExport() {
    setIsExporting(true)
    setExportError(null)
    try {
      const blob = await exportForm(pdfData, effectiveValues, password || undefined, fileAttachments)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = schema.metadata.title ? `${schema.metadata.title}.pdf` : 'filled_form.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXML() {
    setIsExportingXML(true)
    try {
      const blob = await exportXML(pdfData, effectiveValues, password || undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = schema.metadata.title ? `${schema.metadata.title}.xml` : 'estar_data.xml'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'XML export failed.')
    } finally {
      setIsExportingXML(false)
    }
  }

  function handleImportXML(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      if (!text) return
      const imported = importXML(text, schema)
      setUserValues(prev => ({ ...prev, ...imported }))
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }

  const totalRequired = Object.values(completion).reduce((s, c) => s + c.required, 0)
  const totalFilled = Object.values(completion).reduce((s, c) => s + c.filled, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between py-4 px-6 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 leading-tight">
              {schema.metadata.title || 'Form'}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {schema.metadata.form_type}
              {totalRequired > 0 && (
                <> · <span className={totalFilled === totalRequired ? 'text-green-600' : 'text-gray-400'}>
                  {totalFilled}/{totalRequired} required filled
                </span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => xmlImportRef.current?.click()}
              className="text-xs text-gray-500 hover:text-gray-700 py-1.5 px-3 rounded-md border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Import XML
            </button>
            <button
              onClick={handleExportXML}
              disabled={isExportingXML}
              className="text-xs text-gray-500 hover:text-gray-700 py-1.5 px-3 rounded-md border border-gray-200 hover:border-gray-300 disabled:opacity-50 transition-colors"
            >
              {isExportingXML ? 'Exporting…' : 'Export XML'}
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-blue-600 text-white text-sm font-medium py-1.5 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
          {exportError && (
            <p className="text-xs text-red-600 max-w-xs text-right">{exportError}</p>
          )}
          <input
            ref={xmlImportRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden"
            onChange={handleImportXML}
          />
        </div>
      </div>

      {/* Body */}
      {sectionIndex.flatInteractiveSections.length === 0 ? (
        // No section tree — fall back to flat scroll
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <SectionView
            sectionName="Form"
            questions={schema.questions}
            states={states}
            values={userValues}
            computed={computed}
            onChange={handleChange}
            onFileChange={handleFileChange}
            duplicateLabels={sectionIndex.duplicateLabels}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-gray-100 px-2 py-4 bg-white">
            <SectionNav
              sections={sectionIndex.interactiveSections}
              active={activeSection}
              onSelect={setActiveSection}
              completion={completion}
            />
          </div>

          {/* Section content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-8 py-6">
            <SectionView
              sectionName={activeSection}
              questions={sectionQuestions}
              states={states}
              values={userValues}
              computed={computed}
              onChange={handleChange}
              onFileChange={handleFileChange}
              onPrev={prevSection ? () => setActiveSection(prevSection.name) : undefined}
              onNext={nextSection ? () => setActiveSection(nextSection.name) : undefined}
              prevLabel={prevSection?.name}
              nextLabel={nextSection?.name}
              duplicateLabels={sectionIndex.duplicateLabels}
            />
          </div>
        </div>
      )}
    </div>
  )
}
