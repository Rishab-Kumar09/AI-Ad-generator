import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const app = express()
const PORT = process.env.PORT || 5000

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Check if API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY not found in environment variables!')
  console.error('Please create a .env file in the root directory with OPENAI_API_KEY=your-key')
} else {
  console.log('✅ OpenAI API Key loaded successfully')
  console.log(`Key starts with: ${process.env.OPENAI_API_KEY.substring(0, 10)}...`)
}

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static files from output directory
app.use('/output', express.static(path.join(__dirname, 'output')))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AdForge API is running' })
})

// Check API key status
app.get('/api/check-key', (req, res) => {
  const hasKey = !!process.env.OPENAI_API_KEY
  res.json({
    apiKeyConfigured: hasKey,
    keyPreview: hasKey ? `${process.env.OPENAI_API_KEY.substring(0, 7)}...${process.env.OPENAI_API_KEY.slice(-4)}` : 'NOT FOUND',
    message: hasKey 
      ? '✅ OpenAI API key is configured correctly' 
      : '❌ OpenAI API key not found. Please add OPENAI_API_KEY to your .env file'
  })
})

// Test vision API with a simple request
app.get('/api/test-vision', async (req, res) => {
  try {
    // Create a simple test image (1x1 pixel red PNG in base64)
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What color is this?' },
            { type: 'image_url', image_url: { url: testImage } }
          ]
        }
      ],
      max_tokens: 50
    })
    
    res.json({
      success: true,
      model: 'gpt-4o',
      response: response.choices[0].message.content,
      message: '✅ Vision API (gpt-4o - latest multimodal) is working!'
    })
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      errorCode: error.code,
      errorType: error.type,
      message: '❌ Vision API test failed. Check if your API key has access to gpt-4o vision model.'
    })
  }
})

// Image analysis with GPT Vision
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  let imagePath = null
  
  try {
    if (!req.file) {
      throw new Error('No file uploaded')
    }
    
    console.log('\n📸 === NEW IMAGE ANALYSIS ===')
    console.log('File:', req.file.originalname)
    console.log('Category:', req.body.category)
    console.log('Niche:', req.body.niche)
    console.log('File size:', (req.file.size / 1024).toFixed(2), 'KB')
    
    const { category, niche } = req.body
    imagePath = req.file.path
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error('Uploaded file not found on disk')
    }
    
    // Read image and convert to base64
    const imageBuffer = fs.readFileSync(imagePath)
    const base64Image = imageBuffer.toString('base64')
    const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`
    
    console.log(`Base64 size: ${(base64Image.length / 1024).toFixed(2)}KB`)
    console.log('MIME type:', req.file.mimetype)
    
    // Create niche-specific prompt
    let prompt = ''
    if (niche === 'real-estate') {
      prompt = `Analyze this ${category.replace('-', ' ')} image of a property. Describe in 2-3 sentences:
1. Key features and amenities
2. Design style and aesthetics
3. What makes it attractive to potential buyers/renters
Be specific and highlight benefits.`
    } else if (niche === 'e-commerce') {
      prompt = `Analyze this ${category.replace('-', ' ')} product image. Describe in 2-3 sentences:
1. Product features and quality
2. Design and aesthetics
3. What makes it appealing to customers`
    } else if (niche === 'fitness') {
      prompt = `Analyze this ${category.replace('-', ' ')} gym/fitness image. Describe in 2-3 sentences:
