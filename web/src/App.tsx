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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900">xfa-web</span>
          <span className="text-gray-400">·</span>
          <span className="text-sm text-gray-500">XFA PDF to interactive web form</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {screen.name === 'upload' && (
          <UploadScreen
            onParsed={(schema, values, pdfData, password) =>
              setScreen({ name: 'form', schema, values, pdfData, password })
            }
          />
        )}
        {screen.name === 'form' && (
          <FormRenderer
            schema={screen.schema}
            initialValues={screen.values}
            pdfData={screen.pdfData}
            password={screen.password}
            onBack={() => setScreen({ name: 'upload' })}
          />
        )}
      </main>
    </div>
  )
}
