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
import { computeCompositeScore, generateCompositeHeatmap } from '../lib/analysis/scoring.js';

const targetPath = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg";

async function testHeatmap() {
  const image = sharp(targetPath);
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

  const pixelRes = performPixelForensics(imgData, info.width, info.height, false, 'balanced');
  const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
  const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);

  const scoreRes = computeCompositeScore(
    null,
    noiseRes,
    freqRes,
    null,
    null,
    pixelRes,
    'balanced',
    metadata.width,
    metadata.height,
    imgData
  );

  console.log("Score Result:", scoreRes.overallScore, "%", scoreRes.classification);
}

testHeatmap().catch(console.error);
