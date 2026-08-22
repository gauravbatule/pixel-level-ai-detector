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

const cases = [
  { name: "Real 7. Kitchen", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/category-modular-kitchen.jpg" },
  { name: "Real 8. LinkedIn", path: "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png" },
  { name: "WhatsApp AI (Aug 22)", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg" }
];

async function inspect() {
  for (const c of cases) {
    const image = sharp(c.path);
    const meta = await image.metadata();
    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

    const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
    const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);

    console.log(`\n--- ${c.name} (${meta.width}x${meta.height}) ---`);
    console.log("  smoothRatio:", noiseRes.stats.smoothRatio);
    console.log("  avgNoiseVar:", noiseRes.stats.averageNoiseVariance);
    console.log("  bnc:", noiseRes.stats.brightnessNoiseCorrelation);
    console.log("  avgHF:", freqRes.stats.averageHighFreqRatio);
    console.log("  highFreqDeficiency:", freqRes.stats.highFreqDeficiency);
  }
}

inspect().catch(console.error);
