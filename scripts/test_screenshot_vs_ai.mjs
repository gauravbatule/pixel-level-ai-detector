import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const aiPngs = [
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_39 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_36 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_30 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png",
];

const screenshots = [
  "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png"
];

async function checkPureSolid() {
  console.log("=== AI PNGs ===");
  for (const p of aiPngs) {
    if (!fs.existsSync(p)) continue;
    const { data, info } = await sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let pureFlatPixels = 0;
    const total = info.width * info.height;
    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      // Check if neighboring pixels are exact match
      if (i > 0) {
        const prevIdx = (i - 1) * 4;
        if (r === data[prevIdx] && g === data[prevIdx+1] && b === data[prevIdx+2]) {
          pureFlatPixels++;
        }
      }
    }
    console.log(`  ${path.basename(p)}: pureFlatPixels = ${(pureFlatPixels/total*100).toFixed(1)}%`);
  }

  console.log("\n=== Real Screenshots ===");
  for (const p of screenshots) {
    if (!fs.existsSync(p)) continue;
    const { data, info } = await sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let pureFlatPixels = 0;
    const total = info.width * info.height;
    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      if (i > 0) {
        const prevIdx = (i - 1) * 4;
        if (r === data[prevIdx] && g === data[prevIdx+1] && b === data[prevIdx+2]) {
          pureFlatPixels++;
        }
      }
    }
    console.log(`  ${path.basename(p)}: pureFlatPixels = ${(pureFlatPixels/total*100).toFixed(1)}%`);
  }
}

checkPureSolid().catch(console.error);
