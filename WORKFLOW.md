# AdForge Enhanced Workflow

## 🎬 Complete User Journey

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Upload & Categorize                            │
│  • User uploads 3-10 images/videos                      │
│  • Drag & drop or click to browse                       │
│  • Select category for EACH image:                      │
│    - Real Estate: Living Room, Kitchen, Bedroom, etc.   │
│    - E-commerce: Main Product, Detail, Lifestyle        │
│    - Fitness: Gym Floor, Equipment, Classes             │
│    - Coaching: Headshot, Workspace, Results             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 2: AI Vision Analysis (GPT-4 Vision)              │
│  • Click "Analyze Images with AI Vision"                │
│  • For EACH image, GPT-4o-mini Vision:                  │
│    ✓ Identifies features & amenities                    │
│    ✓ Describes style & aesthetics                       │
│    ✓ Extracts customer benefits                         │
│    ✓ Finds unique selling points                        │
│  • Results saved to localStorage                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 3: Review Analysis                                │
│  • See analysis for each image in UI                    │
│  • Key features shown as tags                           │
│  • Full descriptions visible                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Generate Script (or Write Manual)              │
│  • Option A: Click "Generate Script from Analysis"      │
│    - GPT-4o-mini combines ALL analysis                  │
│    - Creates 30-45 sec compelling script                │
│    - Includes hook, features, CTA                       │
│  • Option B: Write your own script                      │
│  • Script saved to localStorage                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 5: Customize Voice & Music                        │
│  • Select TTS voice (6 options):                        │
│    - Alloy, Echo, Fable, Onyx, Nova, Shimmer           │
│  • Select background music style:                       │
│    - Upbeat, Corporate, Calm, Inspiring, None           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 6: Generate Video (Coming Day 3-4)                │
│  • Click "Generate Video Ad"                            │
│  • Backend processes:                                   │
│    1. Generate voiceover (OpenAI TTS)                   │
│    2. Assemble video (FFmpeg)                           │
│    3. Add text overlays                                 │
│    4. Sync audio + music                                │
│    5. Export in selected aspect ratio                   │
└─────────────────────────────────────────────────────────┘
```

## 🧠 AI Components

### GPT-4 Vision (Image Analysis)
- **Model:** gpt-4o-mini with vision
- **Input:** Base64 encoded images + category context
- **Output:** Detailed feature descriptions
- **Cost:** ~$0.01 per image

### GPT-4 (Script Generation)
- **Model:** gpt-4o-mini
- **Input:** Combined analysis from all images
- **Output:** 30-45 second ad script
- **Cost:** ~$0.02 per script

### OpenAI TTS (Coming Day 3)
- **Voices:** 6 natural-sounding options
- **Input:** Generated script
- **Output:** MP3 voiceover
- **Cost:** ~$0.015 per 1000 characters

## 💾 Data Storage

### localStorage Keys:
```javascript
{
  "imageAnalysis": {
    "image1.jpg": {
      "category": "living-room",
      "description": "Spacious living room with...",
      "features": ["modern", "natural light", "hardwood"]
    }
  },
  "generatedScript": "Imagine coming home to..."
}
```

## 🎯 Why This Workflow?

1. **Categorization** helps AI understand context
2. **Vision analysis** extracts details humans might miss
3. **localStorage** preserves work (no database needed for MVP)
4. **Script generation** saves time while allowing edits
5. **Voice/music choice** personalizes the ad

## 📱 Mobile Considerations

Currently desktop-optimized, but responsive design includes:
- Grid → Single column on mobile
- Touch-friendly dropdowns
- Scrollable analysis section

## 🔜 Next: Day 3-4

- TTS integration for voiceover
- FFmpeg pipeline for video assembly
- Text overlay generation
- Music integration
- Preview & download