1. Equipment and facilities
2. Atmosphere and environment
3. What makes it attractive to fitness enthusiasts`
    } else {
      prompt = `Analyze this ${category.replace('-', ' ')} image and describe key features, benefits, and what makes it appealing in 2-3 sentences.`
    }
    
    console.log('Calling OpenAI Vision API (gpt-4o - latest multimodal)...')
    
    // Retry logic for gpt-4o (rate limits can cause intermittent failures)
    let response
    let retries = 3
    let lastError
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { 
                  type: 'image_url', 
                  image_url: { 
                    url: imageUrl,
                    detail: 'low'
                  } 
                }
              ]
            }
          ],
          max_tokens: 200
        })
        console.log(`✅ Success with gpt-4o on attempt ${attempt}`)
        break // Success! Exit retry loop
      } catch (error) {
        lastError = error
        console.log(`⚠️ Attempt ${attempt}/${retries} failed: ${error.message}`)
        
        if (attempt < retries) {
          // Wait before retrying (exponential backoff)
          const waitTime = 1000 * attempt // 1s, 2s, 3s
          console.log(`   Waiting ${waitTime}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }
    
    if (!response) {
      throw lastError // All retries failed
    }
    
    const analysis = response.choices[0].message.content
    console.log('✅ Analysis complete:', analysis.substring(0, 50) + '...')
    
    // Extract key features (simple keyword extraction)
    const features = extractFeatures(analysis)
    
    // Clean up uploaded file
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath)
    }
    
    res.json({
      analysis,
      features,
      category
    })
    
  } catch (error) {
    console.error('\n❌ === ERROR ANALYZING IMAGE ===')
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    console.error('Error type:', error.type)
    if (error.response) {
      console.error('API Response status:', error.response.status)
      console.error('API Response data:', JSON.stringify(error.response.data, null, 2))
    }
    console.error('Full error:', error)
    
    // Clean up uploaded file on error
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath)
      console.log('🗑️ Cleaned up uploaded file')
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze image',
      details: error.response?.data?.error?.message || error.message,
      errorCode: error.code,
      errorType: error.type
    })
  }
})

// Generate script from image analysis
app.post('/api/generate-script', async (req, res) => {
  try {
    const { niche, imageAnalysis, userScript } = req.body
    
    // If user provided a script, use it
    if (userScript && userScript.trim()) {
      return res.json({ script: userScript })
    }
    
    // Combine all analysis into one context
    const analysisText = Object.entries(imageAnalysis)
      .map(([fileName, data]) => {
        return `${data.category}: ${data.description}`
      })
      .join('\n\n')
    
    // Create prompt for script generation
    const prompt = `You are a professional ad copywriter. Based on the following image analysis of a ${niche} property/product, create a compelling 30-45 second video ad script.

Image Analysis:
${analysisText}

Requirements:
- Start with an attention-grabbing hook
- Highlight key features and benefits from the analysis
- Include emotional appeal
- End with a strong call-to-action
- Keep it concise and punchy (suitable for voiceover)
- Write in a conversational, engaging tone

Generate the script now:`
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert ad copywriter specializing in video scripts.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 500
    })
    
    const script = response.choices[0].message.content.trim()
    
    res.json({ script })
    
  } catch (error) {
    console.error('Error generating script:', error)
    res.status(500).json({ 
      error: 'Failed to generate script',
      details: error.message 
    })
  }
})

// Helper function to extract features
function extractFeatures(text) {
  const keywords = [
    'modern', 'spacious', 'natural light', 'hardwood', 'granite', 'stainless steel',
    'updated', 'luxury', 'cozy', 'bright', 'open concept', 'high ceilings',
    'backyard', 'pool', 'fireplace', 'balcony', 'parking', 'storage',
    'equipment', 'facility', 'amenity', 'premium', 'quality', 'design'
  ]
  
  const found = []
  const lowerText = text.toLowerCase()
  
  keywords.forEach(keyword => {
    if (lowerText.includes(keyword) && !found.includes(keyword)) {
      found.push(keyword)
    }
  })
  
  return found.slice(0, 5) // Return top 5
}

// Helper function to clean script (remove ALL stage directions)
function cleanScript(script) {
  let cleaned = script
  
  // Remove lines in square brackets [Scene X:], [Voiceover:], etc.
  cleaned = cleaned.replace(/\[.*?\]/g, '')
  
  // Remove markdown bold markers
  cleaned = cleaned.replace(/\*\*/g, '')
  
  // Remove "Voiceover:" at start of lines
  cleaned = cleaned.replace(/^Voiceover:\s*/gim, '')
  cleaned = cleaned.replace(/\n\s*Voiceover:\s*/gi, '\n')
  
  // Remove scene markers
  cleaned = cleaned.replace(/Scene \d+:/gi, '')
  cleaned = cleaned.replace(/\[Scene.*?\]/gi, '')
  
  // Remove any other common stage directions
  cleaned = cleaned.replace(/\(.*?\)/g, '') // Remove (parenthetical directions)
  cleaned = cleaned.replace(/--.*?--/g, '') // Remove --dash directions--
  
  // Remove extra whitespace and newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  cleaned = cleaned.replace(/^\s+|\s+$/gm, '') // Trim each line
  cleaned = cleaned.trim()
  
  console.log('Original script length:', script.length)
  console.log('Cleaned script length:', cleaned.length)
  console.log('Preview:', cleaned.substring(0, 100) + '...')
  
  return cleaned
}

