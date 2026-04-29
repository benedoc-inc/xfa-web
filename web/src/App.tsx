import { useState } from 'react'
import type { FormSchema } from './types/schema'
import UploadScreen from './components/UploadScreen'
import FormRenderer from './components/FormRenderer'

type Screen =
  | { name: 'upload' }
  | { name: 'form'; schema: FormSchema; values: Record<string, string>; pdfData: string; password: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'upload' })

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <span className="text-base font-semibold text-gray-900">xfa-web</span>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-400">XFA PDF form renderer</span>
        </div>
      </header>

      {screen.name === 'upload' && (
        <main className="max-w-2xl mx-auto w-full px-6 py-10">
          <UploadScreen
            onParsed={(schema, values, pdfData, password) =>
              setScreen({ name: 'form', schema, values, pdfData, password })
            }
          />
        </main>
      )}

      {screen.name === 'form' && (
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col overflow-hidden bg-white shadow-sm rounded-lg my-4 mx-4 lg:mx-auto">
          <FormRenderer
            schema={screen.schema}
            initialValues={screen.values}
            pdfData={screen.pdfData}
            password={screen.password}
            onBack={() => setScreen({ name: 'upload' })}
          />
        </div>
      )}
    </div>
  )
}
