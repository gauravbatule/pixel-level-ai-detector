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

import { performNoiseAnalysis } from '../lib/analysis/noise.js';
import { performFrequencyAnalysis } from '../lib/analysis/frequency.js';

const ALL_IMAGES = [
  // Full AI
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png" },
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png" },
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png" },
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png" },
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png" },
  // Real Images
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (1).jpeg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (2).jpeg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (3).jpeg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/hero-automatic-doors.jpg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/store-location-1.jpg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/category-modular-kitchen.jpg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png" },
];

async function run() {
  console.log("Type | Image Name | avgNoiseVar | smoothRatio | BNC | crossCorr | avgHF | hfVar");
  console.log("-----------------------------------------------------------------------------------------");

  for (const item of ALL_IMAGES) {
    if (!fs.existsSync(item.path)) continue;
    const image = sharp(item.path);
    const metadata = await image.metadata();

    const maxDim = 1200;
    let w = metadata.width, h = metadata.height;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      image.resize(w, h);
    }

    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

    const noise = performNoiseAnalysis(imgData, info.width, info.height);
    const freq = performFrequencyAnalysis(imgData, info.width, info.height);

    const name = path.basename(item.path).substring(0, 22).padEnd(22);
    const ns = noise.stats;
    const fsStats = freq.stats;

    console.log(
      `${item.type.padEnd(4)} | ${name} | ` +
      `${ns.averageNoiseVariance.toFixed(1).padStart(11)} | ` +
      `${ns.smoothRatio.toFixed(3).padStart(11)} | ` +
      `${ns.brightnessNoiseCorrelation.toFixed(3).padStart(5)} | ` +
      `${ns.crossChannelScore.toFixed(3).padStart(9)} | ` +
      `${fsStats.averageHighFreqRatio.toFixed(4).padStart(7)} | ` +
      `${fsStats.highFreqVariance.toFixed(6).padStart(8)}`
    );
  }
}

run().catch(console.error);
