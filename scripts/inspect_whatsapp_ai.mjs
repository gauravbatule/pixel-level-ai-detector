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

const targetPath = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg";

async function inspectTarget() {
  if (!fs.existsSync(targetPath)) {
    console.error("Target file does not exist:", targetPath);
    return;
  }

  const image = sharp(targetPath);
  const metadata = await image.metadata();
  console.log("================================================================================");
  console.log(`  INSPECTING WHATSAPP AI GENERATED IMAGE: ${path.basename(targetPath)}`);
  console.log(`  Dimensions: ${metadata.width}x${metadata.height}, Format: ${metadata.format}`);
  console.log("================================================================================\n");

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
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  const pixelRes = performPixelForensics(imgData, info.width, info.height, false, 'balanced');
  const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
  const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);

  console.log("NOISE ANALYSIS STATS:");
  console.log("  - Avg Noise Variance:     ", noiseRes.stats.averageNoiseVariance);
  console.log("  - Noise Uniformity:       ", noiseRes.stats.noiseUniformity);
  console.log("  - Smooth Ratio:           ", noiseRes.stats.smoothRatio);
  console.log("  - Brightness Noise Corr:  ", noiseRes.stats.brightnessNoiseCorrelation);
  console.log("  - Cross Channel Score:    ", noiseRes.stats.crossChannelScore);
  console.log("  - Smooth Gradient Score:  ", noiseRes.stats.smoothGradientScore);
  console.log("");
  console.log("FREQUENCY ANALYSIS STATS:");
  console.log("  - Avg High Freq Ratio:    ", freqRes.stats.averageHighFreqRatio);
  console.log("  - High Freq Variance:     ", freqRes.stats.highFreqVariance);
  console.log("  - High Freq Deficiency:   ", freqRes.stats.highFreqDeficiency);
  console.log("  - Periodicity Score:      ", freqRes.stats.periodicityScore);
  console.log("");
  console.log("PIXEL FORENSICS STATS:");
  console.log("  - Edited Area Ratio:      ", pixelRes.stats.editedAreaRatio);
  console.log("  - Avg Suspicion:          ", pixelRes.stats.averageSuspicion);
}

inspectTarget().catch(console.error);
