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

async function debugImage() {
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

  const isLossless = false;
  const pixelRes = performPixelForensics(imgData, info.width, info.height, isLossless, 'balanced');
  const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
  const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);

  console.log("Input to computeCompositeScore:");
  console.log("  metadata.width:", metadata.width, "metadata.height:", metadata.height);
  console.log("  imgData.width:", info.width, "imgData.height:", info.height);
  console.log("  pixelRes.stats:", pixelRes.stats);
  console.log("  noiseRes.stats:", noiseRes.stats);
  console.log("  freqRes.stats:", freqRes.stats);

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

  console.log("\nResult from computeCompositeScore:");
  console.log("  Overall Score:", res.overallScore + "%");
  console.log("  Classification:", res.classification);
  console.log("  Confidence:", res.confidence);
  console.log("  isEdited:", res.isEdited);
  console.log("  editedAreaPercent:", res.editedAreaPercent + "%");
}

debugImage().catch(console.error);
