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
import { computeCompositeScore } from '../lib/analysis/scoring.js';

const targetPath = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg";

async function testExact() {
  const image = sharp(targetPath);
  const metadata = await image.metadata();

  const maxDim = 1920; // Exact browser logic
  let w = metadata.width, h = metadata.height;
  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    image.resize(w, h);
  }

  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  const isLossless = false;
  const pixelRes = performPixelForensics(imgData, info.width, info.height, isLossless, 'balanced');
  const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
  const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);

  const res = computeCompositeScore(
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

  console.log("EXACT BROWSER TEST ON WHATSAPP IMAGE:");
  console.log("  Score:", res.overallScore + "%");
  console.log("  Classification:", res.classification);
  console.log("  Confidence:", res.confidence);
  console.log("  Breakdown:", res.breakdown);
}

testExact().catch(console.error);
