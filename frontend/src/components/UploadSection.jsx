import { useState, useEffect } from 'react'
import axios from 'axios'

export default function UploadSection({ uploadedFiles, setUploadedFiles }) {
  const [script, setScript] = useState('')
  const [niche, setNiche] = useState('real-estate')
  const [dragActive, setDragActive] = useState(false)
  const [voiceType, setVoiceType] = useState('alloy')
  const [musicTrack, setMusicTrack] = useState('upbeat')
  const [analyzing, setAnalyzing] = useState(false)
  const [imageAnalysis, setImageAnalysis] = useState({})
  const [generatingScript, setGeneratingScript] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [generationStep, setGenerationStep] = useState('')
  const [generatedVideo, setGeneratedVideo] = useState(null)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [musicVolume, setMusicVolume] = useState(15)

  // Load saved data from localStorage on mount
  useEffect(() => {
    const savedAnalysis = localStorage.getItem('imageAnalysis')
    const savedScript = localStorage.getItem('generatedScript')
    if (savedAnalysis) setImageAnalysis(JSON.parse(savedAnalysis))
    if (savedScript) setScript(savedScript)
  }, [])

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    const fileData = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      category: '', // Will be set by user
      analysis: null
    }))
    setUploadedFiles([...uploadedFiles, ...fileData])
  }

  const updateFileCategory = (index, category) => {
    const updated = [...uploadedFiles]
    updated[index].category = category
    setUploadedFiles(updated)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange({ target: { files: e.dataTransfer.files } })
    }
  }

  const removeFile = (index) => {
    const fileName = uploadedFiles[index].name
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))
    
    // Remove from analysis
    const updated = { ...imageAnalysis }
    delete updated[fileName]
    setImageAnalysis(updated)
    localStorage.setItem('imageAnalysis', JSON.stringify(updated))
  }

  const analyzeImages = async () => {
    if (uploadedFiles.length === 0) return
    
    setAnalyzing(true)
    setAnalysisError(null)
    const analysis = {}
    let errorCount = 0
    
    for (const file of uploadedFiles) {
      try {
        console.log(`Analyzing: ${file.name}`)
        
        const formData = new FormData()
        formData.append('image', file.file)
        formData.append('category', file.category || 'general')
        formData.append('niche', niche)
        
        const response = await axios.post('/api/analyze-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        
        console.log(`✓ ${file.name} analyzed successfully`)
        
        analysis[file.name] = {
          category: file.category,
          description: response.data.analysis,
          features: response.data.features
        }
      } catch (error) {
        console.error(`✗ Error analyzing ${file.name}:`, error)
        console.error('Error response:', error.response?.data)
        
        errorCount++
        analysis[file.name] = {
          category: file.category,
          description: `❌ Analysis failed: ${error.response?.data?.details || error.message}`,
          features: [],
          error: true
        }
      }
    }
    
    if (errorCount > 0) {
      setAnalysisError(`${errorCount} of ${uploadedFiles.length} images failed to analyze. Check console for details.`)
    }
    
    setImageAnalysis(analysis)
    localStorage.setItem('imageAnalysis', JSON.stringify(analysis))
    setAnalyzing(false)
  }

  const generateScriptFromAnalysis = async () => {
    setGeneratingScript(true)
    
    try {
      const response = await axios.post('/api/generate-script', {
        niche,
        imageAnalysis,
        userScript: script
      })
      
      const generatedScript = response.data.script
      setScript(generatedScript)
      localStorage.setItem('generatedScript', generatedScript)
    } catch (error) {
      console.error('Error generating script:', error)
      alert('Failed to generate script. Check console for details.')
    }
    
    setGeneratingScript(false)
  }

  const handleGenerate = async () => {
    try {
      setGeneratingVideo(true)
      setGeneratedVideo(null)
      
      // Step 1: Analyze images if not done
      if (Object.keys(imageAnalysis).length === 0) {
        setGenerationStep('🔍 Analyzing images...')
        await analyzeImages()
      }
      
      // Step 2: Generate script if empty
      if (!script.trim()) {
        setGenerationStep('✍️ Generating script...')
        await generateScriptFromAnalysis()
      }
      
      // Step 3: Generate video
      setGenerationStep('🎬 Generating video ad...')
      
      const formData = new FormData()
      
      // Add images
      uploadedFiles.forEach(file => {
        formData.append('images', file.file)
      })
      
      // Add other data
      formData.append('script', script)
      formData.append('voice', voiceType)
      formData.append('music', musicTrack)
      formData.append('musicVolume', musicVolume)
      formData.append('niche', niche)
      formData.append('aspectRatio', aspectRatio)
      formData.append('imageAnalysis', JSON.stringify(imageAnalysis))
      
      const response = await axios.post('/api/generate-video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000 // 5 minutes timeout
      })
      
      setGeneratedVideo(response.data)
      setGenerationStep('✅ Video generated successfully!')
      
      // Scroll to video preview
      setTimeout(() => {
        document.getElementById('video-preview')?.scrollIntoView({ behavior: 'smooth' })
      }, 500)
      
    } catch (error) {
      console.error('Error generating video:', error)
      setGenerationStep(`❌ Error: ${error.response?.data?.details || error.message}`)
      alert(`Failed to generate video: ${error.response?.data?.details || error.message}`)
    } finally {
      setGeneratingVideo(false)
    }
  }

  const clearAll = () => {
    if (confirm('Clear all uploaded files, analysis, and script?')) {
      setUploadedFiles([])
      setImageAnalysis({})
      setScript('')
      localStorage.removeItem('imageAnalysis')
      localStorage.removeItem('generatedScript')
    }
  }

  return (
    <div className="space-y-6">
      {/* Clear All Button */}
      {(uploadedFiles.length > 0 || Object.keys(imageAnalysis).length > 0 || script) && (
        <div className="flex justify-end">
          <button
            onClick={clearAll}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
          >
            🗑️ Clear All
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">1. Upload Your Media</h2>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            multiple
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="text-gray-600">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-2 text-sm font-medium">
                Drag & drop images or videos, or <span className="text-blue-600">browse</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, MP4 up to 50MB</p>
            </div>
          </label>
        </div>

        {/* Preview Grid with Categorization */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex gap-4">
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate mb-2">{file.name}</p>
                      
                      {/* Category Selection */}
                      <select
                        value={file.category}
                        onChange={(e) => updateFileCategory(index, e.target.value)}
                        className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md mb-2"
                      >
                        <option value="">Select category...</option>
                        {niche === 'real-estate' && (
                          <>
                            <option value="exterior">Exterior</option>
                            <option value="living-room">Living Room</option>
                            <option value="bedroom">Bedroom</option>
                            <option value="kitchen">Kitchen</option>
                            <option value="bathroom">Bathroom</option>
                            <option value="backyard">Backyard/Garden</option>
                          </>
                        )}
                        {niche === 'e-commerce' && (
                          <>
                            <option value="main-product">Main Product</option>
                            <option value="detail-shot">Detail Shot</option>
                            <option value="lifestyle">Lifestyle</option>
                            <option value="packaging">Packaging</option>
                          </>
                        )}
                        {niche === 'fitness' && (
                          <>
                            <option value="gym-floor">Gym Floor</option>
                            <option value="equipment">Equipment</option>
                            <option value="class">Class/Training</option>
                            <option value="amenities">Amenities</option>
                          </>
                        )}
                        {niche === 'coaching' && (
                          <>
                            <option value="headshot">Headshot</option>
                            <option value="workspace">Workspace</option>
                            <option value="testimonial">Testimonial</option>
                            <option value="results">Results/Success</option>
                          </>
                        )}
                      </select>
                      
                      {/* Analysis Result */}
                      {imageAnalysis[file.name] && (
                        <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                          ✓ Analyzed: {imageAnalysis[file.name].description?.substring(0, 50)}...
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Analyze Button */}
            <button
              onClick={analyzeImages}
              disabled={analyzing || uploadedFiles.some(f => !f.category)}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                analyzing || uploadedFiles.some(f => !f.category)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {analyzing ? '🔍 Analyzing Images...' : '🔍 Analyze Images with AI Vision'}
            </button>
            
            {/* Error Message */}
            {analysisError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                <strong>⚠️ Error:</strong> {analysisError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Niche Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">2. Select Your Niche</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['real-estate', 'fitness', 'e-commerce', 'coaching'].map((nicheOption) => (
            <button
              key={nicheOption}
              onClick={() => setNiche(nicheOption)}
              className={`p-4 rounded-lg border-2 transition-all capitalize ${
                niche === nicheOption
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {nicheOption.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Summary */}
      {Object.keys(imageAnalysis).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📊 Image Analysis Results</h2>
            <button
              onClick={() => {
                if (confirm('Clear analysis results?')) {
                  setImageAnalysis({})
                  localStorage.removeItem('imageAnalysis')
                }
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear Analysis
            </button>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(imageAnalysis).map(([fileName, data]) => (
              <div key={fileName} className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  {data.category.replace('-', ' ').toUpperCase()}
                </p>
                <p className="text-sm text-gray-700 mt-1">{data.description}</p>
                {data.features && data.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {data.features.map((feature, i) => (
                      <span key={i} className="text-xs bg-white px-2 py-1 rounded">
                        {feature}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Script Input */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">3. Script</h2>
          <div className="flex gap-2">
            {Object.keys(imageAnalysis).length > 0 && (
              <button
                onClick={generateScriptFromAnalysis}
                disabled={generatingScript}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  generatingScript
                    ? 'bg-gray-300 text-gray-500'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {generatingScript ? '✍️ Generating...' : '✨ Generate Script'}
              </button>
            )}
            {script && (
              <button
                onClick={() => {
                  if (confirm('Clear script?')) {
                    setScript('')
                    localStorage.removeItem('generatedScript')
                  }
                }}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Enter your ad script here, or generate one from the image analysis..."
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-sm text-gray-500 mt-2">
          {script.length === 0 ? '✨ Generate script from analysis or enter manually' : `${script.length} characters`}
        </p>
      </div>

      {/* Voice & Music Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">4. Voice, Music & Format</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Voice Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🎤 Voice Type
            </label>
            <select
              value={voiceType}
              onChange={(e) => setVoiceType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="alloy">Alloy (Neutral)</option>
              <option value="echo">Echo (Male)</option>
              <option value="fable">Fable (British Male)</option>
              <option value="onyx">Onyx (Deep Male)</option>
              <option value="nova">Nova (Female)</option>
              <option value="shimmer">Shimmer (Soft Female)</option>
            </select>
          </div>

          {/* Music Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🎵 Background Music
            </label>
            <select
              value={musicTrack}
              onChange={(e) => setMusicTrack(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="upbeat">Upbeat & Energetic</option>
              <option value="corporate">Corporate & Professional</option>
              <option value="calm">Calm & Relaxing</option>
              <option value="inspiring">Inspiring & Motivational</option>
              <option value="none">No Music</option>
            </select>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📐 Aspect Ratio
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="16:9">16:9 (Landscape)</option>
              <option value="9:16">9:16 (Vertical/Stories)</option>
              <option value="1:1">1:1 (Square)</option>
            </select>
          </div>
        </div>

        {/* Music Volume Control */}
        {musicTrack !== 'none' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔊 Music Volume: {musicVolume}%
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="5"
                max="50"
                value={musicVolume}
                onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm text-gray-600 min-w-[60px]">{musicVolume}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Lower = subtle background • Higher = more prominent
            </p>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={uploadedFiles.length === 0 || generatingVideo || !script.trim()}
          className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
            uploadedFiles.length === 0 || generatingVideo || !script.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
          }`}
        >
          {generatingVideo ? '⏳ Generating...' : '🚀 Generate Video Ad'}
        </button>
        
        {generationStep && (
          <div className="text-center">
            <p className="text-lg font-medium text-blue-600">{generationStep}</p>
            {generatingVideo && (
              <p className="text-sm text-gray-500 mt-1">This may take 1-3 minutes...</p>
            )}
          </div>
        )}
        
        {!script.trim() && uploadedFiles.length > 0 && (
          <p className="text-sm text-orange-600">
            ⚠️ Please generate or enter a script before creating video
          </p>
        )}
      </div>

      {/* Video Preview & Download */}
      {generatedVideo && (
        <div id="video-preview" className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow-lg p-8 border-2 border-green-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              🎉 Your Ad is Ready!
            </h2>
            <p className="text-gray-600">
              Duration: {generatedVideo.duration}s | Size: {generatedVideo.fileSize} MB
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <video
              controls
              className="w-full rounded-lg shadow-xl"
              src={`http://localhost:5000${generatedVideo.videoUrl}`}
            >
              Your browser does not support the video tag.
            </video>
          </div>
          
          <div className="flex justify-center gap-4 mt-6">
            <a
              href={`http://localhost:5000${generatedVideo.videoUrl}`}
              download={generatedVideo.videoFile}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
            >
              ⬇️ Download Video
            </a>
            
            <button
              onClick={() => setGeneratedVideo(null)}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              ✨ Create New Ad
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

