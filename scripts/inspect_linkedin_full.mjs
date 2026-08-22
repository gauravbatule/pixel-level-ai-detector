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

const p = "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png";

async function inspect() {
  const image = sharp(p);
  const meta = await image.metadata();
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
  const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);

  console.log("LinkedIn meta:", meta);
  console.log("Noise stats:", noiseRes.stats);
  console.log("Frequency stats:", freqRes.stats);
}

inspect().catch(console.error);
