import { useState } from 'react'
import UploadSection from './components/UploadSection'

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🎬 AdForge
          </h1>
          <p className="text-gray-600 mt-1">Create stunning video ads in minutes</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <UploadSection 
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
      </main>
    </div>
  )
}

export default App