// Generate voiceover using OpenAI TTS
app.post('/api/generate-voiceover', async (req, res) => {
  try {
    const { script, voice } = req.body
    
    if (!script) {
      return res.status(400).json({ error: 'Script is required' })
    }
    
    console.log('\n🎤 === GENERATING VOICEOVER ===')
    console.log('Voice:', voice)
    console.log('Original script length:', script.length, 'characters')
    
    // Clean the script - remove stage directions
    const cleanedScript = cleanScript(script)
    console.log('Cleaned script length:', cleanedScript.length, 'characters')
    console.log('Cleaned script preview:', cleanedScript.substring(0, 100) + '...')
    
    // Generate speech using OpenAI TTS
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice || 'alloy',
      input: cleanedScript,
      speed: 1.0
    })
    
    // Save the audio file
    const outputDir = path.join(__dirname, 'output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    const timestamp = Date.now()
    const audioPath = path.join(outputDir, `voiceover-${timestamp}.mp3`)
    
    const buffer = Buffer.from(await mp3Response.arrayBuffer())
    fs.writeFileSync(audioPath, buffer)
    
    console.log('✅ Voiceover generated:', audioPath)
    console.log('File size:', (buffer.length / 1024).toFixed(2), 'KB')
    
    res.json({
      success: true,
      audioPath: `/output/voiceover-${timestamp}.mp3`,
      audioFile: `voiceover-${timestamp}.mp3`,
      duration: Math.ceil(script.length / 15), // Approximate duration in seconds
      message: 'Voiceover generated successfully'
    })
    
  } catch (error) {
    console.error('❌ Error generating voiceover:', error)
    res.status(500).json({
      error: 'Failed to generate voiceover',
      details: error.message
    })
  }
})

// Helper function to segment script and match images with timing
function segmentScriptAndMatchImages(files, script, imageAnalysis) {
  console.log('\n📋 Segmenting script and matching images by timing...')
  
  // Parse imageAnalysis JSON if it's a string
  let analysis = {}
  try {
    analysis = typeof imageAnalysis === 'string' ? JSON.parse(imageAnalysis) : imageAnalysis
  } catch (e) {
    console.log('⚠️ No image analysis provided, using upload order')
    return { orderedFiles: files, durations: null }
  }
  
  const scriptLower = script.toLowerCase()
  const totalChars = script.length
  
  // Category keywords for matching
  const categoryKeywords = {
    'exterior': ['exterior', 'outside', 'front', 'entrance', 'pool', 'backyard', 'outdoor', 'property', 'home exterior'],
    'living-room': ['living room', 'living area', 'family room', 'lounge'],
    'kitchen': ['kitchen', 'cook', 'appliances', 'granite', 'countertop', 'dining'],
    'bedroom': ['bedroom', 'sleep', 'rest', 'sanctuary', 'retreat', 'master bedroom'],
    'bathroom': ['bathroom', 'bath', 'shower', 'vanity', 'tub']
  }
  
  // Group images by category
  const imagesByCategory = {}
  files.forEach(file => {
    const fileName = file.originalname
    const imageData = analysis[fileName] || {}
    const category = imageData.category || 'unknown'
    
    if (!imagesByCategory[category]) {
      imagesByCategory[category] = []
    }
    imagesByCategory[category].push(file)
  })
  
  // Find script segments for each category
  const segments = []
  
  for (const [category, images] of Object.entries(imagesByCategory)) {
    let earliestPosition = 999999
    let latestPosition = -1
    
    // Find all mentions of this category in script
    const keywords = categoryKeywords[category] || [category.replace('-', ' ')]
    
    for (const keyword of keywords) {
      let pos = 0
      while ((pos = scriptLower.indexOf(keyword, pos)) !== -1) {
        earliestPosition = Math.min(earliestPosition, pos)
        latestPosition = Math.max(latestPosition, pos + keyword.length)
        pos += keyword.length
      }
    }
    
    if (earliestPosition === 999999) {
      earliestPosition = totalChars // Put at end if not found
      latestPosition = totalChars
    }
    
    segments.push({
      category,
      images,
      startPos: earliestPosition,
      endPos: latestPosition,
      charLength: latestPosition - earliestPosition
    })
  }
  
  // Sort segments by start position
  segments.sort((a, b) => a.startPos - b.startPos)
  
  console.log('\nScript segments:')
  segments.forEach((seg, i) => {
    console.log(`  ${i + 1}. ${seg.category}: chars ${seg.startPos}-${seg.endPos} (${seg.images.length} images)`)
  })
  
  // Calculate timing for each segment (15 chars/second speech rate)
  const totalDuration = Math.ceil(totalChars / 15)
  const timings = []
  
  segments.forEach(seg => {
    const segmentDuration = Math.max(3, Math.ceil(seg.charLength / 15)) // Min 3 seconds per segment
    const durationPerImage = segmentDuration / seg.images.length
    
    seg.images.forEach(img => {
      timings.push(durationPerImage)
    })
  })
  
  // Flatten ordered images
  const orderedFiles = segments.flatMap(seg => seg.images)
  
  console.log('\nTimed image display:')
  let cumTime = 0
  orderedFiles.forEach((file, i) => {
    console.log(`  ${i + 1}. ${file.originalname.substring(0, 40)} - ${timings[i].toFixed(1)}s (at ${cumTime.toFixed(1)}s)`)
    cumTime += timings[i]
  })
  
  return { orderedFiles, durations: timings }
}

