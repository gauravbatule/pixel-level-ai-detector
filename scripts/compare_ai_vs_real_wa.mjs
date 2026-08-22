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

const images = [
  // Full AI shared on WhatsApp
  { name: "AI WA (New)", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg" },
  // Real WA photos
  { name: "Real WA 1", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (1).jpeg" },
  { name: "Real WA 2", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (2).jpeg" },
  { name: "Real WA 3", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (3).jpeg" },
  { name: "Real Reel", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg" },
];

async function run() {
  for (const item of images) {
    if (!fs.existsSync(item.path)) continue;
    const meta = await sharp(item.path).metadata();
    const stats = await sharp(item.path).stats();

    const image = sharp(item.path);
    const maxDim = 1200;
    let w = meta.width, h = meta.height;
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

    console.log(`=== ${item.name} (${path.basename(item.path)}) ===`);
    console.log(`  Raw Dims: ${meta.width}x${meta.height}, Ratio: ${(meta.width/meta.height).toFixed(3)}`);
    console.log(`  Color Entropy: R_stdev=${stats.channels[0].stdev.toFixed(1)}, G_stdev=${stats.channels[1].stdev.toFixed(1)}, B_stdev=${stats.channels[2].stdev.toFixed(1)}`);
    console.log(`  Noise Var: ${noise.stats.averageNoiseVariance.toFixed(1)}, Smooth Ratio: ${noise.stats.smoothRatio.toFixed(3)}, BNC: ${noise.stats.brightnessNoiseCorrelation.toFixed(3)}, Cross: ${noise.stats.crossChannelScore.toFixed(3)}`);
    console.log(`  High Freq Ratio: ${freq.stats.averageHighFreqRatio.toFixed(5)}, HF Var: ${freq.stats.highFreqVariance.toFixed(6)}`);
    console.log("");
  }
}

run().catch(console.error);
