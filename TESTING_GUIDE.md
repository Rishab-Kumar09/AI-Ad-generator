# Testing Guide for AdForge

## ⚙️ Setup

1. **Add your OpenAI API Key:**
   ```bash
   # Edit backend/.env
   OPENAI_API_KEY=sk-proj-xxxxx
   ```

2. **Restart servers** (if already running):
   - Stop with Ctrl+C
   - Run: `npm run dev`

## 🧪 Testing the New Features

### Test 1: Image Upload with Categorization
1. Go to http://localhost:3000
2. Upload 3-5 images (real estate, product, or any images)
3. **For each image**, select a category from dropdown:
   - Real Estate: Exterior, Living Room, Kitchen, etc.
   - E-commerce: Main Product, Detail Shot, etc.
4. ✅ Verify categories are saved for each image

### Test 2: AI Vision Analysis
1. After categorizing all images
2. Click **"🔍 Analyze Images with AI Vision"**
3. Wait ~5-10 seconds per image
4. ✅ Check that each image shows:
   - Green checkmark ✓
   - Brief analysis preview
5. ✅ Scroll to **"📊 Image Analysis Results"** section
   - Should show full analysis for each image
   - Features extracted as tags

### Test 3: Script Generation
1. After analysis completes
2. Click **"✨ Generate Script from Analysis"**
3. Wait ~5 seconds
4. ✅ Script appears in textarea
5. ✅ Should be a compelling 30-45 second ad script
6. You can edit the script manually if needed

### Test 4: Voice & Music Selection
1. Scroll to **"4. Voice & Music"** section
2. Try different voices:
   - Alloy (neutral)
   - Echo (male)
   - Nova (female)
   - etc.
3. Select background music style
4. ✅ Selections are saved

### Test 5: localStorage Persistence
1. Complete analysis & script generation
2. Refresh the page (F5)
3. ✅ Analysis results should still be visible
4. ✅ Generated script should still be there

## 🐛 Troubleshooting

**Error: "Failed to analyze image"**
- Check OpenAI API key in `backend/.env`
- Check console for specific error
- Ensure images are < 50MB

**Analysis not appearing:**
- Open browser DevTools (F12) → Network tab
- Click "Analyze" and check if API calls succeed
- Look at Console tab for errors

**Script generation fails:**
- Ensure at least one image is analyzed
- Check OpenAI API has credits

## 📊 What to Observe

1. **Image categories** change based on niche selection
2. **Analysis quality** - GPT Vision should describe features accurately
3. **Script quality** - Should incorporate info from multiple images
4. **localStorage** - Data persists across page refreshes

## 🎯 Expected Behavior

**Real Estate Example:**
- Upload: exterior, living room, kitchen images
- Analysis: "Spacious living room with natural light, modern kitchen with granite countertops..."
- Script: "Imagine coming home to this beautiful 3-bedroom sanctuary..."

**E-commerce Example:**
- Upload: product photos from different angles
- Analysis: "High-quality leather finish, attention to detail in stitching..."
- Script: "Introducing the perfect blend of style and functionality..."

