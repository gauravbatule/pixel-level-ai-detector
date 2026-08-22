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
import { performFrequencyAnalysis } from '../lib/analysis/frequency.js';

function analyzeHighPassResiduals(pixels, width, height) {
  const numPixels = width * height;
  let sumR = 0, sumB = 0, sumG = 0, count = 0;

  const rRes = new Float32Array(numPixels);
  const gRes = new Float32Array(numPixels);
  const bRes = new Float32Array(numPixels);

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const pIdx = idx * 4;
      const cr = pixels[pIdx], cg = pixels[pIdx + 1], cb = pixels[pIdx + 2];
      const nr = (pixels[(idx - width) * 4] + pixels[(idx + width) * 4] + pixels[(idx - 1) * 4] + pixels[(idx + 1) * 4]) * 0.25;
      const ng = (pixels[(idx - width) * 4 + 1] + pixels[(idx + width) * 4 + 1] + pixels[(idx - 1) * 4 + 1] + pixels[(idx + 1) * 4 + 1]) * 0.25;
      const nb = (pixels[(idx - width) * 4 + 2] + pixels[(idx + width) * 4 + 2] + pixels[(idx - 1) * 4 + 2] + pixels[(idx + 1) * 4 + 2]) * 0.25;

      const dr = cr - nr, dg = cg - ng, db = cb - nb;
      rRes[idx] = dr; gRes[idx] = dg; bRes[idx] = db;

      if (Math.abs(dr) > 0.5 || Math.abs(dg) > 0.5 || Math.abs(db) > 0.5) {
        sumR += dr; sumG += dg; sumB += db;
        count++;
      }
    }
  }

  if (count < 100) return { rRB: 1.0, rRG: 1.0 };
  const meanR = sumR / count, meanG = sumG / count, meanB = sumB / count;
  let varR = 0, varB = 0, varG = 0, covRB = 0, covRG = 0;

  for (let i = 0; i < numPixels; i++) {
    if (Math.abs(rRes[i]) > 0.5 || Math.abs(gRes[i]) > 0.5 || Math.abs(bRes[i]) > 0.5) {
      const dr = rRes[i] - meanR, dg = gRes[i] - meanG, db = bRes[i] - meanB;
      varR += dr * dr; varG += dg * dg; varB += db * db;
      covRB += dr * db; covRG += dr * dg;
    }
  }

  const stdR = Math.sqrt(varR), stdB = Math.sqrt(varB), stdG = Math.sqrt(varG);
  const rRB = (stdR > 0 && stdB > 0) ? (covRB / (stdR * stdB)) : 1.0;
  const rRG = (stdR > 0 && stdG > 0) ? (covRG / (stdR * stdG)) : 1.0;

  return { rRB, rRG };
}

const allImages = [
  // AI GENERATED
  { label: 1, name: "Crow Infographic (100% AI)", path: "C:/Users/Gaurav Batule/.gemini/antigravity/brain/d01aa755-7a0f-416c-b273-8ef496152c7d/.user_uploaded/media_1787424162222.jpg" },
  { label: 1, name: "AI Gen New 1 (Aug 23 00:04:39)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_39 AM.png" },
  { label: 1, name: "AI Gen New 2 (Aug 23 00:04:36)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_36 AM.png" },
  { label: 1, name: "AI Gen New 3 (Aug 23 00:04:30)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_30 AM.png" },
  { label: 1, name: "AI Gen 1 (Jul 21 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png" },
  { label: 1, name: "AI Gen 2 (Jul 27 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png" },
  { label: 1, name: "AI Gen 3 (Jun 14 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png" },
  { label: 1, name: "AI Gen 4 (Jun 15 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png" },
  { label: 1, name: "AI Gen 5 (Jun 28 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png" },
  { label: 1, name: "AI Gen 6 (Aug 22 WhatsApp JPEG)", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg" },
  { label: 1, name: "AI Inpaint 1 (Red Path)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 01_12_07 PM.png" },
  { label: 1, name: "AI Inpaint 2 (Flowers)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 02_04_31 PM.png" },
  { label: 1, name: "AI Inpaint 3 (Aniwatch Modal)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 04_36_35 PM.png" },
  // REAL IMAGES
  { label: 0, name: "Real 1. Instagram Reel Screenshot", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg" },
  { label: 0, name: "Real 2. WhatsApp Photo 1", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (1).jpeg" },
  { label: 0, name: "Real 3. WhatsApp Photo 2", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (2).jpeg" },
  { label: 0, name: "Real 4. WhatsApp Photo 3", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (3).jpeg" },
  { label: 0, name: "Real 5. Architecture (Glass Door)", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/hero-automatic-doors.jpg" },
  { label: 0, name: "Real 6. Storefront Photo", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/store-location-1.jpg" },
  { label: 0, name: "Real 7. Interior (Kitchen)", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/category-modular-kitchen.jpg" }
];

async function run() {
  console.log("Image Name | Class | Chroma_rRB | SmoothRatio | AvgNoiseVar | AvgHF | EditRatio | BNC | Dim");
  console.log("--------------------------------------------------------------------------------------------------");

  for (const item of allImages) {
    if (!fs.existsSync(item.path)) continue;
    const image = sharp(item.path);
    const meta = await image.metadata();

    const maxDim = 1920;
    let w = meta.width, h = meta.height;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      image.resize(w, h);
    }

    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

    const isLossless = item.path.endsWith('.png');
    const chroma = analyzeHighPassResiduals(imgData.data, info.width, info.height);
    const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
    const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);
    const pixelRes = performPixelForensics(imgData, info.width, info.height, isLossless, 'balanced');

    const s = [
      item.name.padEnd(30),
      item.label === 1 ? 'AI  ' : 'REAL',
      chroma.rRB.toFixed(4),
      (noiseRes.stats.smoothRatio * 100).toFixed(1).padStart(5) + '%',
      noiseRes.stats.averageNoiseVariance.toFixed(1).padStart(7),
      freqRes.stats.averageHighFreqRatio.toFixed(4),
      (pixelRes.stats.editedAreaRatio * 100).toFixed(2).padStart(5) + '%',
      noiseRes.stats.brightnessNoiseCorrelation.toFixed(2).padStart(5),
      `${meta.width}x${meta.height}`
    ];
    console.log(s.join(" | "));
  }
}

run().catch(console.error);
