# AdForge - AI-Powered Ad Generator

Create stunning video ads in minutes using AI.

## Setup Instructions

### 1. Install Dependencies
```bash
npm run install-all
```

### 2. Configure Environment
```bash
cd backend
cp .env.example .env
# Add your OpenAI API key to .env
```

### 3. Run Development Servers
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Tech Stack
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **AI**: OpenAI GPT-4 + TTS
- **Video**: FFmpeg

## ✅ MVP COMPLETE! (Day 1-4)
- [x] Upload UI with drag & drop
- [x] Image categorization by room/product type
- [x] GPT-4o Vision AI analysis
- [x] Script cleaning (removes stage directions)
- [x] Auto script generation from analysis
- [x] OpenAI TTS voiceover (6 voices)
- [x] **Background music mixing with adjustable volume (5-50%)**
- [x] FFmpeg video assembly with transitions
- [x] Multiple aspect ratios (16:9, 9:16, 1:1)
- [x] Video preview & download
- [x] localStorage persistence

## 🎬 Complete Workflow
1. **Upload images** → categorize each (e.g., Living Room, Kitchen)
2. **AI Vision analyzes** → extracts features & benefits
3. **Generate script** → AI creates compelling copy (auto-cleans stage directions)
4. **Customize**:
   - Voice type (Alloy, Nova, Onyx, etc.)
   - Background music (Upbeat, Corporate, Calm, Inspiring)
   - **Music volume** (5-50%, default 15%)
   - Aspect ratio (16:9, 9:16, 1:1)
5. **Generate video** → Voiceover + Music + Transitions
6. **Preview & Download** → Ready-to-publish MP4!

## 🎵 Music Setup (Required)
Add 4 royalty-free MP3 files to `backend/music/`:
- `upbeat.mp3`
- `corporate.mp3`
- `calm.mp3`
- `inspiring.mp3`

See `backend/music/GET_MUSIC.md` for free sources!

