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

const p = "test_dataset/real_photos/landscape_nature_real.jpg";

async function diag() {
  const { data, info } = await sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
  const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);

  console.log("Landscape stats:");
  console.log("  smoothRatio:", noiseRes.stats.smoothRatio);
  console.log("  avgNoiseVar:", noiseRes.stats.averageNoiseVariance);
  console.log("  bnc:", noiseRes.stats.brightnessNoiseCorrelation);
  console.log("  avgHF:", freqRes.stats.averageHighFreqRatio);
}

diag().catch(console.error);
