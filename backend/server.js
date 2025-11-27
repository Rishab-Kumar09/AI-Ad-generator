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

// Helper function to clean script (remove stage directions)
function cleanScript(script) {
  let cleaned = script
  
  // Remove lines in square brackets [Scene X:], [Voiceover:], etc.
  cleaned = cleaned.replace(/\[.*?\]/g, '')
  
  // Remove markdown bold markers
  cleaned = cleaned.replace(/\*\*/g, '')
  
  // Remove extra whitespace and newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  cleaned = cleaned.trim()
  
  console.log('Original script length:', script.length)
  console.log('Cleaned script length:', cleaned.length)
  
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

// Generate complete video ad
app.post('/api/generate-video', upload.array('images', 20), async (req, res) => {
  try {
    const { script, voice, music, musicVolume, niche, aspectRatio } = req.body
    
    console.log('\n🎬 === GENERATING VIDEO AD ===')
    console.log('Images:', req.files.length)
    console.log('Voice:', voice)
    console.log('Music:', music)
    console.log('Music Volume:', musicVolume || 15, '%')
    console.log('Niche:', niche)
    console.log('Aspect Ratio:', aspectRatio || '16:9')
    
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
    
    // Step 2: Calculate duration from cleaned script
    const estimatedDuration = Math.max(10, Math.ceil(cleanedScript.length / 15))
    const durationPerImage = estimatedDuration / req.files.length
    
    console.log(`\n⏱️ Video duration: ${estimatedDuration}s (~${durationPerImage.toFixed(1)}s per image)`)
    
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
    
    console.log(`Creating ${req.files.length} video clips (${durationPerImage.toFixed(1)}s each)...`)
    
    // Step 3a: Convert each image to a video clip
    const videoClips = []
    for (let i = 0; i < req.files.length; i++) {
      const clipPath = path.join(outputDir, `clip-${timestamp}-${i}.mp4`)
      const imagePath = req.files[i].path
      
      // Create a video clip from this image (FFmpeg 8.x compatible)
      // -loop 1 repeats the image, -t sets duration, -r sets output framerate
      const createClipCmd = `ffmpeg -loop 1 -i "${imagePath}" -t ${durationPerImage} -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2" -r 30 -c:v libx264 -pix_fmt yuv420p "${clipPath}"`
      
      await execPromise(createClipCmd)
      videoClips.push(clipPath)
      console.log(`✓ Clip ${i + 1}/${req.files.length} created`)
    }
    
    console.log('✅ All clips created. Concatenating...')
    
    // Step 3b: Create concat file listing all video clips
    const concatFilePath = path.join(outputDir, `concat-${timestamp}.txt`)
    let concatContent = ''
    
    videoClips.forEach(clipPath => {
      const escapedPath = clipPath.replace(/\\/g, '/')
      concatContent += `file '${escapedPath}'\n`
    })
    
    fs.writeFileSync(concatFilePath, concatContent)
    
    // Step 3c: Concatenate all clips into final video
    const videoNoAudioPath = path.join(outputDir, `video-no-audio-${timestamp}.mp4`)
    const concatCmd = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${videoNoAudioPath}"`
    
    await execPromise(concatCmd)
    console.log('✅ Video concatenated')
    
    // Clean up clip files and concat file
    videoClips.forEach(clipPath => {
      if (fs.existsSync(clipPath)) {
        fs.unlinkSync(clipPath)
      }
    })
    if (fs.existsSync(concatFilePath)) {
      fs.unlinkSync(concatFilePath)
    }
    
    console.log('✅ Video created (no audio)')
    
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

