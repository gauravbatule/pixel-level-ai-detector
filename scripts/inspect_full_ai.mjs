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
import { performELA } from '../lib/analysis/ela.js';
import { computeCompositeScore } from '../lib/analysis/scoring.js';

const FULL_AI_IMAGES = [
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_17 AM.png",
  "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png",
];

async function inspect() {
  console.log("================================================================================");
  console.log("  INSPECTING FULLY AI-GENERATED IMAGES (NO METADATA)");
  console.log("================================================================================\n");

  for (const imgPath of FULL_AI_IMAGES) {
    if (!fs.existsSync(imgPath)) continue;
    console.log(`--- ${path.basename(imgPath)} ---`);

    const image = sharp(imgPath);
    const metadata = await image.metadata();

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

    const pixelRes = performPixelForensics(imgData, info.width, info.height, true, 'balanced');
    const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
    const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);
    const scoreRes = computeCompositeScore(null, noiseRes, freqRes, null, null, pixelRes, 'balanced');

    console.log(`  CURRENT Overall Score:   ${scoreRes.overallScore}%`);
    console.log(`  CURRENT Classification:  ${scoreRes.classification} (${scoreRes.confidence})`);
    console.log(`  Noise Stats:`);
    console.log(`    - Avg Noise Var:       ${noiseRes.stats.averageNoiseVariance.toFixed(2)}`);
    console.log(`    - Noise Uniformity:    ${noiseRes.stats.noiseUniformity.toFixed(3)}`);
    console.log(`    - Smooth Ratio:        ${noiseRes.stats.smoothRatio.toFixed(3)}`);
    console.log(`    - BNC (Photon Noise):  ${noiseRes.stats.brightnessNoiseCorrelation.toFixed(3)}`);
    console.log(`    - Cross-Channel Corr:  ${noiseRes.stats.crossChannelScore.toFixed(3)}`);
    console.log(`    - Smooth Gradient Sc:  ${noiseRes.stats.smoothGradientScore.toFixed(3)}`);
    console.log(`  Frequency Stats:`);
    console.log(`    - Avg High Freq Ratio: ${freqRes.stats.averageHighFreqRatio.toFixed(4)}`);
    console.log(`    - High Freq Variance:  ${freqRes.stats.highFreqVariance.toFixed(6)}`);
    console.log(`    - Periodicity Score:   ${freqRes.stats.periodicityScore.toFixed(3)}`);
    console.log(`  Pixel Forensics Stats:`);
    console.log(`    - Edited Area:         ${(pixelRes.stats.editedAreaRatio * 100).toFixed(1)}%`);
    console.log(`    - Avg Suspicion:       ${(pixelRes.stats.averageSuspicion * 100).toFixed(2)}%`);
    console.log("");
  }
}

inspect().catch(console.error);
