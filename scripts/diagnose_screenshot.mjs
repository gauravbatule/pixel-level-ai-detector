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

function analyzeHighPassResiduals(pixels, width, height) {
  const numPixels = width * height;
  let sumR = 0, sumB = 0, sumG = 0, count = 0;

  const rRes = new Float32Array(numPixels);
  const gRes = new Float32Array(numPixels);
  const bRes = new Float32Array(numPixels);

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const pIdx = idx * 4;
      const cr = pixels[pIdx], cg = pixels[pIdx + 1], cb = pixels[pIdx + 2];
      const nr = (pixels[(idx - width) * 4] + pixels[(idx + width) * 4] + pixels[(idx - 1) * 4] + pixels[(idx + 1) * 4]) * 0.25;
      const ng = (pixels[(idx - width) * 4 + 1] + pixels[(idx + width) * 4 + 1] + pixels[(idx - 1) * 4 + 1] + pixels[(idx + 1) * 4 + 1]) * 0.25;
      const nb = (pixels[(idx - width) * 4 + 2] + pixels[(idx + width) * 4 + 2] + pixels[(idx - 1) * 4 + 2] + pixels[(idx + 1) * 4 + 2]) * 0.25;

      const dr = cr - nr, dg = cg - ng, db = cb - nb;
      rRes[idx] = dr; gRes[idx] = dg; bRes[idx] = db;

      if (Math.abs(dr) > 0.5 || Math.abs(dg) > 0.5 || Math.abs(db) > 0.5) {
        sumR += dr; sumG += dg; sumB += db;
        count++;
      }
    }
  }

  if (count < 100) return { rRB: 1.0, rRG: 1.0 };
  const meanR = sumR / count, meanG = sumG / count, meanB = sumB / count;
  let varR = 0, varB = 0, varG = 0, covRB = 0, covRG = 0;

  for (let i = 0; i < numPixels; i++) {
    if (Math.abs(rRes[i]) > 0.5 || Math.abs(gRes[i]) > 0.5 || Math.abs(bRes[i]) > 0.5) {
      const dr = rRes[i] - meanR, dg = gRes[i] - meanG, db = bRes[i] - meanB;
      varR += dr * dr; varG += dg * dg; varB += db * db;
      covRB += dr * db; covRG += dr * dg;
    }
  }

  const stdR = Math.sqrt(varR), stdB = Math.sqrt(varB), stdG = Math.sqrt(varG);
  const rRB = (stdR > 0 && stdB > 0) ? (covRB / (stdR * stdB)) : 1.0;
  const rRG = (stdR > 0 && stdG > 0) ? (covRG / (stdR * stdG)) : 1.0;

  return { rRB, rRG };
}

const screenshotPath = "C:/Users/Gaurav Batule/.gemini/antigravity/brain/d01aa755-7a0f-416c-b273-8ef496152c7d/.user_uploaded/media_1787425703724.png";

async function diagnose() {
  const image = sharp(screenshotPath);
  const meta = await image.metadata();
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  const chroma = analyzeHighPassResiduals(imgData.data, info.width, info.height);
  const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
  const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);
  const pixelRes = performPixelForensics(imgData, info.width, info.height, true, 'balanced');

  console.log("================================================================================");
  console.log("  ORIGINAL UI SCREENSHOT FORENSIC FEATURE EXTRACTION");
  console.log("================================================================================");
  console.log(`Image Size: ${meta.width} x ${meta.height} (${meta.format})`);
  console.log("\n--- High-Pass Chroma Residuals ---");
  console.log(`  r(R, B): ${chroma.rRB.toFixed(4)}`);
  console.log(`  r(R, G): ${chroma.rRG.toFixed(4)}`);

  console.log("\n--- Noise Analysis ---");
  console.log(`  Average Noise Variance:    ${noiseRes.stats.averageNoiseVariance.toFixed(2)}`);
  console.log(`  Smooth Blocks Ratio:       ${(noiseRes.stats.smoothRatio * 100).toFixed(1)}% (${noiseRes.stats.smoothBlocks} / ${noiseRes.stats.totalBlocks})`);
  console.log(`  BNC (Brightness-Noise):    ${noiseRes.stats.brightnessNoiseCorrelation.toFixed(2)}`);
  console.log(`  Cross Channel Score:       ${noiseRes.stats.crossChannelScore.toFixed(2)}`);
  console.log(`  Smooth Gradient Score:     ${noiseRes.stats.smoothGradientScore.toFixed(2)}`);

  console.log("\n--- Frequency Spectral Analysis ---");
  console.log(`  Average High Freq Ratio:   ${freqRes.stats.averageHighFreqRatio.toFixed(4)}`);
  console.log(`  High Freq Deficiency:      ${freqRes.stats.highFreqDeficiency}`);
  console.log(`  Periodicity Score:         ${freqRes.stats.periodicityScore.toFixed(2)}`);

  console.log("\n--- Pixel Forensics & Inpainting ---");
  console.log(`  Edited Area Ratio:         ${(pixelRes.stats.editedAreaRatio * 100).toFixed(2)}%`);
  console.log(`  Average Suspicion:         ${pixelRes.stats.averageSuspicion.toFixed(4)}`);
  console.log(`  Baseline Noise:            ${pixelRes.baselineNoise.toFixed(2)}`);

  // Digital Screen / UI Signature: Count discrete solid horizontal/vertical runs
  let exactColorMatches = 0;
  for (let y = 0; y < info.height; y++) {
    const row = y * info.width * 4;
    for (let x = 1; x < info.width; x++) {
      const idx = row + x * 4;
      const prevIdx = row + (x - 1) * 4;
      if (data[idx] === data[prevIdx] && data[idx+1] === data[prevIdx+1] && data[idx+2] === data[prevIdx+2]) {
        exactColorMatches++;
      }
    }
  }
  const exactFlatRatio = exactColorMatches / (info.width * info.height);
  console.log(`\n--- Digital UI Artifacts ---`);
  console.log(`  Exact Adjacent Pixel Match (Flat Solid UI): ${(exactFlatRatio * 100).toFixed(1)}%`);
}

diagnose().catch(console.error);