// Validation function to verify image-voiceover timing sync
function validateTimingSync(files, script, imageAnalysis, durations) {
  console.log('\n🔍 === TIMING VALIDATION REPORT ===')
  console.log('Received imageAnalysis:', imageAnalysis ? 'YES' : 'NO')
  console.log('Received durations:', durations ? 'YES' : 'NO')
  
  // Parse imageAnalysis
  let analysis = {}
  try {
    analysis = typeof imageAnalysis === 'string' ? JSON.parse(imageAnalysis) : imageAnalysis
    console.log('Parsed analysis entries:', Object.keys(analysis).length)
  } catch (e) {
    console.log('⚠️ Cannot validate - no image analysis data provided')
    console.log('Error:', e.message)
    return
  }
  
  if (Object.keys(analysis).length === 0) {
    console.log('⚠️ Cannot validate - analysis object is empty')
    return
  }
  
  const cleanedScript = cleanScript(script)
  const scriptLower = cleanedScript.toLowerCase()
  
  // Speech rate: ~15 characters per second
  const CHARS_PER_SECOND = 15
  
  // Category keywords
  const categoryKeywords = {
    'exterior': ['exterior', 'outside', 'front', 'entrance', 'pool', 'backyard', 'outdoor', 'property'],
    'living-room': ['living room', 'living area', 'family room', 'lounge'],
    'kitchen': ['kitchen', 'cook', 'appliances', 'granite', 'countertop', 'dining'],
    'bedroom': ['bedroom', 'sleep', 'rest', 'sanctuary', 'retreat', 'master bedroom'],
    'bathroom': ['bathroom', 'bath', 'shower', 'vanity', 'tub']
  }
  
  console.log('\n📊 Timeline (what words are spoken when):')
  console.log('═'.repeat(80))
  
  // Build timeline
  let cumTime = 0
  const timeline = []
  
  files.forEach((file, index) => {
    const fileName = file.originalname
    const imageData = analysis[fileName] || {}
    const category = imageData.category || 'unknown'
    const duration = durations[index]
    const startTime = cumTime
    const endTime = cumTime + duration
    
    // Find when this category is mentioned in voiceover
    const keywords = categoryKeywords[category] || [category.replace('-', ' ')]
    let mentionedAt = []
    
    keywords.forEach(keyword => {
      let pos = 0
      while ((pos = scriptLower.indexOf(keyword, pos)) !== -1) {
        const timeInVoiceover = pos / CHARS_PER_SECOND
        mentionedAt.push({ keyword, time: timeInVoiceover, position: pos })
        pos += keyword.length
      }
    })
    
    timeline.push({
      index: index + 1,
      fileName,
      category,
      startTime,
      endTime,
      duration,
      mentionedAt
    })
    
    cumTime += duration
  })
  
  // Display timeline
  timeline.forEach(item => {
    const timeRange = `${item.startTime.toFixed(1)}s - ${item.endTime.toFixed(1)}s`
    console.log(`\n${item.index}. ${item.category.toUpperCase()} | ${timeRange} (${item.duration.toFixed(1)}s)`)
    console.log(`   Image: ${item.fileName.substring(0, 50)}`)
    
    if (item.mentionedAt.length > 0) {
      console.log(`   ✅ Category mentioned in voiceover at:`)
      item.mentionedAt.forEach(mention => {
        const inSync = mention.time >= item.startTime && mention.time <= item.endTime
        const syncIcon = inSync ? '✅' : '⚠️'
        console.log(`      ${syncIcon} "${mention.keyword}" at ${mention.time.toFixed(1)}s ${inSync ? '(IN SYNC!)' : '(OUT OF SYNC!!)'}`)
      })
    } else {
      console.log(`   ⚠️ Category "${item.category}" NOT mentioned in voiceover`)
    }
  })
  
  // Sync accuracy report
  console.log('\n' + '═'.repeat(80))
  console.log('📈 SYNC ACCURACY:')
  
  let inSyncCount = 0
  let totalWithMentions = 0
  
  timeline.forEach(item => {
    if (item.mentionedAt.length > 0) {
      totalWithMentions++
      const hasSync = item.mentionedAt.some(m => m.time >= item.startTime && m.time <= item.endTime)
      if (hasSync) inSyncCount++
    }
  })
  
  const accuracy = totalWithMentions > 0 ? (inSyncCount / totalWithMentions * 100) : 0
  console.log(`   Images in sync: ${inSyncCount}/${totalWithMentions} (${accuracy.toFixed(1)}%)`)
  
  if (accuracy >= 90) {
    console.log('   🎉 EXCELLENT SYNC! Images match voiceover perfectly!')
  } else if (accuracy >= 70) {
    console.log('   ✅ GOOD SYNC! Most images match voiceover.')
  } else if (accuracy >= 50) {
    console.log('   ⚠️ MODERATE SYNC. Some images may not match voiceover.')
  } else {
    console.log('   ❌ POOR SYNC. Images do not match voiceover well.')
  }
  
  console.log('═'.repeat(80))
  console.log('')
}

