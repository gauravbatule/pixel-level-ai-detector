import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

import { performPixelForensics } from '../lib/analysis/pixelForensics.js';
import { performNoiseAnalysis } from '../lib/analysis/noise.js';
import { computeCompositeScore } from '../lib/analysis/scoring.js';

const TEST_IMAGES = [
  {
    name: "1. Red Desert Path (ChatGPT Inpaint)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 01_12_07 PM.png",
  },
  {
    name: "2. Desert Path + Flowers (ChatGPT Inpaint)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 02_04_31 PM.png",
  },
  {
    name: "3. Aniwatch reCAPTCHA Inpaint (Screenshot Edit)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 04_36_35 PM.png",
  },
  {
    name: "4. Instagram Reel Screenshot (Authentic Video + Subtitles)",
    path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg",
  }
];

async function run() {
  console.log("=== BASELINE RESULTS (Commit 05a6596) ===\n");
  for (const imgConfig of TEST_IMAGES) {
    if (!fs.existsSync(imgConfig.path)) continue;

    console.log(`--- ${imgConfig.name} ---`);
    const image = sharp(imgConfig.path);
    const metadata = await image.metadata();
    
    const maxDim = 1200;
    let w = metadata.width;
    let h = metadata.height;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      image.resize(w, h);
    }

    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

    const pixelRes = performPixelForensics(imgData, info.width, info.height, false);
    const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
    const scoreRes = computeCompositeScore(null, noiseRes, null, null, null, pixelRes);

    console.log(`  Overall Score:   ${scoreRes.overallScore}%`);
    console.log(`  Classification:  ${scoreRes.classification} (${scoreRes.confidence})`);
    console.log(`  Edited Area:     ${scoreRes.editedAreaPercent}%`);
    console.log(`  Pixel Score:     ${scoreRes.breakdown.pixel.score}%`);
    console.log(`  Avg Suspicion:   ${(pixelRes.stats.averageSuspicion * 100).toFixed(2)}%`);
    console.log("");
  }
}

run().catch(console.error);
