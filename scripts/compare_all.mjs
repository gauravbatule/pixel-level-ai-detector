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
    expected: "Likely AI Inpainted / AI Edited (Red Road)"
  },
  {
    name: "2. Desert Path + Flowers (ChatGPT Inpaint)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 02_04_31 PM.png",
    expected: "Likely AI Inpainted / AI Edited (Red Road + Purple/Yellow Flowers)"
  },
  {
    name: "3. Aniwatch reCAPTCHA Inpaint (Screenshot Edit)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 04_36_35 PM.png",
    expected: "AI Inpainted / Modal Insertion"
  },
  {
    name: "4. Instagram Reel Screenshot (Authentic Video + Subtitles)",
    path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg",
    expected: "Authentic Screenshot / Graphic (Low Score, No Text AI False Positives)"
  }
];

async function runBenchmark() {
  console.log("================================================================================");
  console.log("  SYNTHREX AI DETECTOR — AUTOMATED MULTI-IMAGE FORENSIC BENCHMARK SUITE");
  console.log("================================================================================\n");

  for (const imgConfig of TEST_IMAGES) {
    if (!fs.existsSync(imgConfig.path)) {
      console.log(`[SKIPPED] ${imgConfig.name} - File not found: ${imgConfig.path}\n`);
      continue;
    }

    console.log(`=======================================================`);
    console.log(`CASE: ${imgConfig.name}`);
    console.log(`File: ${path.basename(imgConfig.path)}`);
    console.log(`Target: ${imgConfig.expected}`);
    console.log(`-------------------------------------------------------`);

    const image = sharp(imgConfig.path);
    const metadata = await image.metadata();
    
    // Scale down if oversized (same as client browser pipeline)
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
    const imgData = {
      data: new Uint8ClampedArray(data),
      width: info.width,
      height: info.height,
    };

    const isLossless = imgConfig.path.endsWith('.png');

    for (const mode of ['normal', 'balanced', 'strict']) {
      const pixelRes = performPixelForensics(imgData, info.width, info.height, isLossless, mode);
      const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
      const scoreRes = computeCompositeScore(null, noiseRes, null, null, null, pixelRes, mode);

      console.log(`  [MODE: ${mode.toUpperCase()}]`);
      console.log(`    Score:          ${scoreRes.overallScore}%`);
      console.log(`    Classification: ${scoreRes.classification} (${scoreRes.confidence} Confidence)`);
      console.log(`    Edited Area:    ${scoreRes.editedAreaPercent}%`);
      console.log(`    Pixel Forensic: ${scoreRes.breakdown.pixel.score}%`);
      console.log(`    Graphic Mod:    ${pixelRes.isDigitalGraphic ? "SCREENSHOT/UI" : "PHOTOGRAPHIC"}`);
      console.log(`    Text Protected: ${(pixelRes.digitalTextRatio * 100).toFixed(1)}% of canvas`);
    }
    console.log("");
  }
}

runBenchmark().catch(console.error);