// Generate complete video ad
app.post('/api/generate-video', upload.array('images', 20), async (req, res) => {
  try {
    const { script, voice, music, musicVolume, niche, aspectRatio, imageAnalysis } = req.body
    
    console.log('\n🎬 === GENERATING VIDEO AD ===')
    console.log('Images:', req.files.length)
    console.log('Voice:', voice)
    console.log('Music:', music)
    console.log('Music Volume:', musicVolume || 15, '%')
    console.log('Niche:', niche)
    console.log('Aspect Ratio:', aspectRatio || '16:9')
    
    // Segment script and match images with proper timing
    const { orderedFiles, durations } = segmentScriptAndMatchImages(req.files, script, imageAnalysis)
    req.files = orderedFiles
    const imageDurations = durations
    
    // Debug: Check what we're passing to validation
    console.log('\n🔧 DEBUG: Calling validation with:')
    console.log('   Files:', req.files.length)
    console.log('   Script length:', script ? script.length : 0)
    console.log('   ImageAnalysis type:', typeof imageAnalysis)
    console.log('   ImageAnalysis present:', imageAnalysis ? 'YES' : 'NO')
    console.log('   Durations:', imageDurations ? imageDurations.length : 0)
    
    // Validate timing sync and show detailed report
    validateTimingSync(req.files, script, imageAnalysis, imageDurations)
    
    const outputDir = path.join(__dirname, 'output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    const timestamp = Date.now()
    
    // Step 1: Clean and generate voiceover
    console.log('\n🎤 Step 1: Generating voiceover...')
    const cleanedScript = cleanScript(script)
    console.log('Cleaned script for TTS')
    
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice || 'alloy',
      input: cleanedScript,
      speed: 1.0
    })
    
    const voiceoverPath = path.join(outputDir, `voice-${timestamp}.mp3`)
    const voiceBuffer = Buffer.from(await mp3Response.arrayBuffer())
    fs.writeFileSync(voiceoverPath, voiceBuffer)
    console.log('✅ Voiceover saved:', voiceoverPath)
    
    // Step 2: Calculate total duration
    const estimatedDuration = imageDurations ? imageDurations.reduce((a, b) => a + b, 0) : Math.max(10, Math.ceil(cleanedScript.length / 15))
    
    console.log(`\n⏱️ Video duration: ${estimatedDuration.toFixed(1)}s (timed to match voiceover)`)
    
    // Step 3: Create video from images (create clips first, then concat)
    console.log('\n🎨 Step 2: Creating video from images...')
    
    // Determine resolution based on aspect ratio
    let width = 1920, height = 1080 // 16:9
    if (aspectRatio === '9:16') {
      width = 1080
      height = 1920 // Vertical
    } else if (aspectRatio === '1:1') {
      width = 1080
      height = 1080 // Square
    }
    
    console.log(`Creating slideshow video from ${req.files.length} images...`)
    
    // WORKING SOLUTION: Convert JPEGs to PNG first (handles corrupted JPEGs)
    const tempImageDir = path.join(outputDir, `imgs-${timestamp}`)
    if (!fs.existsSync(tempImageDir)) {
      fs.mkdirSync(tempImageDir, { recursive: true })
    }
    
    console.log('Converting images to clean format...')
    for (let i = 0; i < req.files.length; i++) {
      const targetPath = path.join(tempImageDir, `img${String(i).padStart(4, '0')}.png`)
      // Convert to PNG to handle any JPEG encoding issues
      const convertCmd = `ffmpeg -i "${req.files[i].path}" -y "${targetPath}"`
      await execPromise(convertCmd)
      console.log(`✓ Image ${i + 1}/${req.files.length} converted`)
    }
    
    console.log(`✅ ${req.files.length} images ready`)
    
    // Create individual video clips with custom durations for each image
    const videoNoAudioPath = path.join(outputDir, `video-no-audio-${timestamp}.mp4`)
    const clipDir = path.join(outputDir, `clips-${timestamp}`)
    if (!fs.existsSync(clipDir)) {
      fs.mkdirSync(clipDir, { recursive: true })
    }
    
    console.log('Creating video clips with timed durations...')
    for (let i = 0; i < req.files.length; i++) {
      const imgPath = path.join(tempImageDir, `img${String(i).padStart(4, '0')}.png`)
      const clipPath = path.join(clipDir, `clip${String(i).padStart(4, '0')}.mp4`)
      const duration = imageDurations ? imageDurations[i] : (estimatedDuration / req.files.length)
      
      // Create clip with specific duration using universal FFmpeg syntax
      const createClipCmd = `ffmpeg -r 1 -i "${imgPath}" -t ${duration} -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=30" -c:v libx264 -pix_fmt yuv420p -y "${clipPath}"`
      await execPromise(createClipCmd)
      console.log(`✓ Clip ${i + 1}/${req.files.length} created (${duration.toFixed(1)}s)`)
    }
    
    // Create concat file
    const concatListPath = path.join(outputDir, `concat-${timestamp}.txt`)
    const concatContent = req.files.map((_, i) => {
      const clipPath = path.join(clipDir, `clip${String(i).padStart(4, '0')}.mp4`).replace(/\\/g, '/')
      return `file '${clipPath}'`
    }).join('\n')
    fs.writeFileSync(concatListPath, concatContent)
    
    // Concatenate all clips with their specific durations
    console.log('Concatenating clips...')
    const createVideoCmd = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy -y "${videoNoAudioPath}"`
    await execPromise(createVideoCmd)
    console.log('✅ Video created with timed images (no audio)')
    
    // Clean up temp images and clips
    console.log('Cleaning up temp files...')
    const tempImages = fs.readdirSync(tempImageDir)
    tempImages.forEach(img => {
      fs.unlinkSync(path.join(tempImageDir, img))
    })
    fs.rmdirSync(tempImageDir)
    
    const tempClips = fs.readdirSync(clipDir)
    tempClips.forEach(clip => {
      fs.unlinkSync(path.join(clipDir, clip))
    })
    fs.rmdirSync(clipDir)
    fs.unlinkSync(concatListPath)
    console.log('✅ Temp files cleaned')
    
    // Step 4: Add voiceover + background music to video
    console.log('\n🔊 Step 3: Adding audio (voiceover + music) to video...')
    const finalVideoPath = path.join(outputDir, `ad-${timestamp}.mp4`)
    
    let ffmpegAddAudio
    
    if (music && music !== 'none') {
      // Get music file path based on selection
      const musicDir = path.join(__dirname, 'music')
      const musicFiles = {
        'upbeat': 'upbeat.mp3',
        'corporate': 'corporate.mp3',
        'calm': 'calm.mp3',
        'inspiring': 'inspiring.mp3'
      }
      
      const musicPath = path.join(musicDir, musicFiles[music] || 'upbeat.mp3')
      
      // Check if music file exists
      if (fs.existsSync(musicPath)) {
        const volumeDecimal = (parseInt(musicVolume) || 15) / 100
        console.log(`🎵 Adding background music: ${music} (${musicVolume || 15}% volume = ${volumeDecimal})`)
        
        // Mix voiceover (100% volume) + background music (user-defined volume)
        // Loop music if it's shorter than video, fade out at end
        ffmpegAddAudio = `ffmpeg -i "${videoNoAudioPath}" -stream_loop -1 -i "${musicPath}" -i "${voiceoverPath}" -filter_complex "[1:a]volume=${volumeDecimal},afade=t=out:st=${estimatedDuration - 3}:d=3[music];[2:a]volume=1.0[voice];[music][voice]amix=inputs=2:duration=shortest:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${finalVideoPath}"`
      } else {
        console.log(`⚠️ Music file not found: ${musicPath}`)
        console.log('Adding voiceover only')
        ffmpegAddAudio = `ffmpeg -i "${videoNoAudioPath}" -i "${voiceoverPath}" -c:v copy -c:a aac -shortest "${finalVideoPath}"`
      }
    } else {
      console.log('No background music selected - voiceover only')
      ffmpegAddAudio = `ffmpeg -i "${videoNoAudioPath}" -i "${voiceoverPath}" -c:v copy -c:a aac -shortest "${finalVideoPath}"`
    }
    
    await execPromise(ffmpegAddAudio)
    console.log('✅ Audio mixed and added to video')
    
    // Step 5: Cleanup temp files
    console.log('\n🗑️ Cleaning up temporary files...')
    if (fs.existsSync(videoNoAudioPath)) {
      fs.unlinkSync(videoNoAudioPath)
    }
    if (fs.existsSync(voiceoverPath)) {
      fs.unlinkSync(voiceoverPath)
    }
    
    // Cleanup uploaded images
    req.files.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path)
      }
    })
    
    console.log('✅ Cleanup complete')
    
    // Get final file size
    const stats = fs.statSync(finalVideoPath)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    
    console.log('\n🎉 === VIDEO GENERATION COMPLETE ===')
    console.log('File:', `ad-${timestamp}.mp4`)
    console.log('Size:', fileSizeMB, 'MB')
    console.log('Duration:', estimatedDuration, 'seconds')
    
    res.json({
      success: true,
      videoUrl: `/output/ad-${timestamp}.mp4`,
      videoFile: `ad-${timestamp}.mp4`,
      duration: estimatedDuration,
      fileSize: fileSizeMB,
      message: 'Video ad generated successfully!'
    })
    
  } catch (error) {
    console.error('\n❌ === VIDEO GENERATION FAILED ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    
    // Cleanup on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      })
    }
    
    res.status(500).json({
      error: 'Failed to generate video',
      details: error.message
    })
  }
})

// Check if FFmpeg is installed
app.get('/api/check-ffmpeg', async (req, res) => {
  try {
    const { stdout } = await execPromise('ffmpeg -version')
    res.json({
      installed: true,
      version: stdout.split('\n')[0],
      message: '✅ FFmpeg is installed'
    })
  } catch (error) {
    res.json({
      installed: false,
      message: '❌ FFmpeg is not installed. Please install FFmpeg to generate videos.',
      installUrl: 'https://ffmpeg.org/download.html'
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AdForge backend running on http://localhost:${PORT}`)
})

