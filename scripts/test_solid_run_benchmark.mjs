import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const allImages = [
  // REAL SCREENSHOTS
  { name: "Real UI Screenshot (aimetadatacleaner)", path: "C:/Users/Gaurav Batule/.gemini/antigravity/brain/d01aa755-7a0f-416c-b273-8ef496152c7d/.user_uploaded/media_1787425703724.png", isScreenshot: true },
  { name: "Real Reel Screenshot", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg", isScreenshot: true },
  { name: "Real LinkedIn Screenshot", path: "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png", isScreenshot: true },
  
  // AI GENERATIONS (PNGs & JPEGs)
  { name: "AI Crow Infographic (100% AI)", path: "C:/Users/Gaurav Batule/.gemini/antigravity/brain/d01aa755-7a0f-416c-b273-8ef496152c7d/.user_uploaded/media_1787424162222.jpg", isScreenshot: false },
  { name: "AI Gen New 1 (Aug 23 00:04:39)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_39 AM.png", isScreenshot: false },
  { name: "AI Gen New 2 (Aug 23 00:04:36)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_36 AM.png", isScreenshot: false },
  { name: "AI Gen New 3 (Aug 23 00:04:30)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_30 AM.png", isScreenshot: false },
  { name: "AI Gen 1 (Jul 21 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png", isScreenshot: false },
  { name: "AI Gen 2 (Jul 27 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png", isScreenshot: false },
  { name: "AI Gen 3 (Jun 14 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png", isScreenshot: false },
  { name: "AI Gen 4 (Jun 15 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png", isScreenshot: false },
  { name: "AI Gen 5 (Jun 28 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png", isScreenshot: false },
  { name: "AI Gen 6 (Aug 22 WhatsApp JPEG)", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg", isScreenshot: false },
];

async function run() {
  console.log("Image Name | Type | Exact Flat Match %");
  console.log("----------------------------------------------------------");
  for (const img of allImages) {
    if (!fs.existsSync(img.path)) continue;
    const { data, info } = await sharp(img.path).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    
    let exactMatches = 0;
    for (let y = 0; y < info.height; y++) {
      const row = y * info.width * 4;
      for (let x = 1; x < info.width; x++) {
        const idx = row + x * 4;
        const prevIdx = row + (x - 1) * 4;
        if (data[idx] === data[prevIdx] && data[idx+1] === data[prevIdx+1] && data[idx+2] === data[prevIdx+2]) {
          exactMatches++;
        }
      }
    }
    const ratio = (exactMatches / (info.width * info.height)) * 100;
    console.log(`${img.name.padEnd(35)} | ${img.isScreenshot ? 'SCREENSHOT' : 'AI IMAGE  '} | ${ratio.toFixed(1)}%`);
  }
}

run().catch(console.error);
